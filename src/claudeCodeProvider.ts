import * as vscode from 'vscode';
import * as pty from '@lydell/node-pty';
import * as path from 'path';

export class ClaudeCodeProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'claudePilot';
    private _view?: vscode.WebviewView;
    private _ptyProcess?: pty.IPty;

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

        // Get VS Code theme colors
        const colorTheme = vscode.window.activeColorTheme;
        const isLight = colorTheme.kind === vscode.ColorThemeKind.Light;
        
        webviewView.webview.html = this._getHtmlForWebview(xtermUri, xtermCssUri, fitAddonUri, canvasAddonUri, isLight);

        // Use user's default shell with login shell flag
        const shell = process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
        const shellArgs = process.platform === 'win32' ? [] : ['-l'];
        
        this._ptyProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-256color',
            cols: 80,
            rows: 30,
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
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

    private _getHtmlForWebview(xtermUri: vscode.Uri, xtermCssUri: vscode.Uri, fitAddonUri: vscode.Uri, canvasAddonUri: vscode.Uri, isLight: boolean) {
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
        const backgroundColor = bodyStyles.backgroundColor || '#1e1e1e';
        
        // Use appropriate terminal colors based on VS Code theme
        const terminalBackgroundColor = ${isLight ? "'#f3f3f3'" : "'#252526'"};
        const terminalForegroundColor = ${isLight ? "'#000000'" : "'#cccccc'"};
        const color = terminalForegroundColor;
        
        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: bodyStyles.fontFamily || 'Consolas, Monaco, Menlo, monospace',
            allowTransparency: true,
            theme: {
                background: undefined,
                foreground: color,
                cursor: ${isLight ? "'#000000'" : "'#ffffff'"},
                cursorAccent: terminalBackgroundColor,
                selection: ${isLight ? "'#add6ff'" : "'#264f78'"},
                black: ${isLight ? "'#000000'" : "'#000000'"},
                red: ${isLight ? "'#cd3131'" : "'#cd3131'"},
                green: ${isLight ? "'#00bc00'" : "'#0dbc79'"},
                yellow: ${isLight ? "'#949800'" : "'#e5e510'"},
                blue: ${isLight ? "'#0451a5'" : "'#2472c8'"},
                magenta: ${isLight ? "'#bc05bc'" : "'#bc3fbc'"},
                cyan: ${isLight ? "'#0598bc'" : "'#11a8cd'"},
                white: ${isLight ? "'#555555'" : "'#e5e5e5'"},
                brightBlack: ${isLight ? "'#666666'" : "'#666666'"},
                brightRed: ${isLight ? "'#cd3131'" : "'#f14c4c'"},
                brightGreen: ${isLight ? "'#14ce14'" : "'#23d18b'"},
                brightYellow: ${isLight ? "'#b5ba00'" : "'#f5f543'"},
                brightBlue: ${isLight ? "'#0451a5'" : "'#3b8eea'"},
                brightMagenta: ${isLight ? "'#bc05bc'" : "'#d670d6'"},
                brightCyan: ${isLight ? "'#0598bc'" : "'#29b8db'"},
                brightWhite: ${isLight ? "'#a5a5a5'" : "'#e5e5e5'"}
            }
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