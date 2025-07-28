/**
 * Todo Tree View Provider for Claude Pilot
 * 
 * Provides a VS Code TreeView to display Claude's todo lists with
 * status grouping, priority coloring, and real-time updates.
 */

import * as vscode from 'vscode';
import { TodoManager, TodoChangeEvent } from './todoManager';
import { SessionHistoryManager } from './sessionHistory';
import { TodoItem } from './todoParser';
import { SettingsManager } from '../utils/settingsManager';

/**
 * Tree item types for the todo view
 */
type TodoTreeItemType = 'status-group' | 'todo-item' | 'empty' | 'loading';

/**
 * Extended tree item with additional metadata
 */
class TodoTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: TodoTreeItemType,
        public readonly todoItem?: TodoItem,
        public readonly status?: TodoItem['status']
    ) {
        super(label, collapsibleState);
        
        // Set context value for conditional commands
        this.contextValue = itemType;
        
        // Configure based on item type
        switch (itemType) {
            case 'status-group':
                this.iconPath = this.getStatusGroupIcon(status);
                break;
            case 'todo-item':
                this.iconPath = this.getTodoIcon(todoItem);
                this.tooltip = this.getTodoTooltip(todoItem);
                this.description = this.getTodoDescription(todoItem);
                break;
            case 'empty':
                this.iconPath = new vscode.ThemeIcon('info');
                this.description = 'No todos yet';
                break;
            case 'loading':
                this.iconPath = new vscode.ThemeIcon('loading~spin');
                this.description = 'Loading...';
                break;
        }
    }
    
    private getStatusGroupIcon(status?: TodoItem['status']): vscode.ThemeIcon {
        switch (status) {
            case 'pending':
                return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.yellow'));
            case 'in_progress':
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
            case 'completed':
                return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
            default:
                return new vscode.ThemeIcon('list-tree');
        }
    }
    
    private getTodoIcon(todo?: TodoItem): vscode.ThemeIcon {
        if (!todo) {
            return new vscode.ThemeIcon('circle-outline');
        }
        
        // Icon based on status
        let iconName: string;
        let color: vscode.ThemeColor | undefined;
        
        switch (todo.status) {
            case 'pending':
                iconName = 'circle-outline';
                break;
            case 'in_progress':
                iconName = 'sync';
                color = new vscode.ThemeColor('charts.blue');
                break;
            case 'completed':
                iconName = 'pass-filled';
                color = new vscode.ThemeColor('charts.green');
                break;
            default:
                iconName = 'circle-outline';
        }
        
        // Override color for high priority items
        if (todo.priority === 'high' && todo.status !== 'completed') {
            color = new vscode.ThemeColor('charts.red');
        }
        
        return color ? new vscode.ThemeIcon(iconName, color) : new vscode.ThemeIcon(iconName);
    }
    
    private getTodoTooltip(todo?: TodoItem): string {
        if (!todo) {
            return '';
        }
        
        const lines = [
            todo.content,
            '',
            `Status: ${todo.status.replace('_', ' ')}`,
            `Priority: ${todo.priority}`
        ];
        
        return lines.join('\n');
    }
    
    private getTodoDescription(todo?: TodoItem): string {
        if (!todo) {
            return '';
        }
        
        // Show priority indicator for high priority items
        return todo.priority === 'high' ? '⚠️ High Priority' : '';
    }
}

/**
 * Todo Tree Data Provider
 */
