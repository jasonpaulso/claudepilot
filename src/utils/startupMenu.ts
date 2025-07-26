/**
 * Startup Menu for Claude Pilot
 * 
 * Provides an interactive CLI menu for selecting Claude startup options
 * before the terminal is initialized.
 */

export interface MenuOption {
    label: string;
    command: string;
    shortcut: string;
}

export class StartupMenu {
    private static readonly MENU_OPTIONS: MenuOption[] = [
        {
            label: "Start a new Claude Code conversation",
            command: "claude",
            shortcut: "1"
        },
        {
            label: "Continue previous Claude Code session",
            command: "claude --continue",
            shortcut: "2"
        },
        {
            label: "Resume recent session (interactive)",
            command: "claude --resume",
            shortcut: "3"
        }
    ];

    /**
     * Generate the HTML for the startup menu
     */
    public static generateMenuHtml(): string {
        return `
            <div id="startup-menu" class="startup-menu">
                <div class="menu-header">
                    <h2>Claude Pilot</h2>
                    <p>Select an option to start:</p>
                </div>
                <div class="menu-options">
                    ${this.MENU_OPTIONS.map((option, index) => `
                        <div class="menu-option" data-index="${index}" tabindex="0">
                            <span class="option-shortcut">${option.shortcut})</span>
                            <span class="option-label">${option.label}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="yolo-toggle">
                    <label>
                        <input type="checkbox" id="yolo-checkbox" />
                        <span class="checkbox-label">YOLO - Let Claude do their thing?</span>
                    </label>
                    <p class="yolo-hint">Adds --dangerously-skip-permissions to command</p>
                </div>
                <div class="menu-footer">
                    <p>Use arrow keys or number keys to select • Press Y to toggle YOLO mode</p>
                </div>
            </div>
        `;
    }

    /**
     * Generate CSS styles for the menu
     */
    public static generateMenuStyles(): string {
        return `
            .startup-menu {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100%;
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
            }

            .menu-header {
                text-align: center;
                margin-bottom: 30px;
            }

            .menu-header h2 {
                font-size: 24px;
                margin-bottom: 10px;
                color: var(--vscode-foreground);
            }

            .menu-header p {
                font-size: 14px;
                color: var(--vscode-descriptionForeground);
            }

            .menu-options {
                display: flex;
                flex-direction: column;
                gap: 10px;
                min-width: 300px;
            }

            .menu-option {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
                background-color: var(--vscode-editor-background);
            }

            .menu-option:hover,
            .menu-option:focus {
                background-color: var(--vscode-list-hoverBackground);
                border-color: var(--vscode-focusBorder);
                outline: none;
            }

            .menu-option.selected {
                background-color: var(--vscode-list-activeSelectionBackground);
                border-color: var(--vscode-focusBorder);
            }

            .option-shortcut {
                font-weight: bold;
                margin-right: 10px;
                color: var(--vscode-textLink-foreground);
            }

            .option-label {
                flex: 1;
            }

            .menu-footer {
                margin-top: 20px;
                text-align: center;
            }

            .menu-footer p {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }

            .yolo-toggle {
                margin-top: 30px;
                padding: 16px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                background-color: var(--vscode-editor-background);
            }

            .yolo-toggle label {
                display: flex;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }

            .yolo-toggle input[type="checkbox"] {
                width: 18px;
                height: 18px;
                margin-right: 10px;
                cursor: pointer;
            }

            .checkbox-label {
                font-weight: 500;
                color: var(--vscode-foreground);
            }

            .yolo-hint {
                margin-top: 8px;
                margin-bottom: 0;
                margin-left: 28px;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                font-style: italic;
            }

            .hidden {
                display: none !important;
            }
        `;
    }

    /**
     * Generate JavaScript for menu interaction
     */
    public static generateMenuScript(): string {
        return `
            (function() {
                const menu = document.getElementById('startup-menu');
                const options = document.querySelectorAll('.menu-option');
                const yoloCheckbox = document.getElementById('yolo-checkbox');
                let selectedIndex = 0;

                // Update visual selection
                function updateSelection() {
                    options.forEach((option, index) => {
                        if (index === selectedIndex) {
                            option.classList.add('selected');
                            option.focus();
                        } else {
                            option.classList.remove('selected');
                        }
                    });
                }

                // Handle option selection
                function selectOption(index) {
                    const menuOptions = ${JSON.stringify(this.MENU_OPTIONS)};
                    const selected = menuOptions[index];
                    if (selected) {
                        let command = selected.command;
                        
                        // Append --dangerously-skip-permissions if YOLO is enabled
                        if (yoloCheckbox.checked) {
                            command += ' --dangerously-skip-permissions';
                        }
                        
                        // Hide menu and notify parent
                        menu.classList.add('hidden');
                        vscode.postMessage({
                            command: 'menuSelection',
                            selectedCommand: command
                        });
                    }
                }

                // Keyboard navigation
                document.addEventListener('keydown', (e) => {
                    if (menu.classList.contains('hidden')) return;

                    switch(e.key) {
                        case 'ArrowUp':
                            e.preventDefault();
                            selectedIndex = Math.max(0, selectedIndex - 1);
                            updateSelection();
                            break;
                        case 'ArrowDown':
                            e.preventDefault();
                            selectedIndex = Math.min(options.length - 1, selectedIndex + 1);
                            updateSelection();
                            break;
                        case 'Enter':
                            e.preventDefault();
                            selectOption(selectedIndex);
                            break;
                        case '1':
                        case '2':
                        case '3':
                            e.preventDefault();
                            const index = parseInt(e.key) - 1;
                            if (index < options.length) {
                                selectOption(index);
                            }
                            break;
                        case 'y':
                        case 'Y':
                            e.preventDefault();
                            yoloCheckbox.checked = !yoloCheckbox.checked;
                            break;
                    }
                });

                // Mouse click
                options.forEach((option, index) => {
                    option.addEventListener('click', () => {
                        selectOption(index);
                    });
                });

                // Initial selection
                updateSelection();
            })();
        `;
    }

    /**
     * Get the command for a given selection
     */
    public static getCommand(index: number): string | undefined {
        return this.MENU_OPTIONS[index]?.command;
    }
}