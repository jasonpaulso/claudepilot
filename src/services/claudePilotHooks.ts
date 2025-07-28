import * as vscode from 'vscode';
import { HookServer } from './hookServer';
import { HookManager } from './hookManager';
import { TodoManager } from '../todos/todoManagerWithHooks';

export class ClaudePilotHooks {
    private hookServer: HookServer;
    private hookManager: HookManager;
    private todoManager?: TodoManager;
    private statusBarItem: vscode.StatusBarItem;

    constructor(private context: vscode.ExtensionContext) {
        this.hookServer = new HookServer(context);
        this.hookManager = new HookManager(context, this.hookServer);
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.text = "$(sync~spin) Claude Hooks";
        this.statusBarItem.tooltip = "Claude Pilot hooks are initializing...";
        context.subscriptions.push(this.statusBarItem);
    }

    /**
     * Initialize the hook system
     */
    async initialize(): Promise<void> {
        try {
            // Start the HTTP server
            const port = await this.hookServer.start();
            console.log(`Claude Pilot: Hook server started on port ${port}`);
            
            // Initialize hook configuration
            await this.hookManager.initialize();
            
            // Update status bar
            this.updateStatusBar(true);
            
            // Show notification if hooks were newly installed
            if (!this.hookManager.isInstalled()) {
                vscode.window.showInformationMessage(
                    'Claude Pilot hooks have been installed. Restart Claude Code for changes to take effect.',
                    'Show Settings'
                ).then(selection => {
                    if (selection === 'Show Settings') {
                        vscode.commands.executeCommand('vscode.open', 
                            vscode.Uri.file(this.hookManager.getSettingsPath())
                        );
                    }
                });
            }
        } catch (error) {
            console.error('Failed to initialize Claude Pilot hooks:', error);
            this.updateStatusBar(false, error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    /**
     * Set the todo manager for integration
     */
    setTodoManager(todoManager: TodoManager): void {
        this.todoManager = todoManager;
    }

    /**
     * Get the hook server instance
     */
    getHookServer(): HookServer {
        return this.hookServer;
    }

    /**
     * Update status bar based on hook status
     */
    private updateStatusBar(success: boolean, error?: string): void {
        if (success) {
            this.statusBarItem.text = "$(check) Claude Hooks";
            this.statusBarItem.tooltip = `Claude Pilot hooks are active\nServer: ${this.hookServer.getUrl()}\nSettings: ${this.hookManager.getSettingsPath()}`;
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = "$(error) Claude Hooks";
            this.statusBarItem.tooltip = `Claude Pilot hooks failed to initialize\nError: ${error}`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
        this.statusBarItem.show();
    }

    /**
     * Dispose of resources
     */
    async dispose(): Promise<void> {
        await this.hookServer.stop();
        this.statusBarItem.dispose();
    }
}

/**
 * Register Claude Pilot hook commands
 */
export function registerHookCommands(context: vscode.ExtensionContext, hooks: ClaudePilotHooks): void {
    // Command to show hook status
    context.subscriptions.push(
        vscode.commands.registerCommand('claudepilot.showHookStatus', () => {
            const server = hooks.getHookServer();
            const message = server['isRunning'] 
                ? `Claude Pilot hooks are active on ${server.getUrl()}`
                : 'Claude Pilot hooks are not running';
            
            vscode.window.showInformationMessage(message, 'Open Settings').then(selection => {
                if (selection === 'Open Settings') {
                    const settingsPath = context.globalState.get<string>('claudeSettingsPath');
                    if (settingsPath) {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(settingsPath));
                    }
                }
            });
        })
    );

    // Command to reinstall hooks
    context.subscriptions.push(
        vscode.commands.registerCommand('claudepilot.reinstallHooks', async () => {
            try {
                await hooks.initialize();
                vscode.window.showInformationMessage('Claude Pilot hooks have been reinstalled successfully');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to reinstall hooks: ${error}`);
            }
        })
    );
}