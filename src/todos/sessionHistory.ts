/**
 * Session History Manager for Claude Pilot
 * 
 * Manages session history for todo lists, allowing users to switch
 * between different Claude sessions and view their associated todos.
 */

import * as vscode from 'vscode';
import { TodoManager } from './todoManagerWithHooks';

export interface SessionInfo {
    id: string;
    startTime: Date;
    lastActiveTime: Date;
    todoCount: number;
    completedCount: number;
}

export class SessionHistoryManager {
    private static readonly STORAGE_KEY = 'claudePilot.sessionHistory';
    private static readonly MAX_SESSIONS = 20;
    
    private context: vscode.ExtensionContext;
    private todoManager: TodoManager;
    
    constructor(context: vscode.ExtensionContext, todoManager: TodoManager) {
        this.context = context;
        this.todoManager = todoManager;
    }
    
    /**
     * Get session history
     */
    public getSessionHistory(): SessionInfo[] {
        const history = this.context.globalState.get<any[]>(
            SessionHistoryManager.STORAGE_KEY,
            []
        );
        
        // Convert date strings back to Date objects
        return history.map(session => ({
            ...session,
            startTime: new Date(session.startTime),
            lastActiveTime: new Date(session.lastActiveTime)
        }));
    }
    
    /**
     * Add or update a session in history
     */
    public async updateSession(sessionId: string): Promise<void> {
        const history = this.getSessionHistory();
        const stats = this.todoManager.getTodoStats();
        
        const existingIndex = history.findIndex(s => s.id === sessionId);
        
        const sessionInfo: SessionInfo = {
            id: sessionId,
            startTime: existingIndex >= 0 ? new Date(history[existingIndex].startTime) : new Date(),
            lastActiveTime: new Date(),
            todoCount: stats.total,
            completedCount: stats.completed
        };
        
        if (existingIndex >= 0) {
            // Update existing session
            history[existingIndex] = sessionInfo;
        } else {
            // Add new session to the beginning
            history.unshift(sessionInfo);
            
            // Limit history size
            if (history.length > SessionHistoryManager.MAX_SESSIONS) {
                history.splice(SessionHistoryManager.MAX_SESSIONS);
            }
        }
        
        await this.context.globalState.update(SessionHistoryManager.STORAGE_KEY, history);
    }
    
    /**
     * Remove a session from history
     */
    public async removeSession(sessionId: string): Promise<void> {
        const history = this.getSessionHistory();
        const filtered = history.filter(s => s.id !== sessionId);
        await this.context.globalState.update(SessionHistoryManager.STORAGE_KEY, filtered);
    }
    
    /**
     * Clear all session history
     */
    public async clearHistory(): Promise<void> {
        await this.context.globalState.update(SessionHistoryManager.STORAGE_KEY, []);
    }
    
    /**
     * Show session switcher quick pick
     */
    public async showSessionSwitcher(): Promise<string | undefined> {
        const history = this.getSessionHistory();
        
        if (history.length === 0) {
            vscode.window.showInformationMessage('No session history available');
            return undefined;
        }
        
        const items: vscode.QuickPickItem[] = history.map(session => {
            const timeAgo = this.getTimeAgo(session.lastActiveTime);
            const completionRate = session.todoCount > 0 
                ? Math.round((session.completedCount / session.todoCount) * 100)
                : 0;
            
            return {
                label: `$(history) ${session.id.substring(0, 8)}...`,
                description: `${session.todoCount} todos (${completionRate}% complete)`,
                detail: `Last active ${timeAgo}`,
                sessionId: session.id
            } as vscode.QuickPickItem & { sessionId: string };
        });
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a session to switch to',
            title: 'Session History'
        });
        
        return selected ? (selected as any).sessionId : undefined;
    }
    
    /**
     * Get human-readable time ago string
     */
    private getTimeAgo(date: Date): string {
        try {
            // Ensure date is a valid Date object
            const dateObj = date instanceof Date ? date : new Date(date);
            if (isNaN(dateObj.getTime())) {
                return 'unknown';
            }
            
            const seconds = Math.floor((new Date().getTime() - dateObj.getTime()) / 1000);
            
            if (seconds < 60) {
                return 'just now';
            }
            
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) {
                return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
            }
            
            const hours = Math.floor(minutes / 60);
            if (hours < 24) {
                return `${hours} hour${hours > 1 ? 's' : ''} ago`;
            }
            
            const days = Math.floor(hours / 24);
            if (days < 7) {
                return `${days} day${days > 1 ? 's' : ''} ago`;
            }
            
            const weeks = Math.floor(days / 7);
            return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        } catch (error) {
            console.error('Error calculating time ago:', error);
            return 'unknown';
        }
    }
}