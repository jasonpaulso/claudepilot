/**
 * Modern webview template generator for Claude Pilot
 */

import * as vscode from "vscode";
import { getDragDropScript } from "./dragDropHandler";
import { EnhancedStartupMenu } from "./enhancedStartupMenu";
import { StartupMenu } from "./startupMenu";
import { getTerminalConfig, getTerminalThemeScript } from "./terminalConfig";
import { getTerminalStyles } from "./webviewStyles";

export interface WebviewResources {
  xtermJs: vscode.Uri;
  xtermCss: vscode.Uri;
  fitAddon: vscode.Uri;
  webglAddon: vscode.Uri;
  canvasAddon: vscode.Uri;
  webLinksAddon: vscode.Uri;
}

export class WebviewTemplate {
  private static readonly NONCE_LENGTH = 32;

  /**
   * Generate a cryptographically secure nonce for CSP
   */
  private static generateNonce(): string {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";
    for (let i = 0; i < this.NONCE_LENGTH; i++) {
      nonce += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return nonce;
  }

  /**
   * Generate the complete HTML for the webview
   */
  public static generateHtml(
    resources: WebviewResources,
    version: string,
    timestamp: number,
    workspacePath: string = "",
    sessionId: string = "",
    terminalSettings?: any
  ): string {
    const nonce = this.generateNonce();

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${
      vscode.workspace.isTrusted ? "vscode-resource:" : ""
    } data: https:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${
      vscode.workspace.isTrusted ? "vscode-resource:" : ""
    }; font-src ${vscode.workspace.isTrusted ? "vscode-resource:" : ""} data:;">
    <title>Claude Pilot Terminal</title>
    <!-- Timestamp ${timestamp} to force refresh -->
    <link rel="stylesheet" href="${resources.xtermCss}">
    <style>
        ${getTerminalStyles()}
        ${StartupMenu.generateMenuStyles()}
        ${EnhancedStartupMenu.generateSessionBrowserStyles()}
    </style>
</head>
<body>
    <div class="version-overlay">s${sessionId} | v${version}</div>
    <div id="startup-menu-container">
        ${StartupMenu.generateMenuHtml()}
    </div>
    <div id="terminal" class="hidden"></div>
    
    <!-- External libraries -->
    <script nonce="${nonce}" src="${resources.xtermJs}"></script>
    <script nonce="${nonce}" src="${resources.fitAddon}"></script>
    <script nonce="${nonce}" src="${resources.webglAddon}"></script>
    <script nonce="${nonce}" src="${resources.canvasAddon}"></script>
    <script nonce="${nonce}" src="${resources.webLinksAddon}"></script>
    
    <!-- Main terminal script -->
    <script nonce="${nonce}">
        ${this.getMainScript(workspacePath, terminalSettings)}
    </script>
</body>
</html>`;
  }

  /**
   * Get the main terminal initialization script
   */
  private static getMainScript(workspacePath: string, terminalSettings?: any): string {
    return `
        (function() {
            'use strict';
            
            const vscode = acquireVsCodeApi();
            
            // Restore state if available
            let terminalHasContent = false;
            let terminalInitialized = false;
            const previousState = vscode.getState();
            if (previousState && previousState.hasContent) {
                terminalHasContent = true;
            }
            
            ${getTerminalThemeScript()}
            
            // Terminal variable will be initialized after menu selection
            let terminal = null;
            let fitAddon = null;
            let webLinksAddon = null;
            
            // Enhanced cursor positioning support
            let lastLineContent = '';
            let promptStartCol = 0;
            
            // Function to initialize terminal after menu selection
            function initializeTerminal() {
                // Initialize terminal
                const terminalSettings = ${JSON.stringify(terminalSettings || {})};
                terminal = new Terminal(${getTerminalConfig(terminalSettings)});

                fitAddon = new FitAddon.FitAddon();
                webLinksAddon = new WebLinksAddon.WebLinksAddon((event, uri) => {
                    // Handle file paths by opening in VS Code editor
                    if (uri.startsWith('/') || uri.match(/^[a-zA-Z]:\\\\/)) {
                        vscode.postMessage({ command: 'openFile', filePath: uri });
                        return false;
                    }
                    return true;
                });
                
                // Try WebGL first, fallback to Canvas if WebGL fails
                try {
                    const webglAddon = new WebglAddon.WebglAddon();
                    terminal.loadAddon(webglAddon);
                    console.log('WebGL renderer loaded successfully');
                } catch (e) {
                    console.log('WebGL failed, falling back to Canvas:', e);
                    const canvasAddon = new CanvasAddon.CanvasAddon();
                    terminal.loadAddon(canvasAddon);
                }
                
                terminal.loadAddon(fitAddon);
                terminal.loadAddon(webLinksAddon);
                
                // Show terminal and hide menu
                document.getElementById('terminal').classList.remove('hidden');
                terminal.open(document.getElementById('terminal'));
                
                // Defer initial fit to ensure container is properly sized
                setTimeout(() => {
                    fitAddon.fit();
                    // Send initial size to backend
                    const dimensions = fitAddon.proposeDimensions();
                    if (dimensions) {
                        vscode.postMessage({ command: 'resize', cols: dimensions.cols, rows: dimensions.rows });
                    }
                }, 50);
                
                // Focus management
                terminal.focus();
                
                // Enhanced mouse click handler for cursor positioning
                document.getElementById('terminal').addEventListener('mousedown', (event) => {
                    if (event.button === 0) { // Left click only
                        // Get click position relative to terminal
                        const rect = event.currentTarget.getBoundingClientRect();
                        const x = event.clientX - rect.left;
                        const y = event.clientY - rect.top;
                        
                        // Get terminal dimensions
                        const cols = terminal.cols;
                        const rows = terminal.rows;
                        
                        // Calculate cell dimensions
                        const cellWidth = rect.width / cols;
                        const cellHeight = rect.height / rows;
                        
                        // Calculate which cell was clicked
                        const clickedCol = Math.floor(x / cellWidth);
                        const clickedRow = Math.floor(y / cellHeight);
                        
                        // Get current cursor position
                        const currentRow = terminal.buffer.active.cursorY;
                        const currentCol = terminal.buffer.active.cursorX;
                        
                        // Only handle clicks on the current line
                        if (clickedRow === currentRow && clickedCol >= 0 && clickedCol < cols) {
                            const delta = clickedCol - currentCol;
                            
                            if (delta !== 0) {
                                // Send cursor movement sequences
                                const moveChar = delta > 0 ? 'C' : 'D';
                                const moveCount = Math.abs(delta);
                                
                                // Send escape sequence to move cursor
                                vscode.postMessage({ 
                                    command: 'data', 
                                    data: '\\x1b[' + moveCount + moveChar 
                                });
                            }
                        }
                    }
                    terminal.focus();
                });
                
                // Custom keyboard handler for Cmd+Enter, Ctrl+Enter, or Shift+Enter
                terminal.attachCustomKeyEventHandler((event) => {
                    if (event.type === 'keydown') {
                        // Check for Cmd+Enter (Mac), Ctrl+Enter (Windows/Linux), or Shift+Enter
                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || event.shiftKey)) {
                            // Send newline to the PTY process (not just display it)
                            vscode.postMessage({ command: 'data', data: '\\n' });
                            return false; // Prevent default behavior
                        }
                    }
                    // Allow all other key events to proceed normally
                    return true;
                });
                
                // Terminal event handlers
                terminal.onData((data) => {
                    vscode.postMessage({ command: 'data', data });
                    terminalHasContent = true;
                    vscode.setState({ hasContent: true });
                });
                
                terminal.onResize((size) => {
                    vscode.postMessage({ command: 'resize', cols: size.cols, rows: size.rows });
                });
                
                terminalInitialized = true;
            }
            
            // Message handling from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'data':
                        if (terminal) {
                            terminal.write(message.data);
                            terminalHasContent = true;
                            vscode.setState({ hasContent: true });
                        }
                        break;
                    case 'reconnect':
                    case 'redraw':
                        if (fitAddon) {
                            fitAddon.fit();
                        }
                        break;
                    case 'refresh':
                        location.reload();
                        break;
                    case 'triggerResize':
                        window.dispatchEvent(new Event('resize'));
                        break;
                    case 'initializeTerminal':
                        if (!terminalInitialized) {
                            initializeTerminal();
                        }
                        break;
                    case 'bypassMenuWithCommand':
                        // Bypass the menu and start with the given command
                        const menu = document.getElementById('startup-menu');
                        if (menu) {
                            menu.classList.add('hidden');
                        }
                        vscode.postMessage({
                            command: 'menuSelection',
                            selectedCommand: message.selectedCommand
                        });
                        break;
                    case 'requestTerminalContent':
                        if (terminal) {
                            // Get terminal buffer content
                            const buffer = terminal.buffer.active;
                            let content = '';
                            
                            // Get last 50 lines of terminal content
                            const linesToGet = Math.min(50, buffer.length);
                            const startLine = Math.max(0, buffer.baseY + buffer.cursorY - linesToGet);
                            
                            for (let i = 0; i < linesToGet; i++) {
                                const line = buffer.getLine(startLine + i);
                                if (line) {
                                    content += line.translateToString(true) + '\\n';
                                }
                            }
                            
                            // Get selection if any
                            const selection = terminal.getSelection();
                            
                            // Send back to extension
                            vscode.postMessage({
                                command: 'terminalContent',
                                content: content.trim(),
                                selection: selection,
                                requestId: message.requestId
                            });
                        }
                        break;
                }
            });
            
            // Window event handlers
            window.addEventListener('resize', () => {
                if (fitAddon && terminalInitialized) {
                    fitAddon.fit();
                }
            });
            
            // Add ResizeObserver for more accurate terminal sizing
            if (window.ResizeObserver) {
                const resizeObserver = new ResizeObserver((entries) => {
                    if (fitAddon && terminalInitialized) {
                        // Use requestAnimationFrame to batch resize operations
                        requestAnimationFrame(() => {
                            fitAddon.fit();
                        });
                    }
                });
                
                // Observe the terminal container once it's created
                const checkTerminal = setInterval(() => {
                    const terminalElement = document.getElementById('terminal');
                    if (terminalElement && !terminalElement.classList.contains('hidden')) {
                        resizeObserver.observe(terminalElement);
                        clearInterval(checkTerminal);
                    }
                }, 100);
            }
            
            window.addEventListener('focus', () => {
                if (fitAddon && terminal && terminalInitialized) {
                    setTimeout(() => {
                        fitAddon.fit();
                        terminal.focus();
                    }, 100);
                }
            });
            
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && fitAddon && terminal && terminalInitialized) {
                    setTimeout(() => {
                        fitAddon.fit();
                        terminal.focus();
                    }, 100);
                }
            });
            
            // Drag and drop handling
            ${getDragDropScript()}
            
            // Initialize drag capture
            if (typeof setupDragCapture === 'function') {
                setupDragCapture();
            }
            
            // Add enhanced startup menu script with session browser support
            ${EnhancedStartupMenu.generateEnhancedMenuScript(workspacePath)}
        })();
        `;
  }
}