export class TodoTreeProvider implements vscode.TreeDataProvider<TodoTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TodoTreeItem | undefined | null | void> = new vscode.EventEmitter<TodoTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TodoTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    
    private todoManager: TodoManager;
    private settingsManager: SettingsManager;
    private isLoading = false;
    private expandedStates = new Map<string, boolean>();
    private filterText: string | undefined;
    
    constructor(todoManager: TodoManager) {
        this.todoManager = todoManager;
        this.settingsManager = new SettingsManager();
        this.setupEventListeners();
        this.initializeExpansionStates();
    }
    
    /**
     * Set loading state
     */
    public setLoading(loading: boolean): void {
        this.isLoading = loading;
        this.refresh();
    }
    
    /**
     * Refresh the tree view
     */
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    /**
     * Set filter text for todos
     */
    public setFilter(filterText: string): void {
        this.filterText = filterText.toLowerCase();
        this.refresh();
    }
    
    /**
     * Clear filter text
     */
    public clearFilter(): void {
        this.filterText = undefined;
        this.refresh();
    }
    
    /**
     * Get tree item for display
     */
    public getTreeItem(element: TodoTreeItem): vscode.TreeItem {
        return element;
    }
    
    /**
     * Get children for a tree item
     */
    public async getChildren(element?: TodoTreeItem): Promise<TodoTreeItem[]> {
        if (this.isLoading) {
            return [new TodoTreeItem('Loading todos...', vscode.TreeItemCollapsibleState.None, 'loading')];
        }
        
        if (!element) {
            // Root level - show status groups
            return this.getStatusGroups();
        }
        
        if (element.itemType === 'status-group' && element.status) {
            // Children of status group - show todos with that status
            return this.getTodosForStatus(element.status);
        }
        
        return [];
    }
    
    /**
     * Get parent of a tree item (optional, for reveal functionality)
     */
    public getParent(_element: TodoTreeItem): vscode.ProviderResult<TodoTreeItem> {
        // Not implemented as we have a simple two-level structure
        return null;
    }
    
    /**
     * Initialize expansion states based on settings
     */
    private initializeExpansionStates(): void {
        const settings = this.settingsManager.getTodoSettings();
        if (settings.expandByDefault) {
            // Set default expanded state for status groups
            this.expandedStates.set('pending', true);
            this.expandedStates.set('in_progress', true);
            this.expandedStates.set('completed', true);
        }
    }
    
    /**
     * Setup event listeners for todo manager
     * 
     * This method establishes automatic updates by listening to:
     * 1. TodoManager's 'todoChanged' events - triggered when todo files are created/updated/deleted
     * 2. Error events from the TodoManager
     * 3. Settings changes that might affect display
     * 
     * The TodoManager watches the ~/.claude/todos/ directory for changes to session todo files
     * and emits events when Claude Code updates them, ensuring the UI stays in sync automatically.
     */
    private setupEventListeners(): void {
        // Listen for todo changes
        this.todoManager.on('todoChanged', (event: TodoChangeEvent) => {
            console.log(`TodoTreeProvider: Received ${event.type} event for session ${event.sessionId}`);
            this.refresh();
        });
        
        // Listen for errors
        this.todoManager.on('error', (error: Error) => {
            console.error('TodoTreeProvider: TodoManager error:', error);
            vscode.window.showErrorMessage(`Todo error: ${error.message}`);
        });
        
        // Listen for settings changes
        this.settingsManager.onSettingsChanged(() => {
            this.initializeExpansionStates();
            this.refresh();
        });
    }
    
    /**
     * Get status groups for root level
     */
    private getStatusGroups(): TodoTreeItem[] {
        const todos = this.todoManager.getCurrentTodos();
        
        if (todos.length === 0) {
            return [new TodoTreeItem('No todos found', vscode.TreeItemCollapsibleState.None, 'empty')];
        }
        
        // Show filter status if active
        const groups: TodoTreeItem[] = [];
        if (this.filterText) {
            const filterItem = new TodoTreeItem(
                `Filter: "${this.filterText}"`,
                vscode.TreeItemCollapsibleState.None,
                'empty'
            );
            filterItem.contextValue = 'filter-active';
            filterItem.iconPath = new vscode.ThemeIcon('filter', new vscode.ThemeColor('charts.orange'));
            filterItem.description = 'Press ESC to clear';
            groups.push(filterItem);
        }
        
        const stats = this.todoManager.getTodoStats();
        
        // Add status groups with counts
        if (stats.pending > 0) {
            const key = 'status-pending';
            const isExpanded = this.expandedStates.get(key) !== false; // Default to expanded
            const group = new TodoTreeItem(
                `Pending (${stats.pending})`,
                isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
                'status-group',
                undefined,
                'pending'
            );
            groups.push(group);
        }
        
        if (stats.inProgress > 0) {
            const key = 'status-in_progress';
            const isExpanded = this.expandedStates.get(key) !== false; // Default to expanded
            const group = new TodoTreeItem(
                `In Progress (${stats.inProgress})`,
                isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
                'status-group',
                undefined,
                'in_progress'
            );
            groups.push(group);
        }
        
        if (stats.completed > 0) {
            const key = 'status-completed';
            const isExpanded = this.expandedStates.get(key) ?? false; // Default to collapsed for completed
            const group = new TodoTreeItem(
                `Completed (${stats.completed})`,
                isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
                'status-group',
                undefined,
                'completed'
            );
            groups.push(group);
        }
        
        return groups;
    }
    
    /**
     * Get todos for a specific status
     */
    private getTodosForStatus(status: TodoItem['status']): TodoTreeItem[] {
        const todoLists = this.todoManager.getCurrentTodos();
        const items: TodoTreeItem[] = [];
        
        // Collect all todos with the specified status
        for (const todoList of todoLists) {
            for (const todo of todoList.todos) {
                if (todo.status === status) {
                    // Apply filter if set
                    if (this.filterText && !todo.content.toLowerCase().includes(this.filterText)) {
                        continue;
                    }
                    
                    // Truncate long content for tree view
                    const displayContent = todo.content.length > 60 
                        ? todo.content.substring(0, 57) + '...' 
                        : todo.content;
                    
                    const item = new TodoTreeItem(
                        displayContent,
                        vscode.TreeItemCollapsibleState.None,
                        'todo-item',
                        todo
                    );
                    
                    items.push(item);
                }
            }
        }
        
        // Sort by priority (high first) then by content
        items.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            const aPriority = priorityOrder[a.todoItem?.priority || 'medium'];
            const bPriority = priorityOrder[b.todoItem?.priority || 'medium'];
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            return a.label.localeCompare(b.label);
        });
        
        return items;
    }
    
    /**
     * Handle tree item expansion state changes
     */
    public onDidExpandElement(element: TodoTreeItem): void {
        if (element.itemType === 'status-group' && element.status) {
            this.expandedStates.set(`status-${element.status}`, true);
        }
    }
    
    /**
     * Handle tree item collapse state changes
     */
    public onDidCollapseElement(element: TodoTreeItem): void {
        if (element.itemType === 'status-group' && element.status) {
            this.expandedStates.set(`status-${element.status}`, false);
        }
    }
    
    /**
     * Dispose of the provider
     */
    public dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}

