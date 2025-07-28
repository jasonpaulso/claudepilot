/**
 * Session Manager for Claude Pilot
 * 
 * Manages session IDs for Claude CLI sessions, including:
 * - Generating UUIDs for new sessions
 * - Storing and retrieving session IDs from VS Code state
 * - Managing session history
 */

import * as vscode from 'vscode';
import { randomUUID } from 'crypto';

export interface SessionState {
    lastSessionId: string | null;
    sessionHistory: SessionHistoryEntry[];
}

export interface SessionHistoryEntry {
    id: string;
    timestamp: number;
    workspacePath?: string;
}

export class SessionManager {
    private static readonly STATE_KEY = 'claudePilot.sessionState';
    private static readonly MAX_HISTORY_SIZE = 50;

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Generate a new UUID for a Claude session
     */
    public generateSessionId(): string {
        return randomUUID();
    }

    /**
     * Get the current session state
     */
    public async getSessionState(): Promise<SessionState> {
        const state = this.context.globalState.get<SessionState>(SessionManager.STATE_KEY);
        return state || {
            lastSessionId: null,
            sessionHistory: []
        };
    }

    /**
     * Get the last session ID
     */
    public async getLastSessionId(): Promise<string | null> {
        const state = await this.getSessionState();
        return state.lastSessionId;
    }

    /**
     * Save a new session ID and update history
     */
    public async saveSession(sessionId: string, workspacePath?: string): Promise<void> {
        const state = await this.getSessionState();
        
        // Update last session ID
        state.lastSessionId = sessionId;
        
        // Add to history
        const historyEntry: SessionHistoryEntry = {
            id: sessionId,
            timestamp: Date.now(),
            workspacePath
        };
        
        // Add to beginning of history
        state.sessionHistory.unshift(historyEntry);
        
        // Limit history size
        if (state.sessionHistory.length > SessionManager.MAX_HISTORY_SIZE) {
            state.sessionHistory = state.sessionHistory.slice(0, SessionManager.MAX_HISTORY_SIZE);
        }
        
        // Save state
        await this.context.globalState.update(SessionManager.STATE_KEY, state);
    }

    /**
     * Get session history for a specific workspace
     */
    public async getWorkspaceHistory(workspacePath: string): Promise<SessionHistoryEntry[]> {
        const state = await this.getSessionState();
        return state.sessionHistory.filter(entry => 
            entry.workspacePath === workspacePath
        );
    }

    /**
     * Get all session history
     */
    public async getAllHistory(): Promise<SessionHistoryEntry[]> {
        const state = await this.getSessionState();
        return state.sessionHistory;
    }

    /**
     * Find a session by ID
     */
    public async findSession(sessionId: string): Promise<SessionHistoryEntry | null> {
        const state = await this.getSessionState();
        return state.sessionHistory.find(entry => entry.id === sessionId) || null;
    }

    /**
     * Clear all session history
     */
    public async clearHistory(): Promise<void> {
        await this.context.globalState.update(SessionManager.STATE_KEY, {
            lastSessionId: null,
            sessionHistory: []
        });
    }

    /**
     * Remove old sessions older than specified days
     */
    public async pruneOldSessions(daysToKeep: number = 30): Promise<void> {
        const state = await this.getSessionState();
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        
        state.sessionHistory = state.sessionHistory.filter(entry => 
            entry.timestamp > cutoffTime
        );
        
        // Update last session ID if it was pruned
        if (state.lastSessionId && !state.sessionHistory.find(e => e.id === state.lastSessionId)) {
            state.lastSessionId = state.sessionHistory[0]?.id || null;
        }
        
        await this.context.globalState.update(SessionManager.STATE_KEY, state);
    }
}