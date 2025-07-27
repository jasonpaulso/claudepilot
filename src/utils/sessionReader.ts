/**
 * Session Reader for Claude Pilot
 * 
 * Reads and parses Claude Code session files from ~/.claude/projects
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionSummary {
    id: string;
    summary?: string;
    timestamp: string;
    gitBranch?: string;
    messageCount: number;
    lastMessage?: string;
}

export class SessionReader {
    private static readonly CLAUDE_DIR = path.join(os.homedir(), '.claude');
    private static readonly PROJECTS_DIR = path.join(SessionReader.CLAUDE_DIR, 'projects');

    /**
     * Get the sanitized project directory name for the current workspace
     */
    private static getSanitizedProjectPath(workspacePath: string): string {
        // Replace path separators with hyphens to match Claude's format
        return workspacePath.replace(/[\/\\]/g, '-');
    }

    /**
     * List all sessions for the current project
     */
    public static async listProjectSessions(workspacePath: string): Promise<SessionSummary[]> {
        const sanitizedPath = this.getSanitizedProjectPath(workspacePath);
        const projectDir = path.join(this.PROJECTS_DIR, sanitizedPath);

        if (!fs.existsSync(projectDir)) {
            return [];
        }

        const files = await fs.promises.readdir(projectDir);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

        const sessions: SessionSummary[] = [];

        for (const file of jsonlFiles) {
            const sessionId = path.basename(file, '.jsonl');
            const filePath = path.join(projectDir, file);
            
            try {
                const summary = await this.readSessionSummary(filePath, sessionId);
                sessions.push(summary);
            } catch (error) {
                // Skip invalid session files
                console.error(`Error reading session ${sessionId}:`, error);
            }
        }

        // Sort by timestamp, most recent first
        return sessions.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }

    /**
     * Read session summary from a JSONL file
     */
    private static async readSessionSummary(filePath: string, sessionId: string): Promise<SessionSummary> {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        let summary: SessionSummary = {
            id: sessionId,
            messageCount: 0,
            timestamp: new Date().toISOString()
        };

        // Parse each line as JSON
        const messages = lines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(msg => msg !== null);

        // Check first line for summary
        if (messages.length > 0 && messages[0].type === 'summary') {
            summary.summary = messages[0].summary;
        }

        // Find metadata from messages
        for (const msg of messages) {
            if (msg.timestamp) {
                summary.timestamp = msg.timestamp;
            }
            if (msg.gitBranch && !summary.gitBranch) {
                summary.gitBranch = msg.gitBranch;
            }
            if (msg.type === 'user' || msg.type === 'assistant') {
                summary.messageCount++;
                
                // Get last user message for preview
                if (msg.type === 'user' && msg.message?.content) {
                    const content = msg.message.content;
                    summary.lastMessage = content.length > 100 
                        ? content.substring(0, 100) + '...' 
                        : content;
                }
            }
        }

        // Use file modification time if no timestamp found
        if (!summary.timestamp) {
            const stats = await fs.promises.stat(filePath);
            summary.timestamp = stats.mtime.toISOString();
        }

        return summary;
    }

    /**
     * Format timestamp for display
     */
    public static formatTimestamp(timestamp: string): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    }
}