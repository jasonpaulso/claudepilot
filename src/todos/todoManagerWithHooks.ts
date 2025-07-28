/**
 * Todo Manager for Claude Pilot with Hook Server Integration
 * 
 * Orchestrates todo file watching and parsing, providing a unified interface
 * for managing Claude's todo lists with real-time updates from hooks.
 */

import { EventEmitter } from 'events';
import { TodoWatcher, TodoFileEvent } from './todoWatcher';
import { TodoParser, TodoList } from './todoParser';
import { HookServer } from '../services/hookServer';

export interface TodoChangeEvent {
    type: 'created' | 'updated' | 'deleted';
    sessionId: string;
    todoList?: TodoList;
    error?: Error;
}

export interface TodoStats {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    fileCount: number;
}

export interface TodoUpdate {
    type: 'todo_update';
    sessionId: string;
    timestamp: string;
    todos: Array<{
        id: string;
        content: string;
        status: 'pending' | 'in_progress' | 'completed';
        priority: 'high' | 'medium' | 'low';
    }>;
    toolResponse: any;
}

export class TodoManager extends EventEmitter {
    private todoWatcher: TodoWatcher;
    private hookServer?: HookServer;
    private currentSessionId?: string;
    private todoCache = new Map<string, TodoList>();
    private parseDebounceTimers = new Map<string, NodeJS.Timeout>();
    private readonly DEBOUNCE_DELAY = 300; // ms

    constructor(hookServer?: HookServer) {
        super();
        this.todoWatcher = new TodoWatcher();
        this.hookServer = hookServer;
        this.setupEventListeners();
    }

    /**
     * Start managing todos for a specific session
     */
    public async startSession(sessionId: string): Promise<void> {
        console.log(`TodoManager: Starting session ${sessionId}`);
        
        this.currentSessionId = sessionId;
        this.todoCache.clear();
        
        // Start watching for file changes
        this.todoWatcher.startWatching(sessionId);
        
        // Load any existing todo files
        await this.loadExistingTodos();
    }

    /**
     * Stop managing todos
     */
    public stopSession(): void {
        console.log('TodoManager: Stopping session');
        
        this.currentSessionId = undefined;
        this.todoWatcher.stopWatching();
        this.todoCache.clear();
        
        // Clear any pending debounce timers
        for (const timer of this.parseDebounceTimers.values()) {
            clearTimeout(timer);
        }
        this.parseDebounceTimers.clear();
    }

    /**
     * Get current todos for the active session
     */
    public getCurrentTodos(): TodoList[] {
        return Array.from(this.todoCache.values());
    }

    /**
     * Get todos by session ID
     */
    public getTodosBySessionId(sessionId: string): TodoList | undefined {
        for (const todoList of this.todoCache.values()) {
            if (todoList.sessionId === sessionId) {
                return todoList;
            }
        }
        return undefined;
    }

    /**
     * Dispose of the manager and clean up resources
     */
    public dispose(): void {
        this.stopSession();
        this.todoWatcher.dispose();
        this.removeAllListeners();
    }

    /**
     * Setup event listeners for the todo watcher and hook server
     */
    private setupEventListeners(): void {
        // File watcher events
        this.todoWatcher.on('todoChanged', (event: TodoFileEvent) => {
            this.handleTodoFileEvent(event);
        });

        this.todoWatcher.on('error', (error: Error) => {
            console.error('TodoManager: Watcher error:', error);
            this.emit('error', error);
        });

        // Hook server events (if available)
        if (this.hookServer) {
            this.hookServer.on('todoUpdate', (update: TodoUpdate) => {
                this.handleTodoNotification(update);
            });

            this.hookServer.on('sessionUpdate', (sessionInfo: any) => {
                this.handleSessionUpdate(sessionInfo);
            });
        }
    }

    /**
     * Handle todo file events from the watcher
     */
    private handleTodoFileEvent(event: TodoFileEvent): void {
        switch (event.type) {
            case 'created':
            case 'updated':
                // Debounce file parsing to avoid multiple rapid updates
                this.debouncedParseTodoFile(event.filePath);
                break;
            case 'deleted':
                this.handleTodoFileDeleted(event.filePath);
                break;
        }
    }

    /**
     * Handle todo notifications from hooks
     */
    private handleTodoNotification(update: TodoUpdate): void {
        console.log(`TodoManager: Received todo notification for session ${update.sessionId}`);
        
        // Emit a change event to trigger UI refresh
        const event: TodoChangeEvent = {
            type: 'updated',
            sessionId: update.sessionId,
            // The actual todo data will be loaded from files by the watcher
        };
        
        this.emit('todoChanged', event);
        
        // Also trigger a re-scan of files to ensure we have the latest data
        if (this.currentSessionId === update.sessionId) {
            this.loadExistingTodos();
        }
    }

    /**
     * Handle session updates from hooks
     */
    private handleSessionUpdate(sessionInfo: any): void {
        console.log(`TodoManager: Received session update for ${sessionInfo.sessionId}`);
        
        // If this is a new session, switch to it
        if (sessionInfo.sessionId && sessionInfo.sessionId !== this.currentSessionId) {
            this.startSession(sessionInfo.sessionId);
        }
    }

