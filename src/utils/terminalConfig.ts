/**
 * Terminal configuration and theme utilities
 */

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const getTerminalThemeScript = (): string => `
    // Helper function to get VS Code theme color from CSS variables
    function getThemeColor(variable, fallback) {
        const color = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
        return color || fallback;
    }
    
    // Build terminal theme using panel background for consistency
    const terminalTheme = {
        background: getThemeColor('--vscode-panel-background', getThemeColor('--vscode-editor-background', '#1e1e1e')),
        foreground: getThemeColor('--vscode-terminal-foreground', '#cccccc'),
        cursor: getThemeColor('--vscode-terminal-cursor-foreground', getThemeColor('--vscode-terminal-foreground', '#ffffff')),
        cursorAccent: getThemeColor('--vscode-terminal-cursor-background', getThemeColor('--vscode-terminal-background', '#1e1e1e')),
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
`;

export const getTerminalConfig = (settings?: {
    fontSize?: number;
    fontFamily?: string;
    cursorStyle?: string;
    cursorBlink?: boolean;
    scrollback?: number;
}): string => {
    const config = {
        cursorBlink: settings?.cursorBlink ?? true,
        cursorStyle: settings?.cursorStyle ?? 'block',
        lineHeight: 1.0,
        letterSpacing: 0,
        allowTransparency: true,
        theme: 'terminalTheme',
        scrollback: settings?.scrollback ?? 1000,
        scrollOnUserInput: true
    };
    
    // Add fontSize if provided
    if (settings?.fontSize) {
        (config as any).fontSize = settings.fontSize;
    }
    
    // Add fontFamily if provided
    if (settings?.fontFamily) {
        (config as any).fontFamily = settings.fontFamily;
    }
    
    return JSON.stringify(config, null, 4).replace('"terminalTheme"', 'terminalTheme');
};
