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

        const xtermUri = webviewView.webview.asWebviewUri(vscode.Uri.file(xtermPath));
        const xtermCssUri = webviewView.webview.asWebviewUri(vscode.Uri.file(xtermCssPath));
        const fitAddonUri = webviewView.webview.asWebviewUri(vscode.Uri.file(fitAddonPath));

        webviewView.webview.html = this._getHtmlForWebview(xtermUri, xtermCssUri, fitAddonUri);

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

    private _getHtmlForWebview(xtermUri: vscode.Uri, xtermCssUri: vscode.Uri, fitAddonUri: vscode.Uri) {
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
            overflow: hidden;
        }
        #terminal {
            height: calc(100vh - 24px);
            width: 100%;
        }
        .xterm {
            font-family: 'Consolas', 'Monaco', 'Menlo', monospace;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div id="terminal"></div>
    
    <script src="${xtermUri}"></script>
    <script src="${fitAddonUri}"></script>
    <script>
        const vscode = acquireVsCodeApi();
        
        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Consolas, Monaco, Menlo, monospace',
            theme: {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#ffffff',
                selection: '#264f78'
            }
        });
        
        const fitAddon = new FitAddon.FitAddon();
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