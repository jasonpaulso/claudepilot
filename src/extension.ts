import * as vscode from "vscode";
import { ClaudeCodeProvider } from "./claudeCodeProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("Claude Pilot extension is now active!");

  const provider = new ClaudeCodeProvider(context.extensionUri);

  // Register the WebviewView provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ClaudeCodeProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1000
  );
  statusBarItem.text = "$(robot) Claude";
  statusBarItem.tooltip = "Open Claude Pilot";
  statusBarItem.command = "claudePilot.openTerminal";
  statusBarItem.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.prominentBackground"
  );
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand("claudePilot.refresh", () => {
      provider.refresh();
    }),
    vscode.commands.registerCommand("claudePilot.reinitialize", () => {
      provider.reinitialize();
    }),
    vscode.commands.registerCommand("claudePilot.openTerminal", async () => {
      await provider.openTerminal();
    }),
    vscode.commands.registerCommand("claudePilot.focus", async () => {
      await vscode.commands.executeCommand('claudePilotView.focus');
    })
  );
}

export function deactivate() {}
