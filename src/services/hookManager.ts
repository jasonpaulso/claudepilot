import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HookServer } from './hookServer';

interface HookConfig {
    type: 'command';
    command: string;
}

interface HookDefinition {
    hooks: HookConfig[];
    matcher?: string;
}

interface ClaudeSettings {
    hooks?: {
        UserPromptSubmit?: HookDefinition[];
        PostToolUse?: HookDefinition[];
        PreToolUse?: HookDefinition[];
    };
}

export class HookManager {
    private readonly context: vscode.ExtensionContext;
    private readonly hookServer: HookServer;
    private claudeDir: string;
    private settingsPath: string;

    constructor(context: vscode.ExtensionContext, hookServer: HookServer) {
        this.context = context;
        this.hookServer = hookServer;
        this.claudeDir = path.join(os.homedir(), '.claude');
        this.settingsPath = path.join(this.claudeDir, 'settings.json');
    }

    /**
     * Initialize hooks - ensure Claude directory and settings exist
     */
    async initialize(): Promise<void> {
        // Ensure .claude directory exists
        if (!fs.existsSync(this.claudeDir)) {
            fs.mkdirSync(this.claudeDir, { recursive: true });
        }

        // Install/update hook configuration
        await this.installHooks();
    }

    /**
     * Install or update Claude Pilot hooks in settings.json
     */
    private async installHooks(): Promise<void> {
        const serverUrl = this.hookServer.getUrl();
        
        // Define our hooks
        const claudePilotHooks = {
            UserPromptSubmit: [
                {
                    hooks: [
                        {
                            type: 'command' as const,
                            command: `curl -s -X POST ${serverUrl}/hook/session -H "Content-Type: application/json" -d @-`
                        }
                    ]
                }
            ],
            PostToolUse: [
                {
                    matcher: 'TodoWrite',
                    hooks: [
                        {
                            type: 'command' as const,
                            command: `curl -s -X POST ${serverUrl}/hook/todo -H "Content-Type: application/json" -d @-`
                        }
                    ]
                }
            ]
        };

        // Load existing settings or create new
        let settings: ClaudeSettings = {};
        if (fs.existsSync(this.settingsPath)) {
            try {
                const content = fs.readFileSync(this.settingsPath, 'utf-8');
                settings = JSON.parse(content);
            } catch (error) {
                console.error('Error reading Claude settings:', error);
                // Backup corrupted file
                const backupPath = `${this.settingsPath}.backup-${Date.now()}`;
                fs.copyFileSync(this.settingsPath, backupPath);
                vscode.window.showWarningMessage(`Claude settings were corrupted. Backed up to ${backupPath}`);
            }
        }

        // Merge hooks
        settings.hooks = settings.hooks || {};
        
        // Merge UserPromptSubmit hooks
        settings.hooks.UserPromptSubmit = this.mergeHooks(
            settings.hooks.UserPromptSubmit || [],
            claudePilotHooks.UserPromptSubmit,
            'claudepilot-session'
        );

        // Merge PostToolUse hooks
        settings.hooks.PostToolUse = this.mergeHooks(
            settings.hooks.PostToolUse || [],
            claudePilotHooks.PostToolUse,
            'claudepilot-todo',
            'TodoWrite'
        );

        // Write updated settings
        fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
        console.log('Claude Pilot hooks installed/updated successfully');
    }

    /**
     * Merge our hooks with existing hooks, avoiding duplicates
     */
    private mergeHooks(
        existing: HookDefinition[], 
        newHooks: HookDefinition[], 
        identifier: string,
        matcher?: string
    ): HookDefinition[] {
        // Remove any existing Claude Pilot hooks (identified by our server URL pattern)
        const filtered = existing.filter(hookDef => {
            const hasOurHook = hookDef.hooks.some(hook => 
                hook.command && hook.command.includes('/hook/')
            );
            // Keep if it's not our hook, or if it has a different matcher
            return !hasOurHook || (matcher && hookDef.matcher !== matcher);
        });

        // Add our new hooks
        return [...filtered, ...newHooks];
    }

    /**
     * Remove Claude Pilot hooks from settings
     */
    async uninstall(): Promise<void> {
        if (!fs.existsSync(this.settingsPath)) {
            return;
        }

        try {
            const content = fs.readFileSync(this.settingsPath, 'utf-8');
            const settings: ClaudeSettings = JSON.parse(content);

            if (settings.hooks) {
                // Remove our hooks
                if (settings.hooks.UserPromptSubmit) {
                    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
                        hookDef => !hookDef.hooks.some(hook => 
                            hook.command && hook.command.includes('/hook/')
                        )
                    );
                }

                if (settings.hooks.PostToolUse) {
                    settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
                        hookDef => !hookDef.hooks.some(hook => 
                            hook.command && hook.command.includes('/hook/')
                        )
                    );
                }

                // Clean up empty arrays
                if (settings.hooks.UserPromptSubmit?.length === 0) {
                    delete settings.hooks.UserPromptSubmit;
                }
                if (settings.hooks.PostToolUse?.length === 0) {
                    delete settings.hooks.PostToolUse;
                }

                // Write updated settings
                fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
                console.log('Claude Pilot hooks removed successfully');
            }
        } catch (error) {
            console.error('Error removing Claude Pilot hooks:', error);
        }
    }

    /**
     * Check if hooks are installed
     */
    isInstalled(): boolean {
        if (!fs.existsSync(this.settingsPath)) {
            return false;
        }

        try {
            const content = fs.readFileSync(this.settingsPath, 'utf-8');
            const settings: ClaudeSettings = JSON.parse(content);
            
            // Check if our hooks are present
            const hasSessionHook = settings.hooks?.UserPromptSubmit?.some(
                hookDef => hookDef.hooks.some(hook => 
                    hook.command && hook.command.includes('/hook/session')
                )
            );

            const hasTodoHook = settings.hooks?.PostToolUse?.some(
                hookDef => hookDef.hooks.some(hook => 
                    hook.command && hook.command.includes('/hook/todo')
                )
            );

            return !!(hasSessionHook && hasTodoHook);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get Claude settings path for display
     */
    getSettingsPath(): string {
        return this.settingsPath;
    }
}