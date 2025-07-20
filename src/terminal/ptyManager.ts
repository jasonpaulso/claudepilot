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
import { spawn } from '@lydell/node-pty';

export class PtyManager {
    private _ptyProcess: any;
    private _lastDataTime: number = 0;
    private _shellReady: boolean = false;
    private _readyTimer: NodeJS.Timeout | undefined;
    private _onDataCallback?: (data: string) => void;

    constructor(onDataCallback?: (data: string) => void) {
        this._onDataCallback = onDataCallback;
    }

    public start(): void {
        // Use user's default shell with login shell flag
        const shell = process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
        const shellArgs = process.platform === 'win32' ? [] : ['-l'];

        this._ptyProcess = spawn(shell, shellArgs, {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.env.HOME,
            env: process.env
        });

        this._ptyProcess.onData((data: string) => {
            this._lastDataTime = Date.now();
            this._onDataCallback?.(data);
            this._scheduleReadyCheck();
        });

        this._ptyProcess.onExit(() => {
            console.log('PTY process exited');
        });
    }

    public write(data: string): void {
        this._ptyProcess?.write(data);
    }

    public resize(cols: number, rows: number): void {
        this._ptyProcess?.resize(cols, rows);
    }

    private _writeToTerminal(text: string): void {
        if (!this._ptyProcess) return;
        this._ptyProcess.write(text);
    }

    public sendFilePath(filePath: string): void {
        // Escape single quotes for shell safety
        const escapedPath = filePath.replace(/'/g, "\\'");
        this._writeToTerminal(`'${escapedPath}'`);
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
            this._writeToTerminal(`'${tempFilePath}'`);
            
        } catch (error) {
            console.error('Error writing file to temp:', error);
            this._writeToTerminal(`"${fileName}"`);
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
                // Send configured claude command after shell has settled
                const config = vscode.workspace.getConfiguration('claudePilot');
                const autoCommand = config.get<string>('autoCommand', 'claude');
                
                if (autoCommand !== 'none') {
                    // Use a slight delay to prevent focus stealing
                    setTimeout(() => {
                        this._ptyProcess?.write(`${autoCommand}\r`);
                    }, 100);
                }
            }
        }, 1500); // Wait 1.5 seconds for shell to settle
    }
}