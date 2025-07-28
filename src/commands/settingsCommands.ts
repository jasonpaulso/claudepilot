/**
 * Settings Commands for Claude Pilot
 * 
 * Commands for managing extension settings
 */

import * as vscode from 'vscode';
import { SettingsManager, TerminalSettings, TodoSettings, UISettings } from '../utils/settingsManager';

export class SettingsCommands {
    private settingsManager: SettingsManager;
    
    constructor() {
        this.settingsManager = new SettingsManager();
    }
    
    /**
     * Open settings UI for Claude Pilot
     */
    public async openSettings(): Promise<void> {
        // Open VS Code settings with Claude Pilot filter
        await vscode.commands.executeCommand('workbench.action.openSettings', 'claudePilot');
    }
    
    /**
     * Quick pick for terminal font size
     */
    public async setTerminalFontSize(): Promise<void> {
        const currentSettings = this.settingsManager.getTerminalSettings();
        const sizes = ['8', '10', '12', '14', '16', '18', '20', '24', '28', '32'];
        
        const selected = await vscode.window.showQuickPick(sizes, {
            placeHolder: `Current font size: ${currentSettings.fontSize}`,
            title: 'Select Terminal Font Size'
        });
        
        if (selected) {
            await this.settingsManager.updateTerminalSettings({
                fontSize: parseInt(selected)
            });
            vscode.window.showInformationMessage(`Terminal font size set to ${selected}`);
        }
    }
    
    /**
     * Quick pick for terminal cursor style
     */
    public async setTerminalCursorStyle(): Promise<void> {
        const currentSettings = this.settingsManager.getTerminalSettings();
        const styles: Array<{ label: string; value: 'block' | 'underline' | 'bar' }> = [
            { label: '█ Block', value: 'block' },
            { label: '_ Underline', value: 'underline' },
            { label: '| Bar', value: 'bar' }
        ];
        
        const selected = await vscode.window.showQuickPick(styles, {
            placeHolder: `Current cursor style: ${currentSettings.cursorStyle}`,
            title: 'Select Terminal Cursor Style'
        });
        
        if (selected) {
            await this.settingsManager.updateTerminalSettings({
                cursorStyle: selected.value
            });
            vscode.window.showInformationMessage(`Terminal cursor style set to ${selected.label}`);
        }
    }
    
    /**
     * Toggle show welcome screen
     */
    public async toggleWelcomeScreen(): Promise<void> {
        const currentSettings = this.settingsManager.getUISettings();
        const newValue = !currentSettings.showWelcomeScreen;
        
        await this.settingsManager.updateUISettings({
            showWelcomeScreen: newValue
        });
        
        vscode.window.showInformationMessage(
            `Welcome screen ${newValue ? 'enabled' : 'disabled'}`
        );
    }
    
    /**
     * Toggle todo status bar visibility
     */
    public async toggleTodoStatusBar(): Promise<void> {
        const currentSettings = this.settingsManager.getTodoSettings();
        const newValue = !currentSettings.showStatusBar;
        
        await this.settingsManager.updateTodoSettings({
            showStatusBar: newValue
        });
        
        vscode.window.showInformationMessage(
            `Todo status bar ${newValue ? 'shown' : 'hidden'}`
        );
    }
    
    /**
     * Set default todo filter
     */
    public async setDefaultTodoFilter(): Promise<void> {
        const currentSettings = this.settingsManager.getTodoSettings();
        const filters: Array<{ label: string; value: 'all' | 'pending' | 'in_progress' | 'completed' }> = [
            { label: 'All Todos', value: 'all' },
            { label: 'Pending Only', value: 'pending' },
            { label: 'In Progress Only', value: 'in_progress' },
            { label: 'Completed Only', value: 'completed' }
        ];
        
        const selected = await vscode.window.showQuickPick(filters, {
            placeHolder: `Current default filter: ${currentSettings.defaultFilter}`,
            title: 'Select Default Todo Filter'
        });
        
        if (selected) {
            await this.settingsManager.updateTodoSettings({
                defaultFilter: selected.value
            });
            vscode.window.showInformationMessage(`Default todo filter set to ${selected.label}`);
        }
    }
    
