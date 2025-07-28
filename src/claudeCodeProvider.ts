import * as vscode from "vscode";
import { SessionManager } from "./session/sessionManager";
import { PtyManager } from "./terminal/ptyManager";
import { TodoManager } from "./todos/todoManager";
import { SessionReader } from "./utils/sessionReader";
import { TemplateUtils } from "./utils/templateUtils";

export class ClaudeCodeProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "claudePilotView";
  private static _instance?: ClaudeCodeProvider;
  private _view?: vscode.WebviewView;
  private _ptyManager?: PtyManager;
  private _terminalInitialized = false;
  private _pendingPrompt?: string;
  private _terminalContentCallbacks = new Map<
    string,
    (content: string, selection: string) => void
  >();
  private _currentSessionId?: string;
  private _sessionManager: SessionManager;
  public todoManager?: TodoManager;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {
    ClaudeCodeProvider._instance = this;
    this._sessionManager = new SessionManager(this._context);
  }

  public static getInstance(): ClaudeCodeProvider | undefined {
    return ClaudeCodeProvider._instance;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      enableForms: true,
      enableCommandUris: true,
      localResourceRoots: [this._extensionUri],
    };

    // Always include a unique timestamp to force webview refresh (from PostgreSQL extension pattern)
    const timeNow = new Date().getTime();
    webviewView.webview.html = TemplateUtils.getHtmlTemplate(
      this._extensionUri,
      webviewView.webview,
      timeNow,
      this._currentSessionId || ""
    );

    // Initialize PTY manager but don't start it yet - wait for menu selection
    if (!this._ptyManager) {
      this._ptyManager = new PtyManager((data: string) => {
        if (this._view) {
          this._view.webview.postMessage({ command: "data", data });
        }
        // Try to extract session ID from output
        this._checkForSessionId(data);
      });
    } else {
      // PTY already exists - just update the data callback
      this._ptyManager.updateDataCallback((data: string) => {
        if (this._view) {
          this._view.webview.postMessage({ command: "data", data });
        }
        // Try to extract session ID from output
        this._checkForSessionId(data);
      });
      // If PTY already exists, we should initialize terminal immediately
      this._view.webview.postMessage({ command: "initializeTerminal" });
      this._terminalInitialized = true;
    }

    webviewView.webview.onDidReceiveMessage((message) => {
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
            this._handleMenuSelection(message.selectedCommand);
          }
          break;
        case "requestSessions":
          // Handle request for Claude sessions
          this._handleSessionRequest(message.workspacePath);
          break;
        case "getTerminalContent":
          // Handle request for terminal content
          if (this._view) {
            this._view.webview.postMessage({
              command: "requestTerminalContent",
              requestId: message.requestId,
            });
          }
          break;
        case "terminalContent":
          // Terminal content received from webview
          this._handleTerminalContent(
            message.content,
            message.selection,
            message.requestId
          );
          break;
      }
    });
  }

  public refresh() {
    if (this._view) {
      this._view.webview.postMessage({ command: "refresh" });
    }
  }

  public forceRedraw() {
    if (this._view) {
      this._view.webview.postMessage({ command: "redraw" });
    }
  }

  public triggerResize() {
    if (this._view) {
      this._view.webview.postMessage({ command: "triggerResize" });
    }
  }

  public reinitialize() {
    if (this._view) {
      // Kill the current PTY if it exists
      if (this._ptyManager) {
        this._ptyManager.dispose();
        this._ptyManager = undefined;
        this._terminalInitialized = false;
      }

      // Clear session ID
      this._currentSessionId = undefined;

      // Re-resolve the webview to show the startup menu again
      const timeNow = new Date().getTime();
      this._view.webview.html = TemplateUtils.getHtmlTemplate(
        this._extensionUri,
        this._view.webview,
        timeNow
      );

      // Create a new PTY manager
      this._ptyManager = new PtyManager((data: string) => {
        if (this._view) {
          this._view.webview.postMessage({ command: "data", data });
        }
        // Try to extract session ID from output
        this._checkForSessionId(data);
      });
    }
  }

  public async openTerminal() {
    if (this._view) {
      this._view.show(true);
    } else {
      // If view doesn't exist yet, reveal the view container
      await vscode.commands.executeCommand("claudePilotView.focus");
    }
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
      if (this._view) {
        this._view.webview.postMessage({
          command: "sessionData",
          sessions: sessions,
        });
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      if (this._view) {
        this._view.webview.postMessage({
          command: "sessionData",
          sessions: [],
        });
      }
    }
  }

  private _setupPromptHandler() {
    if (!this._ptyManager || !this._pendingPrompt) return;

    const prompt = this._pendingPrompt;
    this._pendingPrompt = undefined;

    // Set up a temporary data handler to watch for Claude being ready
    const originalCallback = this._ptyManager["_onDataCallback"];
    let buffer = "";

    this._ptyManager.updateDataCallback((data: string) => {
      // Call original callback
      if (originalCallback) {
        originalCallback(data);
      }

      // Accumulate data
      buffer += data;

      // Check if Claude is ready (look for the Human: prompt)
      if (buffer.includes("Human:") || buffer.includes("Type a message")) {
        // Restore original callback
        this._ptyManager?.updateDataCallback(originalCallback!);

        // Send the prompt after a short delay
        setTimeout(() => {
          this._ptyManager?.write(prompt + "\n");
        }, 100);
      }
    });
  }

  public async sendPromptToTerminal(prompt: string) {
    // Check if there's an active session
    if (!this._view) {
      // No webview, need to open Claude Pilot first
      await this.openTerminal();
      // Wait a bit for terminal to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!this._terminalInitialized || !this._ptyManager) {
      // No active session - bypass the menu and start claude directly

      // First ensure the view is open
      if (!this._view) {
        await this.openTerminal();
      }

      // Set up PTY manager if needed
      if (!this._ptyManager) {
        this._ptyManager = new PtyManager((data: string) => {
          if (this._view) {
            this._view.webview.postMessage({ command: "data", data });
          }
          // Try to extract session ID from output
          this._checkForSessionId(data);
        });
      }

      // Store the prompt to send after Claude is ready
      this._pendingPrompt = prompt;

      // Send a menu bypass command to start Claude immediately
      if (this._view) {
        this._view.webview.postMessage({
          command: "bypassMenuWithCommand",
          selectedCommand: "claude",
        });
      }
    } else {
      // Active session exists - paste the prompt
      // First focus the view
      await vscode.commands.executeCommand("claudePilotView.focus");

      // Send the prompt to the terminal
      this._ptyManager.write(prompt);
    }
  }

  private _handleTerminalContent(
    content: string,
    selection: string,
    requestId: string
  ) {
    const callback = this._terminalContentCallbacks.get(requestId);
    if (callback) {
      callback(content, selection);
      this._terminalContentCallbacks.delete(requestId);
    }
  }

  private async _handleMenuSelection(selectedCommand: string) {
    let finalCommand = selectedCommand;
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // Parse the command to check the base command and extract any existing flags
    const commandParts = selectedCommand.split(" ");
    const baseCommand = commandParts[0]; // "claude"
    const hasFlag = commandParts.length > 1;

    // Check if this is a new session command (just "claude" or "claude" with other flags but no --continue/--resume)
    if (
      baseCommand === "claude" &&
      !selectedCommand.includes("--continue") &&
      !selectedCommand.includes("--resume")
    ) {
      // Generate a new session ID
      const sessionId = this._sessionManager.generateSessionId();
      this._currentSessionId = sessionId;

      // Insert session ID after "claude" but before any other flags
      if (hasFlag) {
        // Reconstruct command with session ID inserted
        finalCommand = `claude --resume ${sessionId} ${commandParts
          .slice(1)
          .join(" ")}`;
      } else {
        finalCommand = `claude --resume ${sessionId}`;
      }

      // Save the session
      await this._sessionManager.saveSession(sessionId, workspacePath);

      // Start todo tracking for new session
      if (this.todoManager) {
        await this.todoManager.startSession(sessionId);
        console.log(`Started todo tracking for session: ${sessionId}`);
      }
    }
    // Check if this is a continue command (need to use last session ID)
    else if (selectedCommand.includes("--continue")) {
      const lastSessionId = await this._sessionManager.getLastSessionId();
      if (lastSessionId) {
        this._currentSessionId = lastSessionId;
        // Replace --continue with --resume <sessionId>
        finalCommand = selectedCommand.replace(
          "--continue",
          `--resume ${lastSessionId}`
        );

        // Start todo tracking for resumed session
        if (this.todoManager) {
          await this.todoManager.startSession(lastSessionId);
          console.log(
            `Started todo tracking for resumed session: ${lastSessionId}`
          );
        }
      }
    }
    // Check if this is a resume command with a specific session ID
    else if (selectedCommand.includes("--resume ")) {
      // Extract session ID from command
      const sessionIdMatch = selectedCommand.match(/--resume ([a-f0-9-]+)/);
      if (sessionIdMatch) {
        this._currentSessionId = sessionIdMatch[1];
        // Save as last session
        await this._sessionManager.saveSession(
          this._currentSessionId,
          workspacePath
        );

        // Start todo tracking for resumed session
        if (this.todoManager) {
          await this.todoManager.startSession(this._currentSessionId);
          console.log(
            `Started todo tracking for resumed session: ${this._currentSessionId}`
          );
        }
      }
    }

    // Start the PTY with the final command
    this._ptyManager!.start(finalCommand);
    this._terminalInitialized = true;

    // Tell webview to initialize terminal UI
    if (this._view) {
      this._view.webview.postMessage({ command: "initializeTerminal" });
    }

    // If we have a pending prompt and started claude, set up handler
    if (this._pendingPrompt && finalCommand.startsWith("claude")) {
      this._setupPromptHandler();
    }
  }

  public async getTerminalContent(): Promise<{
    content: string;
    selection: string;
  }> {
    if (!this._view || !this._terminalInitialized) {
      throw new Error("No active terminal session");
    }

    return new Promise((resolve) => {
      const requestId = Date.now().toString();
      this._terminalContentCallbacks.set(requestId, (content, selection) => {
        resolve({ content, selection });
      });

      // Request terminal content from webview
      this._view!.webview.postMessage({
        command: "requestTerminalContent",
        requestId,
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this._terminalContentCallbacks.has(requestId)) {
          this._terminalContentCallbacks.delete(requestId);
          resolve({ content: "", selection: "" });
        }
      }, 5000);
    });
  }

  public getCurrentSessionId(): string | undefined {
    return this._currentSessionId;
  }

  public async detectSessionId(): Promise<string | undefined> {
    // If we already have a session ID, return it
    if (this._currentSessionId) {
      return this._currentSessionId;
    }

    // Otherwise, try to get it from the terminal buffer
    try {
      const terminalData = await this.getTerminalContent();
      const fullContent = terminalData.content;

      // Try to extract from the buffer
      const sessionId = this._extractSessionId(fullContent);
      if (sessionId) {
        this._currentSessionId = sessionId;
        console.log("Claude session ID detected from buffer:", sessionId);
      }

      return sessionId;
    } catch (error) {
      console.error("Failed to detect session ID:", error);
      return undefined;
    }
  }

  private _checkForSessionId(data: string) {
    if (!this._currentSessionId) {
      const sessionId = this._extractSessionId(data);
      if (sessionId) {
        this._currentSessionId = sessionId;
        console.log("Claude session ID detected:", sessionId);
      }
    }
  }

  private _extractSessionId(content: string): string | undefined {
    // Look for various patterns that might contain the session ID
    // Pattern 1: Session ID in output like "Session: xxxxx-xxxx-xxxx"
    const sessionPattern =
      /Session[:\s]+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const sessionMatch = content.match(sessionPattern);
    if (sessionMatch) {
      return sessionMatch[1];
    }

    // Pattern 2: Starting/Resuming session message
    const resumePattern =
      /(?:Starting|Resuming|Loading) session[:\s]+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const resumeMatch = content.match(resumePattern);
    if (resumeMatch) {
      return resumeMatch[1];
    }

    // Pattern 3: UUID anywhere in recent output (less reliable)
    const uuidPattern =
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const uuidMatch = content.match(uuidPattern);
    if (uuidMatch) {
      return uuidMatch[1];
    }

    return undefined;
  }

  public dispose() {
    this._ptyManager?.dispose();
    if (this.todoManager) {
      this.todoManager.stopSession();
    }
  }
}
