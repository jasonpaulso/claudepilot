/**
 * Webview CSS styles for the terminal
 */

export const getTerminalStyles = (): string => `
    body {
        margin: 0;
        padding: 16px;
        height: 100vh;
        box-sizing: border-box;
        overflow: hidden;
        background-color: var(--vscode-panel-background, #1e1e1e);
        color: var(--vscode-terminal-foreground, #cccccc);
        font-family: var(--vscode-editor-font-family, 'Courier New', monospace);
        display: flex;
        flex-direction: column;
        overflow-y: scroll;
    }
    
    #terminal {
        width: 100%;
        min-width: 500px;
        height: calc(100% - 32px);
    }
    
    /* Ensure xterm uses transparent background to inherit VS Code theme */
    .xterm {
        background-color: transparent !important;
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
`;
