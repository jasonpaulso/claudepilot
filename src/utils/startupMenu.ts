/**
 * Startup Menu for Claude Pilot
 *
 * Provides an interactive CLI menu for selecting Claude startup options
 * and configuring CLI flags before the terminal is initialized.
 */

export interface MenuOption {
  label: string;
  command: string;
  shortcut: string;
}

export interface FlagOption {
  flag: string;
  label: string;
  description: string;
  type: "boolean" | "text" | "select";
  default?: any;
  options?: string[]; // For select type
  placeholder?: string; // For text input
}

export interface FlagCategory {
  id: string;
  label: string;
  icon: string;
  flags: FlagOption[];
}

export class StartupMenu {
  private static readonly MENU_OPTIONS: MenuOption[] = [
    {
      label: "Start a new Claude Code conversation",
      command: "claude",
      shortcut: "1",
    },
    {
      label: "Continue previous Claude Code session",
      command: "claude --continue",
      shortcut: "2",
    },
    {
      label: "Resume recent session (interactive)",
      command: "claude --resume",
      shortcut: "3",
    },
  ];

  private static readonly FLAG_CATEGORIES: FlagCategory[] = [
    {
      id: "quick",
      label: "Quick Options",
      icon: "⚡",
      flags: [
        {
          flag: "--dangerously-skip-permissions",
          label: "Skip Permissions (YOLO)",
          description: "Bypass all permission checks",
          type: "boolean",
          default: false,
        },
        {
          flag: "--ide",
          label: "Auto-connect IDE",
          description: "Connect to IDE on startup if available",
          type: "boolean",
          default: false,
        },
      ],
    },
    {
      id: "debug",
      label: "Debug & Output",
      icon: "🔍",
      flags: [
        {
          flag: "--debug",
          label: "Debug Mode",
          description: "Enable debug logging",
          type: "boolean",
          default: false,
        },
        {
          flag: "--verbose",
          label: "Verbose Output",
          description: "Override verbose mode from config",
          type: "boolean",
          default: false,
        },
      ],
    },
    {
      id: "model",
      label: "Model Settings",
      icon: "🤖",
      flags: [
        {
          flag: "--model",
          label: "Model",
          description: "Model to use (e.g. sonnet, opus)",
          type: "text",
          placeholder: "sonnet",
        },
        {
          flag: "--fallback-model",
          label: "Fallback Model",
          description: "Model to use when default is overloaded",
          type: "text",
          placeholder: "sonnet",
        },
      ],
    },
    {
      id: "permissions",
      label: "Permissions & Security",
      icon: "🔒",
      flags: [
        {
          flag: "--permission-mode",
          label: "Permission Mode",
          description: "How to handle permissions",
          type: "select",
          options: ["default", "acceptEdits", "bypassPermissions", "plan"],
          default: "default",
        },
        {
          flag: "--allowedTools",
          label: "Allowed Tools",
          description:
            'Comma or space-separated list (e.g. "Bash(git:*), Edit")',
          type: "text",
          placeholder: "Bash, Edit, Read",
        },
        {
          flag: "--disallowedTools",
          label: "Disallowed Tools",
          description: "Comma or space-separated list",
          type: "text",
          placeholder: "WebSearch, Write",
        },
      ],
    },
    {
      id: "advanced",
      label: "Advanced Configuration",
      icon: "⚙️",
      flags: [
        {
          flag: "--append-system-prompt",
          label: "Append System Prompt",
          description: "Add to default system prompt",
          type: "text",
          placeholder: "Additional instructions...",
        },
        {
          flag: "--add-dir",
          label: "Additional Directories",
          description: "Allow tool access to more directories",
          type: "text",
          placeholder: "/path/to/dir",
        },
        {
          flag: "--session-id",
          label: "Session ID",
          description: "Use specific session ID (UUID)",
          type: "text",
          placeholder: "uuid",
        },
      ],
    },
  ];

