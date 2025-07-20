/**
 * Template Processing Utilities
 * 
 * Purpose:
 * - Processes HTML and JavaScript templates for the terminal webview
 * - Handles resource URI generation and template variable replacement
 * - Manages the build pipeline between templates and final webview content
 * 
 * Responsibilities:
 * - Read HTML and JavaScript template files from disk
 * - Generate proper webview URIs for xterm.js dependencies
 * - Replace template placeholders with actual values
 * - Inject processed JavaScript into HTML template
 * 
 * Template Processing Flow:
 * 1. Read terminal.html and terminalScript.js templates
 * 2. Generate webview URIs for all xterm.js resources
 * 3. Replace {{TIMESTAMP}} in JavaScript for cache busting
 * 4. Replace all template variables in HTML
 * 5. Inject processed JavaScript into HTML
 * 
 * Notes:
 * - All file paths are relative to the compiled output directory
 * - Webview URIs are required for security - direct file paths won't work
 * - Cache busting via timestamp ensures webview refreshes properly
 * - Template variables use {{VARIABLE}} syntax for easy replacement
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class TemplateUtils {
    static getHtmlTemplate(
        extensionUri: vscode.Uri,
        webview: vscode.Webview,
        timeNow: number
    ): string {
        // Read HTML template from source directory (since templates aren't compiled)
        const templatePath = path.join(__dirname, '..', '..', 'src', 'templates', 'terminal.html');
        let htmlTemplate = fs.readFileSync(templatePath, 'utf8');

        // Read JavaScript template from source directory
        const scriptPath = path.join(__dirname, '..', '..', 'src', 'webview', 'terminalScript.js');
        let scriptTemplate = fs.readFileSync(scriptPath, 'utf8');

        // Get resource URIs (node_modules is in project root, not in out/)
        const xtermPath = path.join(__dirname, '..', '..', 'node_modules', '@xterm', 'xterm', 'lib', 'xterm.js');
        const xtermCssPath = path.join(__dirname, '..', '..', 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css');
        const fitAddonPath = path.join(__dirname, '..', '..', 'node_modules', '@xterm', 'addon-fit', 'lib', 'addon-fit.js');
        const webglAddonPath = path.join(__dirname, '..', '..', 'node_modules', '@xterm', 'addon-webgl', 'lib', 'addon-webgl.js');
        const canvasAddonPath = path.join(__dirname, '..', '..', 'node_modules', '@xterm', 'addon-canvas', 'lib', 'addon-canvas.js');

        const xtermUri = webview.asWebviewUri(vscode.Uri.file(xtermPath));
        const xtermCssUri = webview.asWebviewUri(vscode.Uri.file(xtermCssPath));
        const fitAddonUri = webview.asWebviewUri(vscode.Uri.file(fitAddonPath));
        const webglAddonUri = webview.asWebviewUri(vscode.Uri.file(webglAddonPath));
        const canvasAddonUri = webview.asWebviewUri(vscode.Uri.file(canvasAddonPath));

        // Replace template variables in script
        scriptTemplate = scriptTemplate.replace(/\{\{TIMESTAMP\}\}/g, timeNow.toString());

        // Replace template variables in HTML
        htmlTemplate = htmlTemplate
            .replace(/\{\{TIMESTAMP\}\}/g, timeNow.toString())
            .replace(/\{\{XTERM_URI\}\}/g, xtermUri.toString())
            .replace(/\{\{XTERM_CSS_URI\}\}/g, xtermCssUri.toString())
            .replace(/\{\{FIT_ADDON_URI\}\}/g, fitAddonUri.toString())
            .replace(/\{\{WEBGL_ADDON_URI\}\}/g, webglAddonUri.toString())
            .replace(/\{\{CANVAS_ADDON_URI\}\}/g, canvasAddonUri.toString())
            .replace(/\{\{TERMINAL_SCRIPT\}\}/g, scriptTemplate);

        return htmlTemplate;
    }
}