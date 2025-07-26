/**
 * Template Utilities for Webview HTML Generation
 *
 * Purpose:
 * - Generate HTML templates for the Claude Pilot terminal webview
 * - Handle xterm.js library loading and configuration
 * - Manage VS Code webview security and resource access
 *
 * This file now serves as a compatibility layer while transitioning
 * to the new modular template system.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { WebviewTemplate, WebviewResources } from './webviewTemplate';

export class TemplateUtils {
    public static getHtmlTemplate(
        extensionUri: vscode.Uri,
        webview: vscode.Webview,
        timestamp: number
    ): string {
        // Get version from package.json
        const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
        let version = '0.1.0';
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            version = packageJson.version;
        } catch (error) {
            console.warn('Could not read version from package.json:', error);
        }

        // Build resource URIs
        const resources: WebviewResources = {
            xtermJs: webview.asWebviewUri(vscode.Uri.joinPath(
                extensionUri,
                'node_modules',
                '@xterm',
                'xterm',
                'lib',
                'xterm.js'
            )),
            xtermCss: webview.asWebviewUri(vscode.Uri.joinPath(
                extensionUri,
                'node_modules',
                '@xterm',
                'xterm',
                'css',
                'xterm.css'
            )),
            fitAddon: webview.asWebviewUri(vscode.Uri.joinPath(
                extensionUri,
                'node_modules',
                '@xterm',
                'addon-fit',
                'lib',
                'addon-fit.js'
            )),
            webglAddon: webview.asWebviewUri(vscode.Uri.joinPath(
                extensionUri,
                'node_modules',
                '@xterm',
                'addon-webgl',
                'lib',
                'addon-webgl.js'
            )),
            canvasAddon: webview.asWebviewUri(vscode.Uri.joinPath(
                extensionUri,
                'node_modules',
                '@xterm',
                'addon-canvas',
                'lib',
                'addon-canvas.js'
            )),
            webLinksAddon: webview.asWebviewUri(vscode.Uri.joinPath(
                extensionUri,
                'node_modules',
                '@xterm',
                'addon-web-links',
                'lib',
                'addon-web-links.js'
            ))
        };

        // Use the new template generator
        return WebviewTemplate.generateHtml(resources, version, timestamp);
    }
}