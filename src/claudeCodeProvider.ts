import * as vscode from "vscode";
import { PtyManager } from "./terminal/ptyManager";
import { TemplateUtils } from "./utils/templateUtils";
import { SessionReader } from "./utils/sessionReader";

export class ClaudeCodeProvider {
  public static readonly viewType = "claudePilotView";
  private static _instance?: ClaudeCodeProvider;
  private _panel?: vscode.WebviewPanel;
  private _ptyManager?: PtyManager;
  private _terminalInitialized = false;

  constructor(private readonly _extensionUri: vscode.Uri) {
    ClaudeCodeProvider._instance = this;
  }

  public static getInstance(): ClaudeCodeProvider | undefined {
    return ClaudeCodeProvider._instance;
  }

  public createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (this._panel) {
      this._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel with retainContextWhenHidden enabled
    this._panel = vscode.window.createWebviewPanel(
      ClaudeCodeProvider.viewType,
      "Claude Pilot",
      column || vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        enableForms: true,
        enableCommandUris: true,
        localResourceRoots: [this._extensionUri],
        retainContextWhenHidden: true,
        enableFindWidget: true,
      }
    );

    // Always include a unique timestamp to force webview refresh (from PostgreSQL extension pattern)
    const timeNow = new Date().getTime();
    this._panel.webview.html = TemplateUtils.getHtmlTemplate(
      this._extensionUri,
      this._panel.webview,
      timeNow
    );

    // Initialize PTY manager but don't start it yet - wait for menu selection
    if (!this._ptyManager) {
      this._ptyManager = new PtyManager((data: string) => {
        if (this._panel) {
          this._panel.webview.postMessage({ command: "data", data });
        }
      });
    } else {
      // PTY already exists - just update the data callback
      this._ptyManager.updateDataCallback((data: string) => {
        if (this._panel) {
          this._panel.webview.postMessage({ command: "data", data });
        }
      });
      // If PTY already exists, we should initialize terminal immediately
      this._panel.webview.postMessage({ command: "initializeTerminal" });
      this._terminalInitialized = true;
    }

    // Handle disposal
    this._panel.onDidDispose(
      () => {
        this._panel = undefined;
      },
      null,
      context.subscriptions
    );

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "data":
            this._ptyManager?.write(message.data);
            break;
          case "resize":
            this._ptyManager?.resize(message.cols, message.rows);
            break;
          case "fileDrop":
            this._handleDroppedFile(
              message.fileName,
              message.fileType,
              message.fileSize,
              message.fileData
            );
            break;
          case "openFile":
            this._handleOpenFile(message.filePath);
            break;
          case "menuSelection":
            // Handle menu selection
            if (!this._terminalInitialized && this._ptyManager) {
              this._ptyManager.start(message.selectedCommand);
              this._terminalInitialized = true;
              // Tell webview to initialize terminal UI
              if (this._panel) {
                this._panel.webview.postMessage({ command: "initializeTerminal" });
              }
            }
            break;
          case "requestSessions":
            // Handle request for Claude sessions
            this._handleSessionRequest(message.workspacePath);
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  }

  public refresh() {
    if (this._panel) {
      this._panel.webview.postMessage({ command: "refresh" });
    }
  }

  public forceRedraw() {
    if (this._panel) {
      this._panel.webview.postMessage({ command: "redraw" });
    }
  }

  public triggerResize() {
    if (this._panel) {
      this._panel.webview.postMessage({ command: "triggerResize" });
    }
  }

  public async openTerminal(context: vscode.ExtensionContext) {
    this.createOrShow(context);
  }

  public sendFilePath(filePath: string) {
    this._ptyManager?.sendFilePath(filePath);
  }

  private async _handleDroppedFile(
    fileName: string,
    fileType: string,
    _fileSize: number,
    fileData: string
  ) {
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
      console.error("Failed to open file:", error);
    }
  }

  private async _handleSessionRequest(workspacePath: string) {
    try {
      const sessions = await SessionReader.listProjectSessions(workspacePath);
      if (this._panel) {
        this._panel.webview.postMessage({ 
          command: "sessionData", 
          sessions: sessions 
        });
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      if (this._panel) {
        this._panel.webview.postMessage({ 
          command: "sessionData", 
          sessions: [] 
        });
      }
    }
  }


  public dispose() {
    this._ptyManager?.dispose();
  }
}
