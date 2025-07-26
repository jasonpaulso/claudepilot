/**
 * Terminal Webview Client-Side Script
 * 
 * Purpose:
 * - Handles all client-side terminal functionality within the VS Code webview
 * - Manages xterm.js initialization, theming, and event handling
 * - Provides the bridge between the webview and the extension host
 * 
 * Responsibilities:
 * - Initialize xterm.js with proper VS Code theme integration
 * - Set up WebGL/Canvas rendering with automatic fallback
 * - Handle terminal input/output and resize events
 * - Manage webview state persistence
 * - Process messages from the extension host
 * 
 * Key Features:
 * - Automatic theme detection from VS Code CSS variables
 * - WebGL rendering for performance, Canvas fallback for compatibility
 * - Proper scroll configuration (scrollOnUserInput: false)
 * - Focus management and resize handling
 * 
 * Notes:
 * - This script gets injected into the HTML template at build time
 * - All communication with extension host happens via vscode.postMessage
 * - State is persisted using vscode.getState/setState for webview reloads
 * - Template variable {{TIMESTAMP}} gets replaced during processing
 */

console.log('Claude Pilot webview loaded at time {{TIMESTAMP}}ms');

const vscode = acquireVsCodeApi();

// Restore state if available
let terminalHasContent = false;
const previousState = vscode.getState();
if (previousState && previousState.hasContent) {
    terminalHasContent = true;
}

// Helper function to get VS Code theme colors
function getThemeColor(property, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(property) || fallback;
}

// Create terminal theme matching VS Code
const terminalTheme = {
    background: getThemeColor('--vscode-terminal-background', '#1e1e1e'),
    foreground: getThemeColor('--vscode-terminal-foreground', '#cccccc'),
    cursor: getThemeColor('--vscode-terminal-cursor-foreground', '#cccccc'),
    cursorAccent: getThemeColor('--vscode-terminal-cursor-background', '#1e1e1e'),
    selection: getThemeColor('--vscode-terminal-selectionBackground', 'rgba(255, 255, 255, 0.2)'),
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
    lineHeight: 1.2,  // Add proper line height
    letterSpacing: 0,  // Reset letter spacing
    theme: terminalTheme,
    // Essential scroll configuration
    scrollback: 1000,  // Match VS Code default
    scrollOnUserInput: false,  // Don't auto-scroll to bottom on user input
    rendererType: 'canvas'  // Force canvas renderer to avoid WebGL issues
});

const fitAddon = new FitAddon.FitAddon();
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
        case 'triggerResize':
            // Force trigger window resize event
            window.dispatchEvent(new Event('resize'));
            break;
    }
});

window.addEventListener('resize', () => {
    fitAddon.fit();
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

// Terminal initialization
const terminalElement = document.getElementById('terminal');

// Initialize aggressive drag capture after terminal is ready
if (typeof setupDragCapture === 'function') {
    setupDragCapture();
    console.log('Claude Pilot: Terminal ready, drag capture initialized');
}