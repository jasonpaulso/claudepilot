# Claude Pilot

A VS Code extension that provides a moveable terminal view for Claude Code, allowing you to run Claude Code in a dedicated terminal that can be positioned in any VS Code panel.

## Features

- **Moveable Terminal**: Full terminal interface that can be dragged between VS Code panels (Primary Side Bar, Secondary Side Bar, Bottom Panel)
- **Real Terminal**: Uses xterm.js and node-pty for a complete terminal experience with colors, cursor positioning, and keyboard input
- **Claude Code Integration**: Pre-configured environment variables for Claude Code IDE integration
- **Cross-Platform**: Works on macOS, Linux, and Windows

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Press `F5` to launch the Extension Development Host
4. Look for the Claude Code icon in the Activity Bar (left sidebar)
5. Click the icon to open the moveable terminal view

## Usage

Once activated, the extension creates a "Claude Code" view that contains a fully functional terminal. You can:

- Drag the view between different VS Code panels
- Run Claude Code commands directly in the embedded terminal
- Use all standard terminal features (command history, tab completion, etc.)
- Keep your regular VS Code terminal separate for other tasks

## Technical Details

- **Terminal Rendering**: xterm.js for browser-based terminal emulation
- **PTY Support**: @lydell/node-pty for cross-platform pseudo-terminal functionality
- **View System**: VS Code's webview view provider for moveable panels

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Launch Extension Development Host
# Press F5 in VS Code
```

## Requirements

- VS Code 1.74.0 or higher
- Node.js (any recent version - the extension uses precompiled binaries)