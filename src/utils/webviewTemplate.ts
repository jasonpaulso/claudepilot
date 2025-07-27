/**
 * Modern webview template generator for Claude Pilot
 */

import * as vscode from "vscode";
import { getDragDropScript } from "./dragDropHandler";
import { getTerminalConfig, getTerminalThemeScript } from "./terminalConfig";
import { getTerminalStyles } from "./webviewStyles";
import { StartupMenu } from "./startupMenu";
import { EnhancedStartupMenu } from "./enhancedStartupMenu";

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
    workspacePath: string = ''
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
    <div class="version-overlay">v${version}</div>
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
        ${this.getMainScript(workspacePath)}
    </script>
</body>
</html>`;
  }

  /**
   * Get the main terminal initialization script
   */
  private static getMainScript(workspacePath: string): string {
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
            
            // Function to initialize terminal after menu selection
            function initializeTerminal() {
                // Initialize terminal
                terminal = new Terminal(${getTerminalConfig()});
                
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
                document.getElementById('terminal').addEventListener('click', () => {
                    terminal.focus();
                });
                
                // Custom keyboard handler for Cmd+Enter, Ctrl+Enter, or Shift+Enter
                terminal.attachCustomKeyEventHandler((event) => {
                    // Check for Cmd+Enter (Mac), Ctrl+Enter (Windows/Linux), or Shift+Enter
                    if (event.type === 'keydown' && event.key === 'Enter' && (event.metaKey || event.ctrlKey || event.shiftKey)) {
                        // Send newline to the PTY process (not just display it)
                        vscode.postMessage({ command: 'data', data: '\\n' });
                        return false; // Prevent default behavior
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
