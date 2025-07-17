import * as vscode from 'vscode';
import { ClaudeCodeProvider } from './claudeCodeProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Claude Pilot extension is now active!');
    
    // Force the view container to be visible
    vscode.commands.executeCommand('setContext', 'claudePilotContainer:visible', true);
    
    const provider = new ClaudeCodeProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ClaudeCodeProvider.viewType, provider)
    );
    
    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
    statusBarItem.text = "$(robot) Claude";
    statusBarItem.tooltip = "Open Claude Pilot";
    statusBarItem.command = 'claudePilot.openTerminal';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    statusBarItem.show();
    
    context.subscriptions.push(
        statusBarItem,
        vscode.commands.registerCommand('claudePilot.refresh', () => {
            provider.refresh();
        }),
        vscode.commands.registerCommand('claudePilot.openTerminal', async () => {
            await provider.openTerminal();
        }),
        vscode.commands.registerCommand('claudePilot.focus', () => {
            vscode.commands.executeCommand('workbench.view.extension.claudePilotContainer');
        })
    );
}

export function deactivate() {}