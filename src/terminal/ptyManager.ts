/**
 * PTY Process Manager
 * 
 * Purpose:
 * - Manages the pseudo-terminal (PTY) process that runs the actual shell
 * - Handles shell initialization, command execution, and process lifecycle
 * - Provides the backend for terminal functionality in the webview
 * 
 * Responsibilities:
 * - Spawn and manage the user's default shell with proper environment
 * - Handle shell readiness detection and automatic Claude command execution
 * - Process file drops and convert them to appropriate terminal input
 * - Manage PTY resizing, data flow, and process cleanup
 * 
 * Key Features:
 * - Automatic shell detection (bash/zsh on Unix, cmd on Windows)
 * - Smart shell readiness detection based on data flow timing
 * - Configurable auto-command execution (claude, claude --continue, etc.)
 * - File path handling with proper shell escaping
 * - Image file detection and placeholder generation
 * 
 * Shell Lifecycle:
 * 1. Spawn shell with login flags and proper environment
 * 2. Monitor data flow to detect when shell is ready
 * 3. Execute configured auto-command after shell settles
 * 4. Handle ongoing I/O and resizing
 * 5. Clean up on disposal
 * 
 * Notes:
 * - Uses @lydell/node-pty for cross-platform PTY support
 * - Shell readiness detection prevents commands from being lost
 * - File path escaping is crucial for shell safety
 * - Auto-command respects user configuration settings
 */

import * as vscode from 'vscode';
import * as pty from '@lydell/node-pty';

export class PtyManager {
    private _ptyProcess?: pty.IPty;
    private _shellReady = false;
    private _lastDataTime = 0;
    private _readyTimer?: NodeJS.Timeout;
    private _onDataCallback?: (data: string) => void;

    constructor(onDataCallback?: (data: string) => void) {
        this._onDataCallback = onDataCallback;
    }

    public start(): void {
        // Use user's default shell with login shell flag
        const shell = process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
        const shellArgs = process.platform === 'win32' ? [] : ['-l'];
        
        // Only create new PTY process if one doesn't exist
        if (!this._ptyProcess) {
            // Reset shell ready state for new terminal
            this._shellReady = false;
            this._lastDataTime = 0;
            if (this._readyTimer) {
                clearTimeout(this._readyTimer);
                this._readyTimer = undefined;
            }
            
            this._ptyProcess = pty.spawn(shell, shellArgs, {
                name: 'xterm-256color',
                cols: 80,
                rows: 30,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.env.HOME || process.env.USERPROFILE || process.cwd(),
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor',
                    TERM_PROGRAM: 'vscode',
                    TERM_PROGRAM_VERSION: vscode.version,
                    VSCODE_PID: process.pid.toString()
                } as { [key: string]: string }
            });

            this._ptyProcess.onData((data) => {
                this._onDataCallback?.(data);
                
                // Track when data was last received
                this._lastDataTime = Date.now();
                
                // If shell isn't ready yet, start/restart the ready timer
                if (!this._shellReady) {
                    this._scheduleReadyCheck();
                }
            });
            
            this._ptyProcess.onExit(() => {
                console.log('PTY process exited');
            });
        }
    }

    public updateDataCallback(callback: (data: string) => void): void {
        this._onDataCallback = callback;
    }

    public write(data: string): void {
        this._ptyProcess?.write(data);
    }

    public resize(cols: number, rows: number): void {
        this._ptyProcess?.resize(cols, rows);
    }

    public sendFilePath(filePath: string): void {
        // Escape single quotes for shell safety
        const escapedPath = filePath.replace(/'/g, "\\'");
        this._ptyProcess?.write(`'${escapedPath}' `);
    }

    public async sendFileData(fileData: string, fileName: string, fileType: string): Promise<void> {
        try {
            const os = require('os');
            const path = require('path');
            const fs = require('fs').promises;
            
            const tempDir = os.tmpdir();
            const tempFileName = `claude-pilot-${Date.now()}-${fileName}`;
            const tempFilePath = path.join(tempDir, tempFileName);
            
            // Handle different data formats
            let buffer: Buffer;
            if (fileData.startsWith('data:')) {
                // Data URL format (images, binary files)
                const base64Data = fileData.split(',')[1];
                buffer = Buffer.from(base64Data, 'base64');
            } else {
                // Plain text content
                buffer = Buffer.from(fileData, 'utf8');
            }
            
            await fs.writeFile(tempFilePath, buffer);
            await fs.chmod(tempFilePath, 0o644);
            
            // Send the temp file path
            this._ptyProcess?.write(`'${tempFilePath}' `);
            
        } catch (error) {
            console.error('Error writing file to temp:', error);
            this._ptyProcess?.write(`"${fileName}" `);
        }
    }

    public dispose(): void {
        if (this._readyTimer) {
            clearTimeout(this._readyTimer);
        }
        this._ptyProcess?.kill();
    }

    private _scheduleReadyCheck(): void {
        // Clear any existing timer
        if (this._readyTimer) {
            clearTimeout(this._readyTimer);
        }
        
        // Set a timer to check if shell is ready after data stops flowing
        this._readyTimer = setTimeout(() => {
            // Check if enough time has passed since last data
            const timeSinceLastData = Date.now() - this._lastDataTime;
            if (timeSinceLastData >= 1000 && !this._shellReady) {
                this._shellReady = true;
                
                // Get the configured starting command
                const config = vscode.workspace.getConfiguration('claudePilot');
                const startingCommand = config.get<string>('startingCommand', 'claude');
                
                // Execute the configured command (if not 'none')
                if (startingCommand !== 'none') {
                    this._ptyProcess?.write(`${startingCommand}\r`);
                }
            }
        }, 1500); // Wait 1.5 seconds for shell to settle
    }
}