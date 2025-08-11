import { EventEmitter } from "events";
import * as http from "http";
import * as url from "url";
import * as vscode from "vscode";

export interface HookPayload {
  type: "UserPromptSubmit" | "PostToolUse" | "PreToolUse";
  sessionId: string;
  timestamp: string;
  data: any;
}

export class HookServer extends EventEmitter {
  private server: http.Server | null = null;
  private port: number = 0;
  private isRunning: boolean = false;
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    super();
    this.context = context;
  }

  /**
   * Start the HTTP server on a random available port
   */
  async start(): Promise<number> {
    if (this.isRunning) {
      return this.port;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Listen on a random port
      this.server.listen(0, "127.0.0.1", () => {
        const address = this.server!.address();
        if (address && typeof address !== "string") {
          this.port = address.port;
          this.isRunning = true;
          console.log(`Claude Pilot Hook Server started on port ${this.port}`);
          resolve(this.port);
        } else {
          reject(new Error("Failed to get server port"));
        }
      });

      this.server.on("error", (error) => {
        console.error("Hook server error:", error);
        reject(error);
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server || !this.isRunning) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.isRunning = false;
        this.port = 0;
        console.log("Claude Pilot Hook Server stopped");
        resolve();
      });
    });
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    if (!this.isRunning) {
      throw new Error("Server is not running");
    }
    return `http://127.0.0.1:${this.port}`;
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) {
    // Enable CORS for local requests
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    const parsedUrl = url.parse(req.url || "", true);
    const pathname = parsedUrl.pathname || "";

    try {
      const body = await this.parseBody(req);

      switch (pathname) {
        case "/hook/session":
          await this.handleSessionHook(body, res);
          break;
        case "/hook/todo":
          await this.handleTodoHook(body, res);
          break;
        case "/hook/general":
          await this.handleGeneralHook(body, res);
          break;
        default:
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
      }
    } catch (error) {
      console.error("Error handling hook request:", error);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }

  /**
   * Parse request body
   */
  private parseBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
      req.on("error", reject);
    });
  }

  /**
   * Handle session-related hooks
   */
  private async handleSessionHook(data: any, res: http.ServerResponse) {
    console.log("Received session hook:", data);

    // Store session info in extension context
    const sessionInfo = {
      sessionId: data.session_id,
      transcriptPath: data.transcript_path,
      cwd: data.cwd,
      lastPrompt: data.prompt,
      timestamp: new Date().toISOString(),
    };

    await this.context.globalState.update("currentSession", sessionInfo);

    // Emit event for other components
    this.emit("sessionUpdate", sessionInfo);

    // Respond with success
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        suppressOutput: true,
      })
    );
  }

  /**
   * Handle todo-related hooks
   */
  private async handleTodoHook(data: any, res: http.ServerResponse) {
    console.log("Received todo hook:", data);

    // Check if this is a TodoWrite tool
    if (data.tool_name === "TodoWrite") {
      const todoUpdate = {
        type: "todo_update",
        sessionId: data.session_id,
        timestamp: new Date().toISOString(),
        todos: data.tool_input?.todos || [],
        toolResponse: data.tool_response,
      };

      // Store in context for persistence
      await this.context.globalState.update("latestTodoUpdate", todoUpdate);

      // Emit event for TodoManager
      this.emit("todoUpdate", todoUpdate);
    }

    // Respond with success
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        suppressOutput: true,
      })
    );
  }

  /**
   * Handle general hooks
   */
  private async handleGeneralHook(data: any, res: http.ServerResponse) {
    console.log("Received general hook:", data);

    // Emit as general hook event
    this.emit("hook", {
      type: data.hook_type,
      sessionId: data.session_id,
      timestamp: new Date().toISOString(),
      data: data,
    });

    // Respond with success
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        suppressOutput: true,
      })
    );
  }
}
