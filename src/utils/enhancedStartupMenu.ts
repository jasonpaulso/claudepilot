/**
 * Enhanced Startup Menu for Claude Pilot
 *
 * Extends the startup menu with session browsing capability
 */

import { SessionReader, SessionSummary } from "./sessionReader"
import { StartupMenu } from "./startupMenu"

export class EnhancedStartupMenu extends StartupMenu {
  /**
   * Generate HTML for session browser step
   */
  public static generateSessionBrowserHtml(sessions: SessionSummary[]): string {
    return `
            <div class="menu-step hidden" id="sessionBrowser">
                <div class="menu-header">
                    <h2>Select Session to Resume</h2>
                    <p>Choose from your recent Claude Code sessions:</p>
                </div>
                <div class="session-list">
                    ${
                      sessions.length > 0
                        ? sessions
                            .map(
                              (session, index) => `
                        <div class="session-item" data-session-id="${
                          session.id
                        }" data-index="${index}" tabindex="0">
                            <div class="session-header">
                                <span class="session-time">${SessionReader.formatTimestamp(
                                  session.timestamp
                                )}</span>
                                ${
                                  session.gitBranch
                                    ? `<span class="session-branch">🌿 ${session.gitBranch}</span>`
                                    : ""
                                }
                            </div>
                            <div class="session-summary">
                                ${
                                  session.summary ||
                                  session.lastMessage ||
                                  "No summary available"
                                }
                            </div>
                            <div class="session-meta">
                                <span class="message-count">💬 ${
                                  session.messageCount
                                } messages</span>
                                <span class="session-id">${session.id.substring(
                                  0,
                                  8
                                )}...</span>
                            </div>
                        </div>
                    `
                            )
                            .join("")
                        : `
                        <div class="no-sessions">
                            <p>No previous sessions found for this project.</p>
                            <p>Start a new conversation to begin.</p>
                        </div>
                    `
                    }
                </div>
                <div class="menu-actions">
                    <button class="action-button secondary" id="sessionBackButton">← Back</button>
                    ${
                      sessions.length > 0
                        ? '<button class="action-button primary" id="sessionContinueButton">Continue →</button>'
                        : ""
                    }
                </div>
                <div class="menu-footer">
                    <p>Use arrow keys to navigate • Enter to select • Escape to go back</p>
                </div>
            </div>
        `;
  }

  /**
   * Generate additional CSS for session browser
   */
  public static generateSessionBrowserStyles(): string {
    return `
            /* Session Browser Styles */
            .session-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 600px;
                margin: 0 auto 20px;
                width: 100%;
                max-height: 400px;
                overflow-y: auto;
            }

            .session-item {
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                padding: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                background-color: var(--vscode-editor-background);
            }

            .session-item:hover,
            .session-item:focus {
                background-color: var(--vscode-list-hoverBackground);
                border-color: var(--vscode-focusBorder);
                outline: none;
            }

            .session-item.selected {
                background-color: var(--vscode-list-activeSelectionBackground);
                border-color: var(--vscode-focusBorder);
            }

            .session-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .session-time {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }

            .session-branch {
                font-size: 12px;
                color: var(--vscode-gitDecoration-modifiedResourceForeground);
                padding: 2px 6px;
                background-color: var(--vscode-badge-background);
                border-radius: 3px;
            }

            .session-summary {
                color: var(--vscode-foreground);
                margin-bottom: 8px;
                line-height: 1.4;
            }

            .session-meta {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
            }

            .message-count {
                color: var(--vscode-textLink-foreground);
            }

            .session-id {
                font-family: var(--vscode-editor-font-family);
                opacity: 0.7;
            }

            .no-sessions {
                text-align: center;
                padding: 40px 20px;
                color: var(--vscode-descriptionForeground);
            }

            .no-sessions p {
                margin: 10px 0;
            }

            /* Scrollbar styling */
            .session-list::-webkit-scrollbar {
                width: 10px;
            }

            .session-list::-webkit-scrollbar-track {
                background: var(--vscode-scrollbarSlider-background);
            }

            .session-list::-webkit-scrollbar-thumb {
                background: var(--vscode-scrollbarSlider-hoverBackground);
                border-radius: 5px;
            }
        `;
  }

  /**
   * Generate enhanced JavaScript for menu interaction with session browser
   */
  public static generateEnhancedMenuScript(workspacePath: string): string {
    return `
            (function() {
                const menu = document.getElementById('startup-menu');
                const step1 = document.getElementById('step1');
                const step2 = document.getElementById('step2');
                const menuOptions = document.querySelectorAll('.menu-option');
                const backButton = document.getElementById('backButton');
                const continueButton = document.getElementById('continueButton');
                let sessionBackButton = document.getElementById('sessionBackButton');
                let sessionContinueButton = document.getElementById('sessionContinueButton');
                const categories = document.querySelectorAll('.flag-category');
                
                let selectedIndex = 0;
                let selectedCommand = '';
                let selectedSessionId = '';
                let currentStep = 1;

                // Session browser state
                let sessionItems = [];
                let selectedSessionIndex = 0;

                // Original menu functions (from startupMenu.ts)
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
                    const menuOptions = ${JSON.stringify(
                      StartupMenu["MENU_OPTIONS"]
                    )};
                    const selected = menuOptions[index];
                    if (selected) {
                        selectedCommand = selected.command;
                        
                        // If resume option selected, show session browser
                        if (selected.command === 'claude --resume') {
                            showSessionBrowser();
                        } else {
                            showStep2();
                        }
                    }
                }

                async function showSessionBrowser() {
                    // Request session list from extension
                    vscode.postMessage({
                        command: 'requestSessions',
                        workspacePath: '${workspacePath
                          .replace(/\\/g, "\\\\")
                          .replace(/'/g, "\\'")}'
                    });
                }

                function displaySessions(sessions) {
                    // Generate session browser HTML if not already present
                    let sessionBrowserEl = document.getElementById('sessionBrowser');
                    if (!sessionBrowserEl) {
                        const sessionBrowserHtml = \`${EnhancedStartupMenu.generateSessionBrowserHtml(
                          []
                        )
                          .replace(/`/g, "\\`")
                          .replace(/\$/g, "\\$")}\`;
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = sessionBrowserHtml;
                        sessionBrowserEl = tempDiv.firstElementChild;
                        document.getElementById('startup-menu').appendChild(sessionBrowserEl);
                        
                        // Re-bind session browser event listeners
                        sessionBackButton = document.getElementById('sessionBackButton');
                        sessionContinueButton = document.getElementById('sessionContinueButton');
                        if (sessionBackButton) {
                            sessionBackButton.addEventListener('click', showStep1);
                        }
                        if (sessionContinueButton) {
                            sessionContinueButton.addEventListener('click', () => {
                                if (selectedSessionIndex >= 0) {
                                    selectSession(selectedSessionIndex);
                                }
                            });
                        }
                    }
                    
                    // Update session list content
                    const sessionList = sessionBrowserEl.querySelector('.session-list');
                    if (sessionList && sessions.length > 0) {
                        sessionList.innerHTML = sessions.map((session, index) => \`
                            <div class="session-item" data-session-id="\${session.id}" data-index="\${index}" tabindex="0">
                                <div class="session-header">
                                    <span class="session-time">\${formatTimestamp(session.timestamp)}</span>
                                    \${session.gitBranch ? \`<span class="session-branch">🌿 \${session.gitBranch}</span>\` : ''}
                                </div>
                                <div class="session-summary">
                                    \${session.summary || session.lastMessage || 'No summary available'}
                                </div>
                                <div class="session-meta">
                                    <span class="message-count">💬 \${session.messageCount} messages</span>
                                    <span class="session-id">\${session.id.substring(0, 8)}...</span>
                                </div>
                            </div>
                        \`).join('');
                    }
                    
                    currentStep = 'sessions';
                    step1.classList.add('hidden');
                    step2.classList.add('hidden');
                    sessionBrowserEl.classList.remove('hidden');
                    
                    sessionItems = document.querySelectorAll('.session-item');
                    if (sessionItems.length > 0) {
                        updateSessionSelection();
                    }
                }
                
                function formatTimestamp(timestamp) {
                    const date = new Date(timestamp);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);

                    if (diffMins < 1) return 'just now';
                    if (diffMins < 60) return \`\${diffMins} minute\${diffMins > 1 ? 's' : ''} ago\`;
                    if (diffHours < 24) return \`\${diffHours} hour\${diffHours > 1 ? 's' : ''} ago\`;
                    if (diffDays < 7) return \`\${diffDays} day\${diffDays > 1 ? 's' : ''} ago\`;
                    
                    return date.toLocaleDateString();
                }

                function updateSessionSelection() {
                    sessionItems.forEach((item, index) => {
                        if (index === selectedSessionIndex) {
                            item.classList.add('selected');
                            item.focus();
                        } else {
                            item.classList.remove('selected');
                        }
                    });
                }

                function selectSession(index) {
                    const sessionItem = sessionItems[index];
                    if (sessionItem) {
                        selectedSessionId = sessionItem.dataset.sessionId;
                        selectedCommand = 'claude --resume ' + selectedSessionId;
                        showStep2();
                    }
                }

                function showStep2() {
                    currentStep = 2;
                    step1.classList.add('hidden');
                    const sessionBrowserEl = document.getElementById('sessionBrowser');
                    if (sessionBrowserEl) {
                        sessionBrowserEl.classList.add('hidden');
                    }
                    step2.classList.remove('hidden');
                    
                    // Pre-fill session ID if selected
                    if (selectedSessionId) {
                        const sessionIdInput = document.querySelector('[data-flag="--resume"] input');
                        if (sessionIdInput) {
                            sessionIdInput.value = selectedSessionId;
                        }
                    }
                    
                    // Focus first interactive element
                    const firstCategory = document.querySelector('.category-header');
                    if (firstCategory) firstCategory.focus();
                }

                function showStep1() {
                    currentStep = 1;
                    step2.classList.add('hidden');
                    const sessionBrowserEl = document.getElementById('sessionBrowser');
                    if (sessionBrowserEl) {
                        sessionBrowserEl.classList.add('hidden');
                    }
                    step1.classList.remove('hidden');
                    selectedSessionId = '';
                    updateSelection();
                }

                // Keyboard navigation for sessions
                function handleSessionKeyboard(e) {
                    switch(e.key) {
                        case 'ArrowUp':
                            e.preventDefault();
                            selectedSessionIndex = Math.max(0, selectedSessionIndex - 1);
                            updateSessionSelection();
                            break;
                        case 'ArrowDown':
                            e.preventDefault();
                            selectedSessionIndex = Math.min(sessionItems.length - 1, selectedSessionIndex + 1);
                            updateSessionSelection();
                            break;
                        case 'Enter':
                            e.preventDefault();
                            selectSession(selectedSessionIndex);
                            break;
                        case 'Escape':
                            e.preventDefault();
                            showStep1();
                            break;
                    }
                }

                // Collect flags (from original)
                function collectFlags() {
                    const flags = [];
                    
                    document.querySelectorAll('.flag-option').forEach(option => {
                        const flag = option.dataset.flag;
                        const checkbox = option.querySelector('input[type="checkbox"]');
                        const textInput = option.querySelector('.flag-input');
                        const select = option.querySelector('.flag-select');
                        
                        // Skip session-id if already in command
                        if (flag === '--session-id' && selectedSessionId) {
                            return;
                        }
                        
                        if (checkbox && checkbox.checked) {
                            flags.push(flag);
                        } else if (textInput && textInput.value.trim()) {
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

                // Event listeners
                document.addEventListener('keydown', (e) => {
                    if (menu.classList.contains('hidden')) return;

                    if (currentStep === 1) {
                        // Original step 1 keyboard handling
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
                    } else if (currentStep === 'sessions') {
                        handleSessionKeyboard(e);
                    } else if (currentStep === 2) {
                        // Original step 2 keyboard handling
                        switch(e.key) {
                            case 'Escape':
                                e.preventDefault();
                                if (selectedSessionId) {
                                    showSessionBrowser();
                                } else {
                                    showStep1();
                                }
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
                backButton.addEventListener('click', () => {
                    if (selectedSessionId) {
                        showSessionBrowser();
                    } else {
                        showStep1();
                    }
                });
                continueButton.addEventListener('click', () => {
                    submitConfiguration();
                });
                
                if (sessionBackButton) {
                    sessionBackButton.addEventListener('click', showStep1);
                }
                if (sessionContinueButton) {
                    sessionContinueButton.addEventListener('click', () => {
                        if (selectedSessionIndex >= 0) {
                            selectSession(selectedSessionIndex);
                        }
                    });
                }

                // Session item clicks
                document.addEventListener('click', (e) => {
                    const sessionItem = e.target.closest('.session-item');
                    if (sessionItem) {
                        const index = parseInt(sessionItem.dataset.index);
                        selectedSessionIndex = index;
                        updateSessionSelection();
                        selectSession(index);
                    }
                });

                // Menu option clicks
                menuOptions.forEach((option, index) => {
                    option.addEventListener('click', () => {
                        selectOption(index);
                    });
                });

                // Category collapse/expand
                categories.forEach(category => {
                    const header = category.querySelector('.category-header');
                    
                    if (category.dataset.category !== 'quick') {
                        category.classList.add('collapsed');
                    }
                    
                    header.addEventListener('click', () => {
                        category.classList.toggle('collapsed');
                    });
                });

                // Listen for session data from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'sessionData') {
                        displaySessions(message.sessions);
                    }
                });

                // Initial selection
                updateSelection();
            })();
        `;
  }
}
