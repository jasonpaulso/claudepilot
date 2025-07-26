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
            enableForms: true,
            enableCommandUris: true,
            localResourceRoots: [this._extensionUri]
        };

        // Always include a unique timestamp to force webview refresh (from PostgreSQL extension pattern)
        const timeNow = new Date().getTime();
        webviewView.webview.html = TemplateUtils.getHtmlTemplate(this._extensionUri, webviewView.webview, timeNow);

        // Initialize PTY manager or reconnect existing one
        if (!this._ptyManager) {
            this._ptyManager = new PtyManager((data: string) => {
                if (this._view) {
                    this._view.webview.postMessage({ command: 'data', data });
                }
            });
            this._ptyManager.start();
        } else {
            // PTY already exists - just update the data callback
            this._ptyManager.updateDataCallback((data: string) => {
                if (this._view) {
                    this._view.webview.postMessage({ command: 'data', data });
                }
            });
        }

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
                    case 'fileDrop':
                        this._handleDroppedFile(message.fileName, message.fileType, message.fileSize, message.fileData);
                        break;
                    case 'openFile':
                        this._handleOpenFile(message.filePath);
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

    public forceRedraw() {
        if (this._view) {
            this._view.webview.postMessage({ command: 'redraw' });
        }
    }

    public triggerResize() {
        if (this._view) {
            this._view.webview.postMessage({ command: 'triggerResize' });
        }
    }

    public async openTerminal() {
        if (this._view) {
            this._view.show?.(true);
        } else {
            await vscode.commands.executeCommand('workbench.view.extension.claudePilotContainer');
        }
    }

    public sendFilePath(filePath: string) {
        this._ptyManager?.sendFilePath(filePath);
    }

    private async _handleDroppedFile(fileName: string, fileType: string, fileSize: number, fileData: string) {
        if (fileData) {
            // All files get saved to temp files for Claude to access
            await this._ptyManager?.sendFileData(fileData, fileName, fileType);
        } else {
            this._ptyManager?.write(`Failed to read file: ${fileName}\n`);
        }
    }

    private async _handleOpenFile(filePath: string) {
        try {
            const uri = vscode.Uri.file(filePath);
            await vscode.window.showTextDocument(uri);
        } catch (error) {
            console.error('Failed to open file:', error);
        }
    }

    public dispose() {
        this._ptyManager?.dispose();
    }

}