/**
 * Register todo-related commands
 */
export function registerTodoCommands(
    context: vscode.ExtensionContext,
    todoManager: TodoManager,
    treeView: vscode.TreeView<TodoTreeItem>,
    todoTreeProvider: TodoTreeProvider
): void {
    // Create session history manager
    const sessionHistory = new SessionHistoryManager(context, todoManager);
    // Copy todo content command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.copyTodoContent', (item: TodoTreeItem) => {
            if (item.todoItem) {
                vscode.env.clipboard.writeText(item.todoItem.content);
                vscode.window.showInformationMessage('Todo content copied to clipboard');
            }
        })
    );
    
    // Insert todo into editor command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.insertTodoIntoEditor', (item: TodoTreeItem) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && item.todoItem) {
                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, item.todoItem!.content);
                });
            }
        })
    );
    
    // Refresh todos command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.refreshTodos', async () => {
            await todoManager.refresh();
        })
    );
    
    // Mark todo as complete command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.markTodoComplete', async (item: TodoTreeItem) => {
            if (item.todoItem) {
                vscode.window.showInformationMessage(
                    `Todo marked as complete: ${item.todoItem.content.substring(0, 50)}...`,
                    { modal: false }
                );
                // Note: Actual implementation would require updating the todo file
                // This is a placeholder for future enhancement
            }
        })
    );
    
    // Change todo priority command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.changeTodoPriority', async (item: TodoTreeItem) => {
            if (item.todoItem) {
                const priorities = ['high', 'medium', 'low'];
                const selected = await vscode.window.showQuickPick(priorities, {
                    placeHolder: 'Select new priority',
                    title: 'Change Todo Priority'
                });
                
                if (selected) {
                    vscode.window.showInformationMessage(
                        `Todo priority changed to ${selected}`,
                        { modal: false }
                    );
                    // Note: Actual implementation would require updating the todo file
                }
            }
        })
    );
    
    // Clear completed todos command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.clearCompletedTodos', async () => {
            const stats = todoManager.getTodoStats();
            if (stats.completed === 0) {
                vscode.window.showInformationMessage('No completed todos to clear');
                return;
            }
            
            const answer = await vscode.window.showWarningMessage(
                `Clear ${stats.completed} completed todo${stats.completed > 1 ? 's' : ''}?`,
                { modal: true },
                'Clear',
                'Cancel'
            );
            
            if (answer === 'Clear') {
                vscode.window.showInformationMessage(
                    `Cleared ${stats.completed} completed todo${stats.completed > 1 ? 's' : ''}`,
                    { modal: false }
                );
                // Note: Actual implementation would require updating the todo file
            }
        })
    );
    
    // Search/filter todos command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.searchTodos', async () => {
            const searchTerm = await vscode.window.showInputBox({
                prompt: 'Search todos',
                placeHolder: 'Enter search term...',
                validateInput: (value) => {
                    return value.length === 0 ? 'Please enter a search term' : null;
                }
            });
            
            if (searchTerm) {
                // Apply filter to tree view
                todoTreeProvider.setFilter(searchTerm);
                vscode.window.showInformationMessage(
                    `Searching for: "${searchTerm}"`,
                    'Clear Filter'
                ).then(selection => {
                    if (selection === 'Clear Filter') {
                        todoTreeProvider.clearFilter();
                    }
                });
            }
        })
    );
    
    // Clear search filter command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.clearTodoFilter', () => {
            todoTreeProvider.clearFilter();
            vscode.window.showInformationMessage('Todo filter cleared');
        })
    );
    
    // Show session info command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.showSessionInfo', async () => {
            const sessionId = todoManager.getCurrentSessionId();
            if (sessionId) {
                const stats = todoManager.getTodoStats();
                const info = [
                    `**Session ID:** ${sessionId}`,
                    `**Total Todos:** ${stats.total}`,
                    `**Completed:** ${stats.completed}`,
                    `**In Progress:** ${stats.inProgress}`,
                    `**Pending:** ${stats.pending}`,
                    '',
                    `**High Priority:** ${stats.highPriority}`,
                    `**Medium Priority:** ${stats.mediumPriority}`,
                    `**Low Priority:** ${stats.lowPriority}`
                ].join('\n');
                
                vscode.window.showInformationMessage(info, { modal: true });
            } else {
                vscode.window.showInformationMessage('No active session');
            }
        })
    );
    
    // Export todos command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.exportTodos', async () => {
            const todos = todoManager.getCurrentTodos();
            if (todos.length === 0) {
                vscode.window.showInformationMessage('No todos to export');
                return;
            }
            
            const formats = ['Markdown', 'JSON', 'Plain Text'];
            const format = await vscode.window.showQuickPick(formats, {
                placeHolder: 'Select export format'
            });
            
            if (format) {
                let content = '';
                
                switch (format) {
                    case 'Markdown':
                        content = todoManager.exportAsMarkdown();
                        break;
                    case 'JSON':
                        content = JSON.stringify(todos, null, 2);
                        break;
                    case 'Plain Text':
                        content = todoManager.exportAsPlainText();
                        break;
                }
                
                await vscode.env.clipboard.writeText(content);
                vscode.window.showInformationMessage(`Todos exported to clipboard as ${format}`);
            }
        })
    );
    
    // Focus on todo view
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilotTodos.focus', async () => {
            // Reveal the tree view by selecting the first item
            const rootItems = await todoTreeProvider.getChildren();
            if (rootItems.length > 0) {
                treeView.reveal(rootItems[0], { select: false, focus: true });
            }
        })
    );
    
    // Switch session command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.switchTodoSession', async () => {
            const selectedSessionId = await sessionHistory.showSessionSwitcher();
            if (selectedSessionId) {
                // Update session in todo manager
                await todoManager.startSession(selectedSessionId);
                // Update session history
                await sessionHistory.updateSession(selectedSessionId);
                vscode.window.showInformationMessage(`Switched to session: ${selectedSessionId.substring(0, 8)}...`);
            }
        })
    );
    
    // Clear session history command
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.clearSessionHistory', async () => {
            const answer = await vscode.window.showWarningMessage(
                'Clear all session history?',
                { modal: true },
                'Clear',
                'Cancel'
            );
            
            if (answer === 'Clear') {
                await sessionHistory.clearHistory();
                vscode.window.showInformationMessage('Session history cleared');
            }
        })
    );
    
    // Update session history when todos change
    todoManager.on('todoChanged', async () => {
        const currentSessionId = todoManager.getCurrentSessionId();
        if (currentSessionId) {
            await sessionHistory.updateSession(currentSessionId);
        }
    });
}