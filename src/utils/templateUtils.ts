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

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export class TemplateUtils {
  public static getHtmlTemplate(
    extensionUri: vscode.Uri,
    webview: vscode.Webview,
    timestamp: number
  ): string {
    // Get version from package.json
    const packageJsonPath = path.join(__dirname, "..", "..", "package.json");
    let version = "0.1.0";
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      version = packageJson.version;
    } catch (error) {
      console.warn("Could not read version from package.json:", error);
    }

    // Build paths to xterm.js resources
    const xtermPath = path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      "@xterm",
      "xterm",
      "lib",
      "xterm.js"
    );
    const xtermCssPath = path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      "@xterm",
      "xterm",
      "css",
      "xterm.css"
    );
    const fitAddonPath = path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      "@xterm",
      "addon-fit",
      "lib",
      "addon-fit.js"
    );
    const webglAddonPath = path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      "@xterm",
      "addon-webgl",
      "lib",
      "addon-webgl.js"
    );
    const canvasAddonPath = path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      "@xterm",
      "addon-canvas",
      "lib",
      "addon-canvas.js"
    );
    const webLinksAddonPath = path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      "@xterm",
      "addon-web-links",
      "lib",
      "addon-web-links.js"
    );

    // Convert to webview URIs for security
    const xtermUri = webview.asWebviewUri(vscode.Uri.file(xtermPath));
    const xtermCssUri = webview.asWebviewUri(vscode.Uri.file(xtermCssPath));
    const fitAddonUri = webview.asWebviewUri(vscode.Uri.file(fitAddonPath));
    const webglAddonUri = webview.asWebviewUri(vscode.Uri.file(webglAddonPath));
    const canvasAddonUri = webview.asWebviewUri(
      vscode.Uri.file(canvasAddonPath)
    );
    const webLinksAddonUri = webview.asWebviewUri(
      vscode.Uri.file(webLinksAddonPath)
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Pilot v${version} Terminal</title>
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
        .xterm canvas {
            background-color: transparent !important;
        }
        /* Fix input box styling that might be applied to terminal rows */
        .xterm-rows {
            background: none !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .xterm-row {
            line-height: normal !important;
            height: auto !important;
            background: none !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
        }
        /* Ensure no input-like styling on terminal elements */
        .xterm * {
            -webkit-appearance: none !important;
            appearance: none !important;
        }
        
        /* More aggressive overrides for VS Code webview styling */
        .xterm .xterm-rows > div {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
        }
        
        /* Remove any form-like styling */
        .xterm-rows * {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
        }
        
        /* Fix spacing between lines */
        .xterm-rows > div {
            margin-bottom: 0 !important;
            margin-top: 0 !important;
            line-height: 1.0 !important;
        }
        
        /* Force proper letter spacing on all spans */
        .xterm-rows span {
            letter-spacing: 0 !important;
            display: inline !important;
            white-space: pre !important;
        }
        
        /* Override xterm's character measurement */
        .xterm-char-measure-element {
            letter-spacing: 0 !important;
        }
        
        // /* Reset all input/textarea styles that VS Code might apply */
        // input, textarea {
        //     display: none !important;
        // }
        
        #terminal.drag-over::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(128, 128, 128, 0.3);
            pointer-events: none;
            z-index: 1000;
        }
        .version-overlay {
            position: fixed;
            top: 0px;
            right: 12px;
            font-size: 9px;
            color: rgba(255, 255, 255, 0.15);
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            pointer-events: none;
            z-index: 100;
            user-select: none;
        }
    </style>
</head>
<body>
    <script type="text/javascript">
    let isDragActive = false;
    
    function setupDragCapture() {
        // Use capture phase to intercept events before VS Code
        document.addEventListener('dragenter', handleDragEnter, true);
        document.addEventListener('dragover', handleDragOver, true);
        document.addEventListener('dragleave', handleDragLeave, true);
        document.addEventListener('drop', handleDrop, true);
        document.addEventListener('dragend', handleDragEnd, true);
        
        // Reset on mouse interactions
        document.addEventListener('mouseup', resetAllDragState);
        document.addEventListener('click', resetAllDragState);
    }
    
    function resetAllDragState() {
        isDragActive = false;
        const terminal = document.getElementById('terminal');
        terminal.classList.remove('drag-over');
    }
    
    function handleDragEnd(ev) {
        resetAllDragState();
    }
    
    function handleDragEnter(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        Object.defineProperty(ev, 'shiftKey', { value: true, writable: false });
        dragenter(ev);
    }
    
    function handleDragOver(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        Object.defineProperty(ev, 'shiftKey', { value: true, writable: false });
        dragover(ev);
    }
    
    function handleDragLeave(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        Object.defineProperty(ev, 'shiftKey', { value: true, writable: false });
        dragleave(ev);
    }
    
    function handleDrop(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        Object.defineProperty(ev, 'shiftKey', { value: true, writable: false });
        drop(ev);
    }
    
    function dragenter(ev) {
        isDragActive = true;
        const terminal = document.getElementById('terminal');
        terminal.classList.add('drag-over');
    }
    
    function dragover(ev) {
        // Keep drag active
    }
    
    function dragleave(ev) {
        // Only remove if leaving the document completely
        if (ev.clientX === 0 && ev.clientY === 0) {
            resetAllDragState();
        }
    }
    
    function drop(ev) {
        resetAllDragState();
        
        const files = ev.dataTransfer.files;
        const text = ev.dataTransfer.getData('text/plain');
        
        if (files.length > 0) {
            // Handle file drops with FileReader
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();
                
                reader.onload = function(event) {
                    const fileData = event.target.result;
                    vscode.postMessage({
                        command: 'fileDrop',
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        fileData: fileData
                    });
                };
                
                // Read file based on type
                if (file.type.startsWith('image/') || file.type.startsWith('application/')) {
                    reader.readAsDataURL(file);
                } else {
                    reader.readAsText(file);
                }
            }
        } else if (text) {
            // Handle text drops
            terminal.write(text);
        }
    }
    </script>

    <div id="terminal"></div>
    <div class="version-overlay">v${version}</div>
    
    <script src="${xtermUri}"></script>
    <script src="${fitAddonUri}"></script>
    <script src="${webglAddonUri}"></script>
    <script src="${canvasAddonUri}"></script>
    <script src="${webLinksAddonUri}"></script>
    <script>
        console.log('Claude Pilot webview loaded at time ${timestamp}ms');
        
        const vscode = acquireVsCodeApi();
        
        // Try to restore previous state
        const previousState = vscode.getState();
        let terminalHasContent = previousState ? previousState.hasContent : false;
        
        // Get computed styles from body element  
        const bodyStyles = window.getComputedStyle(document.body);
        const bodyBgColor = bodyStyles.backgroundColor;
        
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
            fontSize: 14,  // Use fixed size to avoid measurement issues
            fontFamily: 'Monaco, Menlo, Consolas, "Courier New", monospace',  // Use fixed font
            lineHeight: 1.0,  // Use standard line height
            letterSpacing: 0,  // Disable letter spacing
            allowTransparency: true,
            theme: terminalTheme,
            scrollback: 1000,  // Match VS Code default
            scrollOnUserInput: false  // Don't auto-scroll to bottom on user input
        });
        
        const fitAddon = new FitAddon.FitAddon();
        const webLinksAddon = new WebLinksAddon.WebLinksAddon((event, uri) => {
            // Handle file paths by opening in VS Code editor
            if (uri.startsWith('/') || uri.match(/^[a-zA-Z]:\\\\/)) {
                vscode.postMessage({ command: 'openFile', filePath: uri });
                return false; // Prevent default browser behavior
            }
            // Allow default behavior for URLs
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
        
        // Focus the terminal to enable input
        terminal.focus();
        
        // Ensure terminal stays focused when clicked
        document.getElementById('terminal').addEventListener('click', () => {
            terminal.focus();
        });
        
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
        
        // Initialize aggressive drag capture after terminal is ready
        if (typeof setupDragCapture === 'function') {
            setupDragCapture();
            console.log('Claude Pilot: Terminal ready, drag capture initialized');
        }
    </script>
</body>
</html>`;
  }
}
