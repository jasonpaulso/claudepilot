/**
 * Todo File Watcher for Claude Pilot
 * 
 * Monitors the ~/.claude/todos/ directory for changes to todo files
 * and emits events when todos are created, updated, or deleted.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

export interface TodoFileEvent {
    type: 'created' | 'updated' | 'deleted';
    filePath: string;
    sessionId?: string;
}

export class TodoWatcher extends EventEmitter {
    private static readonly TODOS_DIR = path.join(os.homedir(), '.claude', 'todos');
    private fileWatcher?: fs.FSWatcher;
    private watchedFiles = new Map<string, fs.FSWatcher>();
    private currentSessionId?: string;
    private disposed = false;

    constructor() {
        super();
        this.ensureTodosDirectory();
    }

    /**
     * Start watching the todos directory for the given session ID
     */
    public startWatching(sessionId: string): void {
        this.currentSessionId = sessionId;
        this.stopWatching(); // Clean up any existing watchers

        if (!fs.existsSync(TodoWatcher.TODOS_DIR)) {
            this.ensureTodosDirectory();
        }

        try {
            // Watch the todos directory for new files
            this.fileWatcher = fs.watch(TodoWatcher.TODOS_DIR, (eventType, filename) => {
                if (this.disposed || !filename) return;

                const filePath = path.join(TodoWatcher.TODOS_DIR, filename);
                
                // Check if the file is related to our session
                if (this.isSessionTodoFile(filename, sessionId)) {
                    this.handleDirectoryEvent(eventType, filePath);
                }
            });

            // Watch existing todo files for the session
            this.watchExistingSessionFiles(sessionId);

            console.log(`TodoWatcher: Started watching for session ${sessionId}`);
        } catch (error) {
            console.error('TodoWatcher: Error starting file watcher:', error);
            this.emit('error', error);
        }
    }

    /**
     * Stop watching the todos directory
     */
    public stopWatching(): void {
        if (this.fileWatcher) {
            this.fileWatcher.close();
            this.fileWatcher = undefined;
        }

        // Close all individual file watchers
        for (const [filePath, watcher] of this.watchedFiles) {
            watcher.close();
        }
        this.watchedFiles.clear();

        console.log('TodoWatcher: Stopped watching');
    }

    /**
     * Dispose of the watcher and clean up resources
     */
    public dispose(): void {
        this.disposed = true;
        this.stopWatching();
        this.removeAllListeners();
    }

    /**
     * Check if a file belongs to the current session
     */
    private isSessionTodoFile(filename: string, sessionId: string): boolean {
        // Claude saves todo files with the session ID in the filename
        // Pattern: todos-{sessionId}.json or similar
        return filename.includes(sessionId) && filename.endsWith('.json');
    }

    /**
     * Ensure the todos directory exists
     */
    private ensureTodosDirectory(): void {
        try {
            if (!fs.existsSync(TodoWatcher.TODOS_DIR)) {
                fs.mkdirSync(TodoWatcher.TODOS_DIR, { recursive: true });
                console.log(`TodoWatcher: Created todos directory at ${TodoWatcher.TODOS_DIR}`);
            }
        } catch (error) {
            console.error('TodoWatcher: Error creating todos directory:', error);
            this.emit('error', error);
        }
    }

    /**
     * Watch existing todo files for the current session
     */
    private watchExistingSessionFiles(sessionId: string): void {
        try {
            const files = fs.readdirSync(TodoWatcher.TODOS_DIR);
            
            for (const file of files) {
                if (this.isSessionTodoFile(file, sessionId)) {
                    const filePath = path.join(TodoWatcher.TODOS_DIR, file);
                    this.watchFile(filePath);
                    
                    // Emit initial event for existing file
                    this.emitTodoEvent('created', filePath);
                }
            }
        } catch (error) {
            console.error('TodoWatcher: Error watching existing files:', error);
            this.emit('error', error);
        }
    }

    /**
     * Watch an individual file for changes
     */
    private watchFile(filePath: string): void {
        if (this.watchedFiles.has(filePath)) {
            return; // Already watching this file
        }

        try {
            const watcher = fs.watch(filePath, (eventType) => {
                if (this.disposed) return;

                if (eventType === 'change') {
                    this.emitTodoEvent('updated', filePath);
                }
            });

            this.watchedFiles.set(filePath, watcher);
        } catch (error) {
            console.error(`TodoWatcher: Error watching file ${filePath}:`, error);
        }
    }

    /**
     * Handle directory-level events
     */
    private handleDirectoryEvent(eventType: string, filePath: string): void {
        fs.stat(filePath, (err, stats) => {
            if (err) {
                // File was deleted
                if (err.code === 'ENOENT') {
                    this.handleFileDeleted(filePath);
                }
                return;
            }

            if (stats.isFile()) {
                if (!this.watchedFiles.has(filePath)) {
                    // New file created
                    this.watchFile(filePath);
                    this.emitTodoEvent('created', filePath);
                }
            }
        });
    }

    /**
     * Handle file deletion
     */
    private handleFileDeleted(filePath: string): void {
        const watcher = this.watchedFiles.get(filePath);
        if (watcher) {
            watcher.close();
            this.watchedFiles.delete(filePath);
        }
        
        this.emitTodoEvent('deleted', filePath);
    }

    /**
     * Emit a todo event with session ID
     */
    private emitTodoEvent(type: 'created' | 'updated' | 'deleted', filePath: string): void {
        const event: TodoFileEvent = {
            type,
            filePath,
            sessionId: this.currentSessionId
        };

        this.emit('todoChanged', event);
        console.log(`TodoWatcher: Emitted ${type} event for ${path.basename(filePath)}`);
    }

    /**
     * Get all todo files for the current session
     */
    public getCurrentSessionFiles(): string[] {
        if (!this.currentSessionId) {
            return [];
        }

        try {
            const files = fs.readdirSync(TodoWatcher.TODOS_DIR);
            return files
                .filter(file => this.isSessionTodoFile(file, this.currentSessionId!))
                .map(file => path.join(TodoWatcher.TODOS_DIR, file));
        } catch (error) {
            console.error('TodoWatcher: Error reading todos directory:', error);
            return [];
        }
    }
}