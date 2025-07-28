import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

export interface TodoUpdate {
    type: 'todo_update';
    session_id: string;
    timestamp: string;
    todos: Array<{
        id: string;
        content: string;
        status: 'pending' | 'in_progress' | 'completed';
        priority: 'high' | 'medium' | 'low';
    }>;
    tool_response: any;
}

export class TodoNotificationMonitor extends EventEmitter {
    private notificationDir: string;
    private latestFile: string;
    private watcher: fs.FSWatcher | null = null;
    private lastProcessedTimestamp: string | null = null;

    constructor() {
        super();
        this.notificationDir = path.join(os.homedir(), '.claude', 'notifications');
        this.latestFile = path.join(this.notificationDir, 'latest_todo_update.json');
        
        // Ensure directory exists
        if (!fs.existsSync(this.notificationDir)) {
            fs.mkdirSync(this.notificationDir, { recursive: true });
        }
    }

    /**
     * Start monitoring for todo updates
     */
    start(): void {
        if (this.watcher) {
            return; // Already monitoring
        }

        // Watch the notifications directory
        this.watcher = fs.watch(this.notificationDir, (eventType, filename) => {
            if (filename === 'latest_todo_update.json' || filename?.startsWith('todo_update_')) {
                this.checkForUpdates();
            }
        });

        // Also check immediately in case there are pending updates
        this.checkForUpdates();
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }

    /**
     * Check for new todo updates
     */
    private checkForUpdates(): void {
        try {
            if (!fs.existsSync(this.latestFile)) {
                return;
            }

            const data = fs.readFileSync(this.latestFile, 'utf-8');
            const update: TodoUpdate = JSON.parse(data);

            // Check if this is a new update
            if (update.timestamp !== this.lastProcessedTimestamp) {
                this.lastProcessedTimestamp = update.timestamp;
                this.emit('todoUpdate', update);
            }
        } catch (error) {
            console.error('Error checking for todo updates:', error);
        }
    }

    /**
     * Get the latest todo update if available
     */
    getLatestUpdate(): TodoUpdate | null {
        try {
            if (!fs.existsSync(this.latestFile)) {
                return null;
            }

            const data = fs.readFileSync(this.latestFile, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading latest todo update:', error);
            return null;
        }
    }

    /**
     * Clear all notifications
     */
    clearNotifications(): void {
        try {
            const files = fs.readdirSync(this.notificationDir);
            files.forEach(file => {
                if (file.startsWith('todo_update_') || file === 'latest_todo_update.json') {
                    fs.unlinkSync(path.join(this.notificationDir, file));
                }
            });
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    }
}