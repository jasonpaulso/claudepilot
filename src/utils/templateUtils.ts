/**
 * Template Utilities for Webview HTML Generation
 * 
 * Purpose:
 * - Generate HTML templates for the Claude Pilot terminal webview
 * - Handle xterm.js library loading and configuration
 * - Manage VS Code webview security and resource access
 * 
 * Responsibilities:
 * - Build complete HTML documents with proper script loading
 * - Configure xterm.js with VS Code theme integration
 * - Handle resource URI generation for webview security
 * - Provide timestamp-based cache busting for development
 * 
 * Key Features:
 * - Automatic VS Code theme color detection and mapping
 * - WebGL/Canvas rendering with automatic fallback
 * - Proper drag-drop event handling
 * - Terminal state persistence via VS Code API
 * 
 * Notes:
 * - All resource paths must be converted to webview URIs for security
 * - Template includes inline JavaScript for immediate execution
 * - Timestamp parameter forces refresh during development
 * - Follows VS Code webview best practices for script loading
 */

import * as vscode from 'vscode';
import * as path from 'path';

export class TemplateUtils {
    public static getHtmlTemplate(
        extensionUri: vscode.Uri, 
        webview: vscode.Webview, 
        timestamp: number
    ): string {
        // Build paths to xterm.js resources
        const xtermPath = path.join(__dirname, '..', '..', 'node_modules', '@xterm', 'xterm', 'lib', 'xterm.js');
        const xtermCssPath = path.join(__dirname, '..', '..', 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css');
        const fitAddonPath = path.join(__dirname, '..', '..', 'node_modules', '@xterm', 'addon-fit', 'lib', 'addon-fit.js');
        const canvasAddonPath = path.join(__dirname, '..', '..', 'node_modules', '@xterm', 'addon-canvas', 'lib', 'addon-canvas.js');

        // Convert to webview URIs for security
        const xtermUri = webview.asWebviewUri(vscode.Uri.file(xtermPath));
        const xtermCssUri = webview.asWebviewUri(vscode.Uri.file(xtermCssPath));
        const fitAddonUri = webview.asWebviewUri(vscode.Uri.file(fitAddonPath));
        const canvasAddonUri = webview.asWebviewUri(vscode.Uri.file(canvasAddonPath));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Code Terminal</title>
    <!-- Timestamp ${timestamp} to force webview refresh -->
    <link rel="stylesheet" href="${xtermCssUri}" />
    <style>
        body {
            margin: 0;
            padding: 12px;
            background-color: transparent;
            color: #d4d4d4;
            font-family: 'Consolas', 'Monaco', 'Menlo', monospace;
            overflow: hidden;
        }
        #terminal {
            height: calc(100vh - 24px);
            width: 100%;
            box-sizing: border-box;
        }
        .xterm {
            font-family: inherit;
            font-size: 14px;
        }
        .xterm .xterm-viewport {
            background-color: transparent !important;
        }
        .xterm .xterm-screen {
            background-color: transparent !important;
        }
    </style>
</head>
<body>
    <div id="terminal"></div>
    
    <script src="${xtermUri}"></script>
    <script src="${fitAddonUri}"></script>
    <script src="${canvasAddonUri}"></script>
    <script>
        console.log('Claude Pilot webview loaded at time ${timestamp}ms');
        
        const vscode = acquireVsCodeApi();
        
        // Try to restore previous state
        const previousState = vscode.getState();
        let terminalHasContent = previousState ? previousState.hasContent : false;
        
        // Get computed styles from body element
        const bodyStyles = window.getComputedStyle(document.body);
        
        // Helper function to get VS Code theme color from CSS variables
        function getThemeColor(variable, fallback) {
            const color = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
            return color || fallback;
        }
        
        // Build terminal theme using panel background for consistency
        const terminalTheme = {
            background: getThemeColor('--vscode-panel-background', bodyBgColor || 'transparent'),
            foreground: getThemeColor('--vscode-terminal-foreground', '#cccccc'),
            cursor: getThemeColor('--vscode-terminal-selectionForeground', '#ffffff'),
            cursorAccent: getThemeColor('--vscode-terminal-background', '#1e1e1e'),
            selection: getThemeColor('--vscode-terminal-selectionBackground', '#264f78'),
            black: getThemeColor('--vscode-terminal-ansiBlack', '#000000'),
            red: getThemeColor('--vscode-terminal-ansiRed', '#cd3131'),
            green: getThemeColor('--vscode-terminal-ansiGreen', '#0dbc79'),
            yellow: getThemeColor('--vscode-terminal-ansiYellow', '#e5e510'),
            blue: getThemeColor('--vscode-terminal-ansiBlue', '#2472c8'),
            magenta: getThemeColor('--vscode-terminal-ansiMagenta', '#bc3fbc'),
            cyan: getThemeColor('--vscode-terminal-ansiCyan', '#11a8cd'),
            white: getThemeColor('--vscode-terminal-ansiWhite', '#e5e5e5'),
            brightBlack: getThemeColor('--vscode-terminal-ansiBrightBlack', '#666666'),
            brightRed: getThemeColor('--vscode-terminal-ansiBrightRed', '#f14c4c'),
            brightGreen: getThemeColor('--vscode-terminal-ansiBrightGreen', '#23d18b'),
            brightYellow: getThemeColor('--vscode-terminal-ansiBrightYellow', '#f5f543'),
            brightBlue: getThemeColor('--vscode-terminal-ansiBrightBlue', '#3b8eea'),
            brightMagenta: getThemeColor('--vscode-terminal-ansiBrightMagenta', '#d670d6'),
            brightCyan: getThemeColor('--vscode-terminal-ansiBrightCyan', '#29b8db'),
            brightWhite: getThemeColor('--vscode-terminal-ansiBrightWhite', '#e5e5e5')
        };
        
        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: parseInt(getThemeColor('--vscode-editor-font-size', '14').replace('px', '')) || 14,
            fontFamily: getThemeColor('--vscode-editor-font-family', 'Consolas, Monaco, Menlo, monospace'),
            allowTransparency: true,
            theme: terminalTheme
        });
        
        const fitAddon = new FitAddon.FitAddon();
        const canvasAddon = new CanvasAddon.CanvasAddon();
        terminal.loadAddon(canvasAddon);
        terminal.loadAddon(fitAddon);
        
        terminal.open(document.getElementById('terminal'));
        fitAddon.fit();
        
        terminal.onData((data) => {
            vscode.postMessage({ command: 'data', data });
            
            // Mark that terminal has content
            terminalHasContent = true;
            vscode.setState({ hasContent: true });
        });
        
        terminal.onResize((size) => {
            vscode.postMessage({ command: 'resize', cols: size.cols, rows: size.rows });
        });
        
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'data':
                    terminal.write(message.data);
                    // Mark that terminal has content
                    terminalHasContent = true;
                    vscode.setState({ hasContent: true });
                    break;
                case 'reconnect':
                    // Simple reconnect with fit
                    fitAddon.fit();
                    break;
                case 'redraw':
                    fitAddon.fit();
                    break;
                case 'refresh':
                    location.reload();
                    break;
            }
        });
        
        window.addEventListener('resize', () => {
            setTimeout(() => fitAddon.fit(), 100);
        });
        
        // Initial fit
        setTimeout(() => fitAddon.fit(), 100);
        
        // Simple resize on focus/visibility changes
        window.addEventListener('focus', () => {
            setTimeout(() => fitAddon.fit(), 100);
        });
        
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => fitAddon.fit(), 100);
            }
        });
        
        // Add drag and drop support
        const terminalElement = document.getElementById('terminal');
        
        terminalElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            terminalElement.style.opacity = '0.8';
        });
        
        terminalElement.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            terminalElement.style.opacity = '1';
        });
        
        terminalElement.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            terminalElement.style.opacity = '1';
            
            const files = e.dataTransfer.files;
            const text = e.dataTransfer.getData('text/plain');
            
            if (files.length > 0) {
                // Handle file drops
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (file.type.startsWith('image/')) {
                        // For images, insert the file name
                        terminal.write(file.name + ' ');
                    } else {
                        // For other files, insert the file name
                        terminal.write(file.name + ' ');
                    }
                }
            } else if (text) {
                // Handle text drops
                terminal.write(text);
            }
        });
    </script>
</body>
</html>`;
    }
}