    /**
     * Reset all settings to defaults
     */
    public async resetSettings(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to reset all Claude Pilot settings to defaults?',
            'Yes, Reset',
            'Cancel'
        );
        
        if (confirm === 'Yes, Reset') {
            await this.settingsManager.resetToDefaults();
            vscode.window.showInformationMessage('Claude Pilot settings reset to defaults');
        }
    }
    
    /**
     * Show current settings summary
     */
    public async showSettingsSummary(): Promise<void> {
        const settings = this.settingsManager.getAllSettings();
        
        const summary = new vscode.MarkdownString();
        summary.isTrusted = true;
        
        summary.appendMarkdown('## Claude Pilot Settings Summary\n\n');
        
        summary.appendMarkdown('### General\n');
        summary.appendMarkdown(`- **Starting Command:** ${settings.startingCommand}\n\n`);
        
        summary.appendMarkdown('### Terminal\n');
        summary.appendMarkdown(`- **Font Size:** ${settings.terminal.fontSize}px\n`);
        summary.appendMarkdown(`- **Font Family:** ${settings.terminal.fontFamily || 'Default'}\n`);
        summary.appendMarkdown(`- **Cursor Style:** ${settings.terminal.cursorStyle}\n`);
        summary.appendMarkdown(`- **Cursor Blink:** ${settings.terminal.cursorBlink ? 'Yes' : 'No'}\n`);
        summary.appendMarkdown(`- **Scrollback:** ${settings.terminal.scrollback} lines\n\n`);
        
        summary.appendMarkdown('### UI\n');
        summary.appendMarkdown(`- **Show Welcome Screen:** ${settings.ui.showWelcomeScreen ? 'Yes' : 'No'}\n`);
        summary.appendMarkdown(`- **Remember Last Session:** ${settings.ui.rememberLastSession ? 'Yes' : 'No'}\n`);
        summary.appendMarkdown(`- **Session History Limit:** ${settings.ui.sessionHistoryLimit}\n\n`);
        
        summary.appendMarkdown('### Todos\n');
        summary.appendMarkdown(`- **Default Filter:** ${settings.todos.defaultFilter}\n`);
        summary.appendMarkdown(`- **Sort By:** ${settings.todos.sortBy}\n`);
        summary.appendMarkdown(`- **Show Status Bar:** ${settings.todos.showStatusBar ? 'Yes' : 'No'}\n`);
        summary.appendMarkdown(`- **Expand by Default:** ${settings.todos.expandByDefault ? 'Yes' : 'No'}\n\n`);
        
        summary.appendMarkdown('[Open Settings](command:claudePilot.openSettings)');
        
        await vscode.window.showInformationMessage('Claude Pilot Settings', { modal: true }, { title: 'OK' });
    }
}

/**
 * Register settings commands
 */
export function registerSettingsCommands(context: vscode.ExtensionContext): void {
    const commands = new SettingsCommands();
    
    context.subscriptions.push(
        vscode.commands.registerCommand('claudePilot.openSettings', () => commands.openSettings()),
        vscode.commands.registerCommand('claudePilot.setTerminalFontSize', () => commands.setTerminalFontSize()),
        vscode.commands.registerCommand('claudePilot.setTerminalCursorStyle', () => commands.setTerminalCursorStyle()),
        vscode.commands.registerCommand('claudePilot.toggleWelcomeScreen', () => commands.toggleWelcomeScreen()),
        vscode.commands.registerCommand('claudePilot.toggleTodoStatusBar', () => commands.toggleTodoStatusBar()),
        vscode.commands.registerCommand('claudePilot.setDefaultTodoFilter', () => commands.setDefaultTodoFilter()),
        vscode.commands.registerCommand('claudePilot.resetSettings', () => commands.resetSettings()),
        vscode.commands.registerCommand('claudePilot.showSettingsSummary', () => commands.showSettingsSummary())
    );
}