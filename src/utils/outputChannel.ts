/**
 * Output Channel Manager for Claude Pilot
 * 
 * Manages the VS Code output channel for displaying PTY buffer stream
 * and other extension debug information.
 */

import * as vscode from 'vscode';

export class OutputChannelManager {
    private static instance: OutputChannelManager | undefined;
    private outputChannel: vscode.OutputChannel;
    private readonly channelName = 'Claude Pilot';
    private isEnabled = true;
    private stripAnsiCodes = true;
    private logLevel: 'error' | 'warning' | 'info' | 'debug' = 'info';
    
    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel(this.channelName, 'log');
        this.loadConfiguration();
        this.initialize();
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('claudePilot.outputChannel')) {
                this.loadConfiguration();
            }
        });
    }
    
    /**
     * Get singleton instance of OutputChannelManager
     */
    public static getInstance(): OutputChannelManager {
        if (!OutputChannelManager.instance) {
            OutputChannelManager.instance = new OutputChannelManager();
        }
        return OutputChannelManager.instance;
    }
    
    /**
     * Initialize the output channel
     */
    private initialize(): void {
        this.appendLine('Claude Pilot Output Channel initialized');
        this.appendLine(`Timestamp: ${new Date().toISOString()}`);
        this.appendLine('─'.repeat(60));
        
        // Show on startup if configured
        const config = vscode.workspace.getConfiguration('claudePilot.outputChannel');
        if (config.get<boolean>('showOnStartup', false)) {
            this.show();
        }
    }
    
    /**
     * Load configuration from VS Code settings
     */
    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('claudePilot.outputChannel');
        this.isEnabled = config.get<boolean>('enabled', true);
        this.stripAnsiCodes = config.get<boolean>('stripAnsiCodes', true);
        this.logLevel = config.get<'error' | 'warning' | 'info' | 'debug'>('logLevel', 'info');
    }
    
    /**
     * Append a line to the output channel
     */
    public appendLine(message: string): void {
        if (this.isEnabled) {
            this.outputChannel.appendLine(`[${this.getTimestamp()}] ${message}`);
        }
    }
    
    /**
     * Append text without newline to the output channel
     */
    public append(text: string): void {
        if (this.isEnabled) {
            this.outputChannel.append(text);
        }
    }
    
    /**
     * Append PTY data to the output channel
     */
    public appendPtyData(data: string): void {
        if (this.isEnabled && this.shouldLog('debug')) {
            // Remove ANSI escape sequences if configured
            const outputData = this.stripAnsiCodes ? this.stripAnsiCodesFromText(data) : data;
            if (outputData.trim()) {
                this.outputChannel.append(outputData);
            }
        }
    }
    
    /**
     * Append raw PTY data (including ANSI codes) to the output channel
     */
    public appendRawPtyData(data: string): void {
        if (this.isEnabled) {
            this.outputChannel.append(`[PTY RAW] ${data}`);
        }
    }
    
    /**
     * Clear the output channel
     */
    public clear(): void {
        this.outputChannel.clear();
    }
    
    /**
     * Show the output channel
     */
    public show(preserveFocus = true): void {
        this.outputChannel.show(preserveFocus);
    }
    
    /**
     * Hide the output channel
     */
    public hide(): void {
        this.outputChannel.hide();
    }
    
    /**
     * Enable or disable output channel logging
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        if (enabled) {
            this.appendLine('Output channel logging enabled');
        }
    }
    
    /**
     * Check if output channel logging is enabled
     */
    public getEnabled(): boolean {
        return this.isEnabled;
    }
    
    /**
     * Dispose of the output channel
     */
    public dispose(): void {
        this.outputChannel.dispose();
        OutputChannelManager.instance = undefined;
    }
    
    /**
     * Get formatted timestamp
     */
    private getTimestamp(): string {
        const now = new Date();
        return now.toTimeString().split(' ')[0]; // HH:MM:SS format
    }
    
    /**
     * Strip ANSI escape codes from text
     */
    private stripAnsiCodesFromText(text: string): string {
        // eslint-disable-next-line no-control-regex
        return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    }
    
    /**
     * Check if a message should be logged based on current log level
     */
    private shouldLog(level: 'error' | 'warning' | 'info' | 'debug'): boolean {
        const levels = ['error', 'warning', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex <= currentLevelIndex;
    }
    
    /**
     * Log session start
     */
    public logSessionStart(sessionId: string): void {
        if (this.shouldLog('info')) {
            this.appendLine('─'.repeat(60));
            this.appendLine(`SESSION START: ${sessionId}`);
            this.appendLine('─'.repeat(60));
        }
    }
    
    /**
     * Log session end
     */
    public logSessionEnd(sessionId: string): void {
        if (this.shouldLog('info')) {
            this.appendLine('─'.repeat(60));
            this.appendLine(`SESSION END: ${sessionId}`);
            this.appendLine('─'.repeat(60));
        }
    }
    
    /**
     * Log an error
     */
    public logError(error: Error | string): void {
        if (this.shouldLog('error')) {
            const errorMessage = error instanceof Error ? error.message : error;
            this.appendLine(`[ERROR] ${errorMessage}`);
            if (error instanceof Error && error.stack) {
                this.appendLine(`[STACK] ${error.stack}`);
            }
        }
    }
    
    /**
     * Log a warning
     */
    public logWarning(warning: string): void {
        if (this.shouldLog('warning')) {
            this.appendLine(`[WARN] ${warning}`);
        }
    }
    
    /**
     * Log debug information
     */
    public logDebug(message: string): void {
        if (this.shouldLog('debug')) {
            this.appendLine(`[DEBUG] ${message}`);
        }
    }
}