import * as vscode from "vscode";
import { ClaudeCodeProvider } from "./claudeCodeProvider";
import { TodoManager, TodoTreeProvider, registerTodoCommands, TodoStatusBar } from "./todos";
import { registerSettingsCommands } from "./commands/settingsCommands";
import { OutputChannelManager } from "./utils/outputChannel";

export function activate(context: vscode.ExtensionContext) {
  console.log("Claude Pilot extension is now active!");

  const provider = new ClaudeCodeProvider(context.extensionUri, context);
  
  // Initialize TodoManager and TreeProvider
  const todoManager = new TodoManager();
  const todoTreeProvider = new TodoTreeProvider(todoManager);
  
  // Register the todo tree view
  const todoTreeView = vscode.window.createTreeView('claudePilotTodos', {
    treeDataProvider: todoTreeProvider,
    showCollapseAll: true
  });
  
  // Handle tree item expansion/collapse
  todoTreeView.onDidExpandElement(e => {
    todoTreeProvider.onDidExpandElement(e.element);
  });
  
  todoTreeView.onDidCollapseElement(e => {
    todoTreeProvider.onDidCollapseElement(e.element);
  });
  
  // Register todo commands
  registerTodoCommands(context, todoManager, todoTreeView, todoTreeProvider);
  
  // Register settings commands
  registerSettingsCommands(context);
  
  // Create and register the todo status bar
  const todoStatusBar = new TodoStatusBar(todoManager);
  context.subscriptions.push({
    dispose: () => todoStatusBar.dispose()
  });
  
  // Update activity bar badge with pending todo count
  const updateBadge = () => {
    const stats = todoManager.getTodoStats();
    const pendingCount = stats.pending + stats.inProgress;
    
    if (pendingCount > 0) {
      todoTreeView.badge = {
        tooltip: `${pendingCount} todo${pendingCount > 1 ? 's' : ''} remaining`,
        value: pendingCount
      };
    } else {
      todoTreeView.badge = undefined;
    }
  };
  
  // Update badge on todo changes
  todoManager.on('todoChanged', updateBadge);
  updateBadge();
  
  // Make todoManager available to the provider
  (provider as any).todoManager = todoManager;
  
  // Check for existing Claude session on startup
  setTimeout(async () => {
    const sessionId = await provider.detectSessionId();
    if (sessionId && todoManager) {
      await todoManager.startSession(sessionId);
      console.log(`Started todo tracking for existing session: ${sessionId}`);
    }
  }, 2000); // Wait 2 seconds for terminal to initialize
  
  context.subscriptions.push(
    todoTreeView,
    todoManager,
    todoTreeProvider
  );

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
    }),
    vscode.commands.registerCommand("claudePilot.explainCode", async () => {
      await handleCodeAction(provider, 'explain');
    }),
    vscode.commands.registerCommand("claudePilot.fixCode", async () => {
      await handleCodeAction(provider, 'fix');
    }),
    vscode.commands.registerCommand("claudePilot.improveCode", async () => {
      await handleCodeAction(provider, 'improve');
    }),
    vscode.commands.registerCommand("claudePilot.addToContext", async () => {
      await handleCodeAction(provider, 'context');
    }),
    vscode.commands.registerCommand("claudePilot.addFileToChat", async (uri?: vscode.Uri) => {
      await handleAddFileToChat(provider, uri);
    }),
    vscode.commands.registerCommand("claudePilot.addTerminalToContext", async () => {
      await handleTerminalAction(provider, 'context');
    }),
    vscode.commands.registerCommand("claudePilot.fixTerminalCommand", async () => {
      await handleTerminalAction(provider, 'fix');
    }),
    vscode.commands.registerCommand("claudePilot.explainTerminalCommand", async () => {
      await handleTerminalAction(provider, 'explain');
    }),
    vscode.commands.registerCommand("claudePilot.showOutputChannel", () => {
      const outputChannel = OutputChannelManager.getInstance();
      outputChannel.show();
    })
  );
}

