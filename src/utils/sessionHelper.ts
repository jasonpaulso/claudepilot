import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface SessionInfo {
    session_id: string;
    transcript_path: string;
    cwd: string;
    last_prompt: string;
}

export class SessionHelper {
    private static globalSessionPath = path.join(os.homedir(), '.claude', 'current_session.json');
    private static projectSessionPath = path.join(process.cwd(), '.claude', 'session_info.json');

    /**
     * Get the current session ID from the captured session info
     * @returns The current session ID or null if not found
     */
    static getCurrentSessionId(): string | null {
        try {
            // Try project-specific file first
            if (fs.existsSync(this.projectSessionPath)) {
                const data = fs.readFileSync(this.projectSessionPath, 'utf-8');
                const sessionInfo: SessionInfo = JSON.parse(data);
                return sessionInfo.session_id;
            }

            // Fall back to global file
            if (fs.existsSync(this.globalSessionPath)) {
                const data = fs.readFileSync(this.globalSessionPath, 'utf-8');
                const sessionInfo: SessionInfo = JSON.parse(data);
                return sessionInfo.session_id;
            }

            return null;
        } catch (error) {
            console.error('Error reading session info:', error);
            return null;
        }
    }

    /**
     * Get the full session info
     * @returns The session info object or null if not found
     */
    static getSessionInfo(): SessionInfo | null {
        try {
            // Try project-specific file first
            if (fs.existsSync(this.projectSessionPath)) {
                const data = fs.readFileSync(this.projectSessionPath, 'utf-8');
                return JSON.parse(data);
            }

            // Fall back to global file
            if (fs.existsSync(this.globalSessionPath)) {
                const data = fs.readFileSync(this.globalSessionPath, 'utf-8');
                return JSON.parse(data);
            }

            return null;
        } catch (error) {
            console.error('Error reading session info:', error);
            return null;
        }
    }

    /**
     * Get the transcript path for the current session
     * @returns The transcript path or null if not found
     */
    static getTranscriptPath(): string | null {
        const sessionInfo = this.getSessionInfo();
        return sessionInfo?.transcript_path || null;
    }
}