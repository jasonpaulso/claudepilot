import * as vscode from 'vscode';
import { PtyManager } from './terminal/ptyManager';
import { TemplateUtils } from './utils/templateUtils';

export class ClaudeCodeProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'claudePilotView';
    private static _instance?: ClaudeCodeProvider;
    private _view?: vscode.WebviewView;
    private _ptyManager?: PtyManager;
    private _terminalInitialized = false;

    constructor(private readonly _extensionUri: vscode.Uri) {
        ClaudeCodeProvider._instance = this;
    }

    public static getInstance(): ClaudeCodeProvider | undefined {
        return ClaudeCodeProvider._instance;
    }

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

        // Always include a unique timestamp to force webview refresh (from PostgreSQL extension pattern)
        const timeNow = new Date().getTime();
        webviewView.webview.html = TemplateUtils.getHtmlTemplate(this._extensionUri, webviewView.webview, timeNow);

        // Initialize PTY manager
        this._ptyManager = new PtyManager((data: string) => {
            if (this._view) {
                this._view.webview.postMessage({ command: 'data', data });
            }
        });

        this._ptyManager.start();
        this._terminalInitialized = true;

        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'data':
                        this._ptyManager?.write(message.data);
                        break;
                    case 'resize':
                        this._ptyManager?.resize(message.cols, message.rows);
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

    public async openTerminal() {
        if (this._view) {
            this._view.show?.(true);
        } else {
            await vscode.commands.executeCommand('workbench.view.extension.claudePilotContainer');
        }
    }

}