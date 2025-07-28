/**
 * Todo Parser for Claude Pilot
 * 
 * Parses Claude's todo JSON files and provides structured todo data.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TodoItem {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    priority: 'low' | 'medium' | 'high';
}

export interface TodoList {
    sessionId: string;
    todos: TodoItem[];
    filePath: string;
    lastUpdated: Date;
}

export interface ParseResult {
    success: boolean;
    data?: TodoList;
    error?: Error;
}

export class TodoParser {
    /**
     * Parse a todo file and return structured data
     */
    public static async parseTodoFile(filePath: string): Promise<ParseResult> {
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return {
                    success: false,
                    error: new Error(`Todo file not found: ${filePath}`)
                };
            }

            // Read file content
            const content = await fs.promises.readFile(filePath, 'utf-8');
            
            // Parse JSON
            const data = JSON.parse(content);
            
            // Validate and transform the data
            const todoList = this.validateAndTransform(data, filePath);
            
            return {
                success: true,
                data: todoList
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    /**
     * Parse multiple todo files
     */
    public static async parseTodoFiles(filePaths: string[]): Promise<Map<string, ParseResult>> {
        const results = new Map<string, ParseResult>();
        
        for (const filePath of filePaths) {
            const result = await this.parseTodoFile(filePath);
            results.set(filePath, result);
        }
        
        return results;
    }

    /**
     * Extract session ID from filename
     */
    public static extractSessionId(filePath: string): string | null {
        const filename = path.basename(filePath);
        
        // Common patterns for Claude todo files:
        // - todos-{sessionId}.json
        // - {sessionId}-todos.json
        // - todos_{sessionId}.json
        
        const patterns = [
            /todos-([a-f0-9-]+)\.json$/i,
            /([a-f0-9-]+)-todos\.json$/i,
            /todos_([a-f0-9-]+)\.json$/i,
            /([a-f0-9-]+)\.json$/i // Fallback pattern
        ];
        
        for (const pattern of patterns) {
            const match = filename.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        return null;
    }

    /**
     * Validate and transform raw JSON data into TodoList
     */
    private static validateAndTransform(data: any, filePath: string): TodoList {
        // Extract session ID from filename
        const sessionId = this.extractSessionId(filePath) || 'unknown';
        
        // Get file stats for last updated time
        const stats = fs.statSync(filePath);
        const lastUpdated = stats.mtime;
        
        // Handle different possible todo file structures
        let todos: TodoItem[] = [];
        
        // If data is an array, it's likely a direct list of todos
        if (Array.isArray(data)) {
            todos = data.map((item, index) => this.parseTodoItem(item, index));
        }
        // If data has a todos property
        else if (data.todos && Array.isArray(data.todos)) {
            todos = data.todos.map((item: any, index: number) => this.parseTodoItem(item, index));
        }
        // If data has items property
        else if (data.items && Array.isArray(data.items)) {
            todos = data.items.map((item: any, index: number) => this.parseTodoItem(item, index));
        }
        // If data is an object with todo-like properties, treat it as a single todo
        else if (typeof data === 'object' && (data.content || data.description || data.text)) {
            todos = [this.parseTodoItem(data, 0)];
        }
        
        return {
            sessionId,
            todos,
            filePath,
            lastUpdated
        };
    }

    /**
     * Parse an individual todo item
     */
    private static parseTodoItem(item: any, index: number): TodoItem {
        // Default values
        const defaultTodo: TodoItem = {
            id: String(index),
            content: '',
            status: 'pending',
            priority: 'medium'
        };
        
        if (typeof item === 'string') {
            // Simple string todo
            return {
                ...defaultTodo,
                content: item
            };
        }
        
        if (typeof item !== 'object' || item === null) {
            return defaultTodo;
        }
        
        // Extract ID
        const id = item.id || item.uuid || item.key || String(index);
        
        // Extract content
        const content = item.content || item.text || item.description || item.title || item.name || '';
        
        // Extract status
        let status: TodoItem['status'] = 'pending';
        const rawStatus = (item.status || item.state || '').toLowerCase();
        if (rawStatus.includes('progress') || rawStatus.includes('active')) {
            status = 'in_progress';
        } else if (rawStatus.includes('complete') || rawStatus.includes('done') || rawStatus.includes('finish')) {
            status = 'completed';
        }
        
        // Extract priority
        let priority: TodoItem['priority'] = 'medium';
        const rawPriority = (item.priority || item.importance || '').toLowerCase();
        if (rawPriority.includes('high') || rawPriority.includes('urgent') || rawPriority === '3') {
            priority = 'high';
        } else if (rawPriority.includes('low') || rawPriority === '1') {
            priority = 'low';
        }
        
        return {
            id: String(id),
            content,
            status,
            priority
        };
    }

    /**
     * Check if a file is a valid todo file
     */
    public static isValidTodoFile(filePath: string): boolean {
        try {
            const ext = path.extname(filePath).toLowerCase();
            if (ext !== '.json') {
                return false;
            }
            
            const stats = fs.statSync(filePath);
            return stats.isFile() && stats.size > 0 && stats.size < 10 * 1024 * 1024; // Max 10MB
        } catch {
            return false;
        }
    }

    /**
     * Get todo statistics from a TodoList
     */
    public static getTodoStats(todoList: TodoList): {
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
        highPriority: number;
    } {
        const stats = {
            total: todoList.todos.length,
            pending: 0,
            inProgress: 0,
            completed: 0,
            highPriority: 0
        };
        
        for (const todo of todoList.todos) {
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
            
            if (todo.priority === 'high') {
                stats.highPriority++;
            }
        }
        
        return stats;
    }
}