  /**
   * Generate the HTML for the startup menu
   */
  public static generateMenuHtml(): string {
    return `
            <div id="startup-menu" class="startup-menu">
                <div class="menu-step" id="step1">
                    <div class="menu-header">
                        <h2>Claude Pilot</h2>
                        <p>Select an option to start:</p>
                    </div>
                    <div class="menu-options">
                        ${this.MENU_OPTIONS.map(
                          (option, index) => `
                            <div class="menu-option" data-index="${index}" tabindex="0">
                                <span class="option-shortcut">${option.shortcut})</span>
                                <span class="option-label">${option.label}</span>
                            </div>
                        `
                        ).join("")}
                    </div>
                    <div class="menu-footer">
                        <p>Use arrow keys or number keys to select</p>
                    </div>
                </div>
                
                <div class="menu-step hidden" id="step2">
                    <div class="menu-header">
                        <h2>Configure Options</h2>
                        <p>Select additional flags (optional):</p>
                    </div>
                    <div class="flag-categories">
                        ${this.FLAG_CATEGORIES.map(
                          (category) => `
                            <div class="flag-category" data-category="${
                              category.id
                            }">
                                <div class="category-header">
                                    <span class="category-icon">${
                                      category.icon
                                    }</span>
                                    <span class="category-label">${
                                      category.label
                                    }</span>
                                    <span class="category-toggle">▼</span>
                                </div>
                                <div class="category-content">
                                    ${category.flags
                                      .map((flag) =>
                                        this.generateFlagHtml(flag)
                                      )
                                      .join("")}
                                </div>
                            </div>
                        `
                        ).join("")}
                    </div>
                    <div class="menu-footer">
                        <div class="menu-actions">
                            <button class="action-button secondary" id="backButton">← Back</button>
                            <button class="action-button primary" id="continueButton">Continue →</button>
                        </div>
                        <p>Press Tab to navigate • Enter to continue • Escape to go back</p>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Generate HTML for a single flag option
   */
  private static generateFlagHtml(flag: FlagOption): string {
    switch (flag.type) {
      case "boolean":
        return `
                    <div class="flag-option" data-flag="${flag.flag}">
                        <label class="flag-toggle">
                            <input type="checkbox" ${
                              flag.default ? "checked" : ""
                            } />
                            <span class="toggle-slider"></span>
                            <div class="flag-info">
                                <span class="flag-label">${flag.label}</span>
                                <span class="flag-description">${
                                  flag.description
                                }</span>
                            </div>
                        </label>
                    </div>
                `;
      case "text":
        return `
                    <div class="flag-option" data-flag="${flag.flag}">
                        <div class="flag-info">
                            <span class="flag-label">${flag.label}</span>
                            <span class="flag-description">${
                              flag.description
                            }</span>
                        </div>
                        <input type="text" class="flag-input" placeholder="${
                          flag.placeholder || ""
                        }" />
                    </div>
                `;
      case "select":
        return `
                    <div class="flag-option" data-flag="${flag.flag}">
                        <div class="flag-info">
                            <span class="flag-label">${flag.label}</span>
                            <span class="flag-description">${
                              flag.description
                            }</span>
                        </div>
                        <select class="flag-select">
                            <option value="">None</option>
                            ${flag.options
                              ?.map(
                                (opt) => `
                                <option value="${opt}" ${
                                  opt === flag.default ? "selected" : ""
                                }>${opt}</option>
                            `
                              )
                              .join("")}
                        </select>
                    </div>
                `;
    }
  }

  /**
   * Generate CSS styles for the menu
   */
  public static generateMenuStyles(): string {
    return `
            .startup-menu {
                display: flex;
                flex-direction: column;
                // height: 100%;
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                overflow-y: auto;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                // flex: 1;
            }

            .menu-step {
                display: flex;
                flex-direction: column;
                padding: 20px;
                // min-height: 100%;
            }

            #step1 {
                justify-content: center;
                align-items: center;
            }

            #step2 {
                // height: 100%;
                overflow: hidden; /* Prevent double scrollbars */
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

            /* Step 1: Menu Options */
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

            /* Step 2: Flag Categories */
            .flag-categories {
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 600px;
                margin: 0 auto;
                width: 100%;
                flex: 1;
                overflow-y: auto;
                padding-right: 10px; /* Space for scrollbar */
            }

            .flag-category {
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                // overflow: hidden;
                background-color: var(--vscode-editor-background);
            }

            .category-header {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                cursor: pointer;
                user-select: none;
                background-color: var(--vscode-sideBar-background);
                transition: background-color 0.2s;
            }

            .category-header:hover {
                background-color: var(--vscode-list-hoverBackground);
            }

            .category-icon {
                font-size: 16px;
                margin-right: 10px;
            }

            .category-label {
                flex: 1;
                font-weight: 500;
            }

            .category-toggle {
                transition: transform 0.2s;
                color: var(--vscode-descriptionForeground);
            }

            .flag-category.collapsed .category-toggle {
                transform: rotate(-90deg);
            }

            .flag-category.collapsed .category-content {
                display: none;
            }

            .category-content {
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            /* Flag Options */
            .flag-option {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px;
            }

            .flag-toggle {
                display: flex;
                align-items: center;
                cursor: pointer;
                width: 100%;
                gap: 12px;
            }

            .flag-toggle input[type="checkbox"] {
                display: none;
            }

            .toggle-slider {
                position: relative;
                width: 40px;
                height: 20px;
                background-color: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 10px;
                transition: background-color 0.2s;
                flex-shrink: 0;
            }

            .toggle-slider::after {
                content: '';
                position: absolute;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background-color: var(--vscode-foreground);
                top: 1px;
                left: 1px;
                transition: transform 0.2s;
            }

            .flag-toggle input[type="checkbox"]:checked + .toggle-slider {
                background-color: var(--vscode-button-background);
                border-color: var(--vscode-button-background);
            }

            .flag-toggle input[type="checkbox"]:checked + .toggle-slider::after {
                transform: translateX(20px);
                background-color: var(--vscode-button-foreground);
            }

            .flag-info {
                display: flex;
                flex-direction: column;
                flex: 1;
            }

            .flag-label {
                font-weight: 500;
                color: var(--vscode-foreground);
            }

            .flag-description {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                margin-top: 2px;
            }

            .flag-input,
            .flag-select {
                width: 200px;
                padding: 4px 8px;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                font-size: 13px;
            }

            .flag-input:focus,
            .flag-select:focus {
                outline: 1px solid var(--vscode-focusBorder);
                border-color: var(--vscode-focusBorder);
            }

            /* Action Buttons */
            .menu-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin: 20px 0;
            }

            .action-button {
                padding: 8px 16px;
                border: 1px solid var(--vscode-button-border);
                border-radius: 2px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: 500;
            }

            .action-button.primary {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }

            .action-button.primary:hover {
                background-color: var(--vscode-button-hoverBackground);
            }

            .action-button.secondary {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }

            .action-button.secondary:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }

            .menu-footer {
                text-align: center;
                margin-top: auto;
                // padding-top: 20px;
                // padding-bottom: 20px;
                position: sticky;
                bottom:0;
                background-color: var(--vscode-editor-background);
            }

            .menu-footer p {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
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
                const step1 = document.getElementById('step1');
                const step2 = document.getElementById('step2');
                const menuOptions = document.querySelectorAll('.menu-option');
                const backButton = document.getElementById('backButton');
                const continueButton = document.getElementById('continueButton');
                const categories = document.querySelectorAll('.flag-category');
                
                let selectedIndex = 0;
                let selectedCommand = '';
                let currentStep = 1;

                // Step 1: Menu selection
                function updateSelection() {
                    menuOptions.forEach((option, index) => {
                        if (index === selectedIndex) {
                            option.classList.add('selected');
                            option.focus();
                        } else {
                            option.classList.remove('selected');
                        }
                    });
                }

                function selectOption(index) {
                    const menuOptions = ${JSON.stringify(this.MENU_OPTIONS)};
                    const selected = menuOptions[index];
                    if (selected) {
                        selectedCommand = selected.command;
                        showStep2();
                    }
                }

                function showStep2() {
                    currentStep = 2;
                    step1.classList.add('hidden');
                    step2.classList.remove('hidden');
                    
                    // Focus first interactive element
                    const firstCategory = document.querySelector('.category-header');
                    if (firstCategory) firstCategory.focus();
                }

                function showStep1() {
                    currentStep = 1;
                    step2.classList.add('hidden');
                    step1.classList.remove('hidden');
                    updateSelection();
                }

                // Step 2: Flag configuration
                function collectFlags() {
                    const flags = [];
                    
                    document.querySelectorAll('.flag-option').forEach(option => {
                        const flag = option.dataset.flag;
                        const checkbox = option.querySelector('input[type="checkbox"]');
                        const textInput = option.querySelector('.flag-input');
                        const select = option.querySelector('.flag-select');
                        
                        if (checkbox && checkbox.checked) {
                            flags.push(flag);
                        } else if (textInput && textInput.value.trim()) {
                            // Quote the value if it contains spaces or special characters
                            const value = textInput.value.trim();
                            const needsQuotes = value.includes(' ') || value.includes('"') || value.includes("'");
                            const quotedValue = needsQuotes ? '"' + value.replace(/"/g, '\\"') + '"' : value;
                            flags.push(flag + ' ' + quotedValue);
                        } else if (select && select.value) {
                            flags.push(flag + ' ' + select.value);
                        }
                    });
                    
                    return flags.join(' ');
                }

                function submitConfiguration() {
                    const flags = collectFlags();
                    let finalCommand = selectedCommand;
                    
                    if (flags) {
                        finalCommand += ' ' + flags;
                    }
                    
                    // Hide menu and notify parent
                    menu.classList.add('hidden');
                    vscode.postMessage({
                        command: 'menuSelection',
                        selectedCommand: finalCommand
                    });
                }

                // Category collapse/expand
                categories.forEach(category => {
                    const header = category.querySelector('.category-header');
                    
                    // Start with quick options expanded, others collapsed
                    if (category.dataset.category !== 'quick') {
                        category.classList.add('collapsed');
                    }
                    
                    header.addEventListener('click', () => {
                        category.classList.toggle('collapsed');
                    });
                });

                // Keyboard navigation
                document.addEventListener('keydown', (e) => {
                    if (menu.classList.contains('hidden')) return;

                    if (currentStep === 1) {
                        switch(e.key) {
                            case 'ArrowUp':
                                e.preventDefault();
                                selectedIndex = Math.max(0, selectedIndex - 1);
                                updateSelection();
                                break;
                            case 'ArrowDown':
                                e.preventDefault();
                                selectedIndex = Math.min(menuOptions.length - 1, selectedIndex + 1);
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
                                if (index < menuOptions.length) {
                                    selectOption(index);
                                }
                                break;
                        }
                    } else if (currentStep === 2) {
                        switch(e.key) {
                            case 'Escape':
                                e.preventDefault();
                                showStep1();
                                break;
                            case 'Enter':
                                if (!e.target.matches('input, select')) {
                                    e.preventDefault();
                                    submitConfiguration();
                                }
                                break;
                        }
                    }
                });

                // Button clicks
                backButton.addEventListener('click', showStep1);
                continueButton.addEventListener('click', () => {
                    submitConfiguration();
                });

                // Menu option clicks
                menuOptions.forEach((option, index) => {
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