async function handleCodeAction(provider: ClaudeCodeProvider, action: 'explain' | 'fix' | 'improve' | 'context') {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found');
    return;
  }

  // Get selected text or current line
  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);
  const hasSelection = !selection.isEmpty;
  
  // Get file info
  const filePath = editor.document.fileName;
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';
  const languageId = editor.document.languageId;
  
  // Get diagnostics at the selection
  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
  const relevantDiagnostics = diagnostics.filter(diag => {
    return hasSelection ? selection.contains(diag.range) : 
           diag.range.contains(editor.selection.active);
  });
  
  // Build the prompt based on action
  let prompt = '';
  const codeBlock = hasSelection ? selectedText : editor.document.lineAt(selection.active.line).text;
  const location = hasSelection ? 
    `lines ${selection.start.line + 1}-${selection.end.line + 1}` : 
    `line ${selection.active.line + 1}`;
  
  switch (action) {
    case 'explain':
      prompt = `Please explain the following code from ${fileName} (${location}):\n\n\`\`\`${languageId}\n${codeBlock}\n\`\`\``;
      break;
      
    case 'fix':
      if (relevantDiagnostics.length > 0) {
        const diagMessages = relevantDiagnostics.map(d => `- ${d.severity === vscode.DiagnosticSeverity.Error ? 'Error' : 'Warning'}: ${d.message}`).join('\n');
        prompt = `Please fix the following issues in ${fileName} (${location}):\n\n${diagMessages}\n\nCode:\n\`\`\`${languageId}\n${codeBlock}\n\`\`\``;
      } else {
        prompt = `Please review and fix any issues in the following code from ${fileName} (${location}):\n\n\`\`\`${languageId}\n${codeBlock}\n\`\`\``;
      }
      break;
      
    case 'improve':
      prompt = `Please improve the following code from ${fileName} (${location}). Make it more efficient, readable, and follow best practices:\n\n\`\`\`${languageId}\n${codeBlock}\n\`\`\``;
      break;
      
    case 'context':
      prompt = `I'd like to add the following code from ${fileName} (${location}) as context for our discussion:\n\n\`\`\`${languageId}\n${codeBlock}\n\`\`\``;
      break;
  }
  
  // Send to Claude Pilot
  await provider.sendPromptToTerminal(prompt);
}

async function handleAddFileToChat(provider: ClaudeCodeProvider, uri?: vscode.Uri) {
  // Get the URI from the active editor if not provided
  if (!uri) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No file to add to chat');
      return;
    }
    uri = editor.document.uri;
  }
  
  // Get workspace relative path
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  let relativePath = uri.fsPath;
  
  if (workspaceFolder) {
    relativePath = vscode.workspace.asRelativePath(uri, false);
  }
  
  // Send the @filepath to Claude Pilot
  const prompt = `@${relativePath}`;
  await provider.sendPromptToTerminal(prompt);
}

async function handleTerminalAction(provider: ClaudeCodeProvider, action: 'context' | 'fix' | 'explain') {
  try {
    // Try to get terminal content directly from Claude Pilot terminal
    const terminalData = await provider.getTerminalContent();
    let terminalContent = terminalData.selection || terminalData.content;
    
    if (!terminalContent) {
      // Fallback to clipboard method
      const result = await vscode.window.showInformationMessage(
        'Please copy the terminal content you want to send to Claude Pilot first, then click OK.',
        'OK',
        'Cancel'
      );
      
      if (result !== 'OK') {
        return;
      }
      
      terminalContent = await vscode.env.clipboard.readText();
      if (!terminalContent) {
        vscode.window.showErrorMessage('No content found');
        return;
      }
    }
    
    // Build the prompt based on action
    let prompt = '';
    
    switch (action) {
      case 'context':
        prompt = `Terminal output:\n\`\`\`\n${terminalContent}\n\`\`\``;
        break;
        
      case 'fix':
        prompt = `Fix this terminal command:\n\`\`\`\n${terminalContent}\n\`\`\`\n\nPlease:\n1. Identify any issues in the command\n2. Provide the corrected command\n3. Explain what was fixed and why`;
        break;
        
      case 'explain':
        prompt = `Explain this terminal command:\n\`\`\`\n${terminalContent}\n\`\`\`\n\nPlease provide:\n1. What the command does\n2. Explanation of each part/flag\n3. Expected output and behavior`;
        break;
    }
    
    // Send to Claude Pilot
    await provider.sendPromptToTerminal(prompt);
  } catch (error) {
    // If getting content from Claude Pilot fails, it might be a regular VS Code terminal
    // Fall back to clipboard method
    const result = await vscode.window.showInformationMessage(
      'Please copy the terminal content you want to send to Claude Pilot first, then click OK.',
      'OK',
      'Cancel'
    );
    
    if (result !== 'OK') {
      return;
    }
    
    const terminalContent = await vscode.env.clipboard.readText();
    if (!terminalContent) {
      vscode.window.showErrorMessage('No content found in clipboard');
      return;
    }
    
    // Build the prompt based on action
    let prompt = '';
    
    switch (action) {
      case 'context':
        prompt = `Terminal output:\n\`\`\`\n${terminalContent}\n\`\`\``;
        break;
        
      case 'fix':
        prompt = `Fix this terminal command:\n\`\`\`\n${terminalContent}\n\`\`\`\n\nPlease:\n1. Identify any issues in the command\n2. Provide the corrected command\n3. Explain what was fixed and why`;
        break;
        
      case 'explain':
        prompt = `Explain this terminal command:\n\`\`\`\n${terminalContent}\n\`\`\`\n\nPlease provide:\n1. What the command does\n2. Explanation of each part/flag\n3. Expected output and behavior`;
        break;
    }
    
    // Send to Claude Pilot
    await provider.sendPromptToTerminal(prompt);
  }
}

export function deactivate() {}
