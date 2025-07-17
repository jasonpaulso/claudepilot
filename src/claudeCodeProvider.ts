import * as vscode from 'vscode';
import * as pty from '@lydell/node-pty';
import * as path from 'path';

export class ClaudeCodeProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'claudePilot';
    private _view?: vscode.WebviewView;
    private _ptyProcess?: pty.IPty;
    private _shellReady = false;
    private _lastDataTime = 0;
    private _readyTimer?: NodeJS.Timeout;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        const xtermPath = path.join(__dirname, '..', 'node_modules', '@xterm', 'xterm', 'lib', 'xterm.js');
        const xtermCssPath = path.join(__dirname, '..', 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css');
        const fitAddonPath = path.join(__dirname, '..', 'node_modules', '@xterm', 'addon-fit', 'lib', 'addon-fit.js');
        const canvasAddonPath = path.join(__dirname, '..', 'node_modules', '@xterm', 'addon-canvas', 'lib', 'addon-canvas.js');

        const xtermUri = webviewView.webview.asWebviewUri(vscode.Uri.file(xtermPath));
        const xtermCssUri = webviewView.webview.asWebviewUri(vscode.Uri.file(xtermCssPath));
        const fitAddonUri = webviewView.webview.asWebviewUri(vscode.Uri.file(fitAddonPath));
        const canvasAddonUri = webviewView.webview.asWebviewUri(vscode.Uri.file(canvasAddonPath));

        webviewView.webview.html = this._getHtmlForWebview(xtermUri, xtermCssUri, fitAddonUri, canvasAddonUri);

        // Use user's default shell with login shell flag
        const shell = process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
        const shellArgs = process.platform === 'win32' ? [] : ['-l'];
        
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
            webviewView.webview.postMessage({ command: 'data', data });
            
            // Track when data was last received
            this._lastDataTime = Date.now();
            
            // If shell isn't ready yet, start/restart the ready timer
            if (!this._shellReady) {
                this._scheduleReadyCheck();
            }
        });

        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'data':
                        this._ptyProcess?.write(message.data);
                        break;
                    case 'resize':
                        this._ptyProcess?.resize(message.cols, message.rows);
                        break;
                }
            },
            undefined,
            []
        );
    }

    public refresh() {
        if (this._view) {
            this._view.webview.postMessage({ command: 'refresh' });
        }
    }

    public openTerminal() {
        if (this._view) {
            // Focus the view to make it visible
            this._view.show?.(true);
            
            // If there's no active PTY process, the view will recreate it
            if (!this._ptyProcess) {
                this._view.webview.postMessage({ command: 'refresh' });
            }
        }
    }

    private _scheduleReadyCheck() {
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
                // Send claude command after shell has settled
                this._ptyProcess?.write('claude\r');
            }
        }, 1500); // Wait 1.5 seconds for shell to settle
    }

    private _getHtmlForWebview(xtermUri: vscode.Uri, xtermCssUri: vscode.Uri, fitAddonUri: vscode.Uri, canvasAddonUri: vscode.Uri) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Code Terminal</title>
    <link rel="stylesheet" href="${xtermCssUri}" />
    <style>
        body {
            margin: 0;
            padding: 12px;
            background-color: transparent;
            color: #d4d4d4;
            font-family: 'Consolas', 'Monaco', 'Menlo', monospace;
            overflow: hidden;
        }
        #terminal {
            height: calc(100vh - 24px);
            width: 100%;
        }
        .xterm {
            font-family: inherit;
            font-size: 14px;
        }
        .xterm .xterm-viewport {
            background-color: transparent !important;
        }
        .xterm .xterm-screen {
            background-color: transparent !important;
        }
    </style>
</head>
<body>
    <div id="terminal"></div>
    
    <script src="${xtermUri}"></script>
    <script src="${fitAddonUri}"></script>
    <script src="${canvasAddonUri}"></script>
    <script>
        const vscode = acquireVsCodeApi();
        
        // Get computed styles from body element
        const bodyStyles = window.getComputedStyle(document.body);
        
        // Helper function to get VS Code theme color from CSS variables
        function getThemeColor(variable, fallback) {
            const color = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
            return color || fallback;
        }
        
        // Build terminal theme from VS Code CSS variables
        const terminalTheme = {
            background: undefined, // Always transparent for sidebar integration
            foreground: getThemeColor('--vscode-terminal-foreground', '#cccccc'),
            cursor: getThemeColor('--vscode-terminal-selectionForeground', '#ffffff'),
            cursorAccent: getThemeColor('--vscode-terminal-background', '#1e1e1e'),
            selection: getThemeColor('--vscode-terminal-selectionBackground', '#264f78'),
            black: getThemeColor('--vscode-terminal-ansiBlack', '#000000'),
            red: getThemeColor('--vscode-terminal-ansiRed', '#cd3131'),
            green: getThemeColor('--vscode-terminal-ansiGreen', '#0dbc79'),
            yellow: getThemeColor('--vscode-terminal-ansiYellow', '#e5e510'),
            blue: getThemeColor('--vscode-terminal-ansiBlue', '#2472c8'),
            magenta: getThemeColor('--vscode-terminal-ansiMagenta', '#bc3fbc'),
            cyan: getThemeColor('--vscode-terminal-ansiCyan', '#11a8cd'),
            white: getThemeColor('--vscode-terminal-ansiWhite', '#e5e5e5'),
            brightBlack: getThemeColor('--vscode-terminal-ansiBrightBlack', '#666666'),
            brightRed: getThemeColor('--vscode-terminal-ansiBrightRed', '#f14c4c'),
            brightGreen: getThemeColor('--vscode-terminal-ansiBrightGreen', '#23d18b'),
            brightYellow: getThemeColor('--vscode-terminal-ansiBrightYellow', '#f5f543'),
            brightBlue: getThemeColor('--vscode-terminal-ansiBrightBlue', '#3b8eea'),
            brightMagenta: getThemeColor('--vscode-terminal-ansiBrightMagenta', '#d670d6'),
            brightCyan: getThemeColor('--vscode-terminal-ansiBrightCyan', '#29b8db'),
            brightWhite: getThemeColor('--vscode-terminal-ansiBrightWhite', '#e5e5e5')
        };
        
        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: parseInt(getThemeColor('--vscode-editor-font-size', '14').replace('px', '')) || 14,
            fontFamily: getThemeColor('--vscode-editor-font-family', 'Consolas, Monaco, Menlo, monospace'),
            allowTransparency: true,
            theme: terminalTheme
        });
        
        const fitAddon = new FitAddon.FitAddon();
        const canvasAddon = new CanvasAddon.CanvasAddon();
        terminal.loadAddon(canvasAddon);
        terminal.loadAddon(fitAddon);
        
        terminal.open(document.getElementById('terminal'));
        fitAddon.fit();
        
        terminal.onData((data) => {
            vscode.postMessage({ command: 'data', data });
        });
        
        terminal.onResize((size) => {
            vscode.postMessage({ command: 'resize', cols: size.cols, rows: size.rows });
        });
        
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'data':
                    terminal.write(message.data);
                    break;
                case 'refresh':
                    location.reload();
                    break;
            }
        });
        
        window.addEventListener('resize', () => {
            setTimeout(() => fitAddon.fit(), 100);
        });
        
        // Initial fit
        setTimeout(() => fitAddon.fit(), 100);
    </script>
</body>
</html>`;
    }
}