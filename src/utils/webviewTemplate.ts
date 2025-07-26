/**
 * Modern webview template generator for Claude Pilot
 */

import * as vscode from 'vscode';
import { getTerminalStyles } from './webviewStyles';
import { getDragDropScript } from './dragDropHandler';
import { getTerminalThemeScript, getTerminalConfig } from './terminalConfig';

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
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let nonce = '';
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
        timestamp: number
    ): string {
        const nonce = this.generateNonce();
        
        return /*html*/`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${
        vscode.workspace.isTrusted ? 'vscode-resource:' : ''
    } data: https:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${
        vscode.workspace.isTrusted ? 'vscode-resource:' : ''
    }; font-src ${vscode.workspace.isTrusted ? 'vscode-resource:' : ''} data:;">
    <title>Claude Pilot Terminal</title>
    <!-- Timestamp ${timestamp} to force refresh -->
    <link rel="stylesheet" href="${resources.xtermCss}">
    <style>${getTerminalStyles()}</style>
</head>
<body>
    <div class="version-overlay">v${version}</div>
    <div id="terminal"></div>
    
    <!-- External libraries -->
    <script nonce="${nonce}" src="${resources.xtermJs}"></script>
    <script nonce="${nonce}" src="${resources.fitAddon}"></script>
    <script nonce="${nonce}" src="${resources.webglAddon}"></script>
    <script nonce="${nonce}" src="${resources.canvasAddon}"></script>
    <script nonce="${nonce}" src="${resources.webLinksAddon}"></script>
    
    <!-- Main terminal script -->
    <script nonce="${nonce}">
        ${this.getMainScript()}
    </script>
</body>
</html>`;
    }
    
    /**
     * Get the main terminal initialization script
     */
    private static getMainScript(): string {
        return `
        (function() {
            'use strict';
            
            const vscode = acquireVsCodeApi();
            
            // Restore state if available
            let terminalHasContent = false;
            const previousState = vscode.getState();
            if (previousState && previousState.hasContent) {
                terminalHasContent = true;
            }
            
            ${getTerminalThemeScript()}
            
            // Initialize terminal
            const terminal = new Terminal(${getTerminalConfig()});
            
            const fitAddon = new FitAddon.FitAddon();
            const webLinksAddon = new WebLinksAddon.WebLinksAddon((event, uri) => {
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
            
            terminal.open(document.getElementById('terminal'));
            fitAddon.fit();
            
            // Focus management
            terminal.focus();
            document.getElementById('terminal').addEventListener('click', () => {
                terminal.focus();
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
            
            // Message handling from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'data':
                        terminal.write(message.data);
                        terminalHasContent = true;
                        vscode.setState({ hasContent: true });
                        break;
                    case 'reconnect':
                    case 'redraw':
                        fitAddon.fit();
                        break;
                    case 'refresh':
                        location.reload();
                        break;
                    case 'triggerResize':
                        window.dispatchEvent(new Event('resize'));
                        break;
                }
            });
            
            // Window event handlers
            window.addEventListener('resize', () => {
                fitAddon.fit();
            });
            
            window.addEventListener('focus', () => {
                setTimeout(() => {
                    fitAddon.fit();
                    terminal.focus();
                }, 100);
            });
            
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    setTimeout(() => {
                        fitAddon.fit();
                        terminal.focus();
                    }, 100);
                }
            });
            
            // Initial fit
            setTimeout(() => fitAddon.fit(), 100);
            
            // Drag and drop handling
            ${getDragDropScript()}
            
            // Initialize drag capture
            if (typeof setupDragCapture === 'function') {
                setupDragCapture();
                console.log('Claude Pilot: Terminal ready');
            }
        })();
        `;
    }
}