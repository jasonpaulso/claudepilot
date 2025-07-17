import * as vscode from 'vscode';
import { ClaudeCodeProvider } from './claudeCodeProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ClaudeCodeProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ClaudeCodeProvider.viewType, provider)
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.refresh', () => {
            provider.refresh();
        }),
        vscode.commands.registerCommand('claudePilot.openTerminal', () => {
            provider.openTerminal();
        })
    );
}

export function deactivate() {}