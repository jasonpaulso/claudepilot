/**
 * Settings Manager for Claude Pilot
 * 
 * Centralized management of VS Code configuration settings
 * Provides type-safe access to all extension settings
 */

import * as vscode from 'vscode';

export interface TerminalSettings {
    fontSize: number;
    fontFamily: string;
    cursorStyle: 'block' | 'underline' | 'bar';
    cursorBlink: boolean;
    scrollback: number;
}

export interface UISettings {
    showWelcomeScreen: boolean;
    rememberLastSession: boolean;
    sessionHistoryLimit: number;
}

export interface TodoSettings {
    defaultFilter: 'all' | 'pending' | 'in_progress' | 'completed';
    sortBy: 'priority' | 'status' | 'content';
    showStatusBar: boolean;
    expandByDefault: boolean;
}

export interface ExperimentalSettings {
    enableAdvancedFeatures: boolean;
}

export interface ClaudePilotSettings {
    startingCommand: string;
    terminal: TerminalSettings;
    ui: UISettings;
    todos: TodoSettings;
    experimental: ExperimentalSettings;
}

export class SettingsManager {
    private static readonly CONFIG_SECTION = 'claudePilot';
    private onSettingsChangedEmitter = new vscode.EventEmitter<ClaudePilotSettings>();
    public readonly onSettingsChanged = this.onSettingsChangedEmitter.event;

    constructor() {
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(SettingsManager.CONFIG_SECTION)) {
                this.onSettingsChangedEmitter.fire(this.getAllSettings());
            }
        });
    }

    /**
     * Get all settings as a typed object
     */
    public getAllSettings(): ClaudePilotSettings {
        const config = vscode.workspace.getConfiguration(SettingsManager.CONFIG_SECTION);
        
        return {
            startingCommand: config.get<string>('startingCommand', 'claude'),
            terminal: {
                fontSize: config.get<number>('terminal.fontSize', 14),
                fontFamily: config.get<string>('terminal.fontFamily', ''),
                cursorStyle: config.get<'block' | 'underline' | 'bar'>('terminal.cursorStyle', 'block'),
                cursorBlink: config.get<boolean>('terminal.cursorBlink', true),
                scrollback: config.get<number>('terminal.scrollback', 1000)
            },
            ui: {
                showWelcomeScreen: config.get<boolean>('ui.showWelcomeScreen', true),
                rememberLastSession: config.get<boolean>('ui.rememberLastSession', true),
                sessionHistoryLimit: config.get<number>('ui.sessionHistoryLimit', 50)
            },
            todos: {
                defaultFilter: config.get<'all' | 'pending' | 'in_progress' | 'completed'>('todos.defaultFilter', 'all'),
                sortBy: config.get<'priority' | 'status' | 'content'>('todos.sortBy', 'priority'),
                showStatusBar: config.get<boolean>('todos.showStatusBar', true),
                expandByDefault: config.get<boolean>('todos.expandByDefault', true)
            },
            experimental: {
                enableAdvancedFeatures: config.get<boolean>('experimental.enableAdvancedFeatures', false)
            }
        };
    }

    /**
     * Get terminal settings
     */
    public getTerminalSettings(): TerminalSettings {
        return this.getAllSettings().terminal;
    }

    /**
     * Get UI settings
     */
    public getUISettings(): UISettings {
        return this.getAllSettings().ui;
    }

    /**
     * Get todo settings
     */
    public getTodoSettings(): TodoSettings {
        return this.getAllSettings().todos;
    }

    /**
     * Update a specific setting
     */
    public async updateSetting<T>(key: string, value: T, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        const config = vscode.workspace.getConfiguration(SettingsManager.CONFIG_SECTION);
        await config.update(key, value, target);
    }

    /**
     * Update terminal settings
     */
    public async updateTerminalSettings(settings: Partial<TerminalSettings>): Promise<void> {
        const promises: Promise<void>[] = [];
        
        if (settings.fontSize !== undefined) {
            promises.push(this.updateSetting('terminal.fontSize', settings.fontSize));
        }
        if (settings.fontFamily !== undefined) {
            promises.push(this.updateSetting('terminal.fontFamily', settings.fontFamily));
        }
        if (settings.cursorStyle !== undefined) {
            promises.push(this.updateSetting('terminal.cursorStyle', settings.cursorStyle));
        }
        if (settings.cursorBlink !== undefined) {
            promises.push(this.updateSetting('terminal.cursorBlink', settings.cursorBlink));
        }
        if (settings.scrollback !== undefined) {
            promises.push(this.updateSetting('terminal.scrollback', settings.scrollback));
        }
        
        await Promise.all(promises);
    }

    /**
     * Update UI settings
     */
    public async updateUISettings(settings: Partial<UISettings>): Promise<void> {
        const promises: Promise<void>[] = [];
        
        if (settings.showWelcomeScreen !== undefined) {
            promises.push(this.updateSetting('ui.showWelcomeScreen', settings.showWelcomeScreen));
        }
        if (settings.rememberLastSession !== undefined) {
            promises.push(this.updateSetting('ui.rememberLastSession', settings.rememberLastSession));
        }
        if (settings.sessionHistoryLimit !== undefined) {
            promises.push(this.updateSetting('ui.sessionHistoryLimit', settings.sessionHistoryLimit));
        }
        
        await Promise.all(promises);
    }

    /**
     * Update todo settings
     */
    public async updateTodoSettings(settings: Partial<TodoSettings>): Promise<void> {
        const promises: Promise<void>[] = [];
        
        if (settings.defaultFilter !== undefined) {
            promises.push(this.updateSetting('todos.defaultFilter', settings.defaultFilter));
        }
        if (settings.sortBy !== undefined) {
            promises.push(this.updateSetting('todos.sortBy', settings.sortBy));
        }
        if (settings.showStatusBar !== undefined) {
            promises.push(this.updateSetting('todos.showStatusBar', settings.showStatusBar));
        }
        if (settings.expandByDefault !== undefined) {
            promises.push(this.updateSetting('todos.expandByDefault', settings.expandByDefault));
        }
        
        await Promise.all(promises);
    }

    /**
     * Reset all settings to defaults
     */
    public async resetToDefaults(): Promise<void> {
        const config = vscode.workspace.getConfiguration(SettingsManager.CONFIG_SECTION);
        const allKeys = [
            'startingCommand',
            'terminal.fontSize',
            'terminal.fontFamily',
            'terminal.cursorStyle',
            'terminal.cursorBlink',
            'terminal.scrollback',
            'ui.showWelcomeScreen',
            'ui.rememberLastSession',
            'ui.sessionHistoryLimit',
            'todos.defaultFilter',
            'todos.sortBy',
            'todos.showStatusBar',
            'todos.expandByDefault',
            'experimental.enableAdvancedFeatures'
        ];
        
        const promises = allKeys.map(key => config.update(key, undefined, vscode.ConfigurationTarget.Global));
        await Promise.all(promises);
    }

    /**
     * Dispose of the settings manager
     */
    public dispose(): void {
        this.onSettingsChangedEmitter.dispose();
    }
}