    /**
     * Parse todo file with debouncing
     */
    private debouncedParseTodoFile(filePath: string): void {
        // Clear existing timer for this file
        const existingTimer = this.parseDebounceTimers.get(filePath);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.parseTodoFile(filePath);
            this.parseDebounceTimers.delete(filePath);
        }, this.DEBOUNCE_DELAY);

        this.parseDebounceTimers.set(filePath, timer);
    }

    /**
     * Parse a todo file and emit change event
     */
    private async parseTodoFile(filePath: string): Promise<void> {
        try {
            const result = await TodoParser.parseTodoFile(filePath);
            
            if (result.success && result.data) {
                const isNew = !this.todoCache.has(filePath);
                this.todoCache.set(filePath, result.data);
                
                const event: TodoChangeEvent = {
                    type: isNew ? 'created' : 'updated',
                    sessionId: result.data.sessionId,
                    todoList: result.data
                };
                
                this.emit('todoChanged', event);
                console.log(`TodoManager: Emitted ${event.type} event for session ${event.sessionId}`);
            } else if (result.error) {
                this.handleParseError(filePath, result.error);
            }
        } catch (error) {
            this.handleParseError(filePath, error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Handle todo file deletion
     */
    private handleTodoFileDeleted(filePath: string): void {
        const todoList = this.todoCache.get(filePath);
        if (todoList) {
            this.todoCache.delete(filePath);
            
            const event: TodoChangeEvent = {
                type: 'deleted',
                sessionId: todoList.sessionId,
                todoList
            };
            
            this.emit('todoChanged', event);
            console.log(`TodoManager: Emitted deleted event for session ${todoList.sessionId}`);
        }
    }

    /**
     * Handle parse errors
     */
    private handleParseError(filePath: string, error: Error): void {
        console.error(`TodoManager: Error parsing ${filePath}:`, error);
        
        // Try to get session ID from filename even if parsing failed
        const sessionId = TodoParser.extractSessionId(filePath) || this.currentSessionId || 'unknown';
        
        const event: TodoChangeEvent = {
            type: 'updated',
            sessionId,
            error
        };
        
        this.emit('todoChanged', event);
    }

    /**
     * Load existing todo files for the current session
     */
    private async loadExistingTodos(): Promise<void> {
        if (!this.currentSessionId) {
            return;
        }

        const files = this.todoWatcher.getCurrentSessionFiles();
        console.log(`TodoManager: Found ${files.length} existing todo files`);
        
        for (const filePath of files) {
            await this.parseTodoFile(filePath);
        }
    }

    /**
     * Get todo statistics for the current session
     */
    public getTodoStats(): TodoStats {
        const stats: TodoStats = {
            total: 0,
            pending: 0,
            inProgress: 0,
            completed: 0,
            highPriority: 0,
            mediumPriority: 0,
            lowPriority: 0,
            fileCount: this.todoCache.size
        };

        for (const todoList of this.todoCache.values()) {
            for (const todo of todoList.todos) {
                stats.total++;
                
                // Count by status
                switch (todo.status) {
                    case 'pending':
                        stats.pending++;
                        break;
                    case 'in_progress':
                        stats.inProgress++;
                        break;
                    case 'completed':
                        stats.completed++;
                        break;
                }
                
                // Count by priority
                switch (todo.priority) {
                    case 'high':
                        stats.highPriority++;
                        break;
                    case 'medium':
                        stats.mediumPriority++;
                        break;
                    case 'low':
                        stats.lowPriority++;
                        break;
                }
            }
        }
        
        return stats;
    }

    /**
     * Refresh todos by re-parsing all files
     */
    public async refresh(): Promise<void> {
        console.log('TodoManager: Refreshing todos');
        
        // Clear cache
        this.todoCache.clear();
        
        // Reload all todos
        await this.loadExistingTodos();
    }
    
    /**
     * Get current session ID
     */
    public getCurrentSessionId(): string | undefined {
        return this.currentSessionId;
    }
    
    /**
     * Export todos as Markdown
     */
    public exportAsMarkdown(): string {
        const todos = this.getCurrentTodos();
        const lines: string[] = ['# Claude Pilot Todos', ''];
        
        for (const todoList of todos) {
            lines.push(`## Session: ${todoList.sessionId}`, '');
            
            // Group by status
            const byStatus = {
                pending: [] as typeof todoList.todos,
                in_progress: [] as typeof todoList.todos,
                completed: [] as typeof todoList.todos
            };
            
            for (const todo of todoList.todos) {
                byStatus[todo.status].push(todo);
            }
            
            // Pending
            if (byStatus.pending.length > 0) {
                lines.push('### Pending', '');
                for (const todo of byStatus.pending) {
                    const priority = todo.priority === 'high' ? ' ⚠️' : '';
                    lines.push(`- [ ] ${todo.content}${priority}`);
                }
                lines.push('');
            }
            
            // In Progress
            if (byStatus.in_progress.length > 0) {
                lines.push('### In Progress', '');
                for (const todo of byStatus.in_progress) {
                    const priority = todo.priority === 'high' ? ' ⚠️' : '';
                    lines.push(`- [~] ${todo.content}${priority}`);
                }
                lines.push('');
            }
            
            // Completed
            if (byStatus.completed.length > 0) {
                lines.push('### Completed', '');
                for (const todo of byStatus.completed) {
                    lines.push(`- [x] ${todo.content}`);
                }
                lines.push('');
            }
        }
        
        return lines.join('\n');
    }
    
    /**
     * Export todos as plain text
     */
    public exportAsPlainText(): string {
        const todos = this.getCurrentTodos();
        const lines: string[] = ['Claude Pilot Todos', '==================', ''];
        
        for (const todoList of todos) {
            lines.push(`Session: ${todoList.sessionId}`, '-'.repeat(40), '');
            
            for (const todo of todoList.todos) {
                const status = todo.status.replace('_', ' ').toUpperCase();
                const priority = todo.priority.toUpperCase();
                lines.push(`[${status}] [${priority}] ${todo.content}`);
            }
            lines.push('');
        }
        
        return lines.join('\n');
    }
}