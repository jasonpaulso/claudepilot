import * as vscode from "vscode";
import { ClaudeCodeProvider } from "../claudeCodeProvider";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execAsync = promisify(exec);

export async function registerScmCommands(
  context: vscode.ExtensionContext,
  provider: ClaudeCodeProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("claudePilot.generateCommitMessage", async () => {
      await generateCommitMessage(provider);
    })
  );
}

async function generateCommitMessage(provider: ClaudeCodeProvider) {
  try {
    // Check if we have a workspace
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found");
      return;
    }

    // Check if there are staged changes
    const gitStatusResult = await execAsync("git status --porcelain", {
      cwd: workspaceFolder.uri.fsPath
    });

    const stagedFiles = gitStatusResult.stdout
      .split("\n")
      .filter(line => line.match(/^[MARCD]/))
      .map(line => line.substring(3).trim());

    if (stagedFiles.length === 0) {
      vscode.window.showWarningMessage("No staged changes found. Please stage your changes first.");
      return;
    }

    // Get the diff of staged changes
    const gitDiffResult = await execAsync("git diff --cached", {
      cwd: workspaceFolder.uri.fsPath
    });

    const stagedDiff = gitDiffResult.stdout;

    // Create a temporary file to write the Claude response
    const tempFile = await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(workspaceFolder.uri, ".claude-commit-msg"),
      Buffer.from("")
    );

    // Prepare the prompt for Claude
    const prompt = `Generate a commit message for the following staged changes. 
The commit message should follow conventional commit format (feat:, fix:, chore:, etc.) 
and be concise but descriptive. Output ONLY the commit message, nothing else.

Staged files:
${stagedFiles.join("\n")}

Diff:
\`\`\`diff
${stagedDiff}
\`\`\``;

    // Run Claude in non-interactive mode to generate the commit message
    const commitMsg = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Generating commit message with Claude...",
      cancellable: false
    }, async () => {
      try {
        // Write prompt to temporary file to avoid shell escaping issues
        const promptFilePath = path.join(workspaceFolder.uri.fsPath, ".claude-prompt.txt");
        
        await fs.writeFile(promptFilePath, prompt);
        
        // Use spawn instead of exec to avoid shell interpretation issues
        const result = await new Promise<string>((resolve, reject) => {
          const claudeProcess = spawn("claude", ["-p", prompt], {
            cwd: workspaceFolder.uri.fsPath
          });
          
          let stdout = "";
          let stderr = "";
          
          claudeProcess.stdout.on("data", (data) => {
            stdout += data.toString();
          });
          
          claudeProcess.stderr.on("data", (data) => {
            stderr += data.toString();
          });
          
          claudeProcess.on("close", (code) => {
            if (code === 0) {
              resolve(stdout.trim());
            } else {
              reject(new Error(`Claude process exited with code ${code}: ${stderr}`));
            }
          });
          
          claudeProcess.on("error", (err) => {
            reject(err);
          });
        });
        
        // Clean up prompt file
        try {
          await fs.unlink(promptFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        return result;
      } catch (error) {
        console.error("Error generating commit message:", error);
        vscode.window.showErrorMessage(`Failed to generate commit message: ${error}`);
        return null;
      }
    });

    if (commitMsg) {
      // Clean up the commit message (remove any potential explanations)
      const lines = commitMsg.split("\n");
      const firstNonEmptyLine = lines.find(line => line.trim().length > 0);
      const cleanedMsg = firstNonEmptyLine ? firstNonEmptyLine.trim() : commitMsg;

      // Get the SCM input box
      const gitExtension = vscode.extensions.getExtension("vscode.git");
      if (gitExtension) {
        const git = gitExtension.exports.getAPI(1);
        const repositories = git.repositories;
        
        if (repositories.length > 0) {
          const repository = repositories[0];
          repository.inputBox.value = cleanedMsg;
          
          // Focus on the SCM view
          await vscode.commands.executeCommand("workbench.view.scm");
          
          vscode.window.showInformationMessage("Commit message generated successfully!");
        }
      }
    } else {
      vscode.window.showErrorMessage("Failed to generate commit message");
    }

  } catch (error) {
    console.error("Error in generateCommitMessage:", error);
    vscode.window.showErrorMessage(`Error: ${error}`);
  }
}