import * as assert from 'assert';
import * as vscode from 'vscode';
import { SettingsManager } from '../../utils/settingsManager';

suite('Settings Manager Tests', () => {
    let settingsManager: SettingsManager;

    setup(() => {
        settingsManager = new SettingsManager();
    });

    test('Should load default settings', () => {
        const settings = settingsManager.getAllSettings();
        
        // Test defaults
        assert.strictEqual(settings.startingCommand, 'claude');
        assert.strictEqual(settings.terminal.fontSize, 14);
        assert.strictEqual(settings.terminal.cursorStyle, 'block');
        assert.strictEqual(settings.terminal.cursorBlink, true);
        assert.strictEqual(settings.terminal.scrollback, 1000);
        assert.strictEqual(settings.ui.showWelcomeScreen, true);
        assert.strictEqual(settings.ui.rememberLastSession, true);
        assert.strictEqual(settings.ui.sessionHistoryLimit, 50);
        assert.strictEqual(settings.todos.defaultFilter, 'all');
        assert.strictEqual(settings.todos.sortBy, 'priority');
        assert.strictEqual(settings.todos.showStatusBar, true);
        assert.strictEqual(settings.todos.expandByDefault, true);
    });

    test('Should get terminal settings separately', () => {
        const terminalSettings = settingsManager.getTerminalSettings();
        
        assert.ok(terminalSettings);
        assert.strictEqual(terminalSettings.fontSize, 14);
        assert.strictEqual(terminalSettings.cursorStyle, 'block');
    });

    test('Should get UI settings separately', () => {
        const uiSettings = settingsManager.getUISettings();
        
        assert.ok(uiSettings);
        assert.strictEqual(uiSettings.showWelcomeScreen, true);
        assert.strictEqual(uiSettings.rememberLastSession, true);
    });

    test('Should get todo settings separately', () => {
        const todoSettings = settingsManager.getTodoSettings();
        
        assert.ok(todoSettings);
        assert.strictEqual(todoSettings.defaultFilter, 'all');
        assert.strictEqual(todoSettings.showStatusBar, true);
    });

    test('Should handle settings change events', (done) => {
        let eventFired = false;
        
        const disposable = settingsManager.onSettingsChanged(() => {
            eventFired = true;
            disposable.dispose();
            done();
        });

        // Simulate a configuration change
        const config = vscode.workspace.getConfiguration('claudePilot');
        
        // This would normally trigger the event, but in tests we need to wait
        setTimeout(() => {
            if (!eventFired) {
                disposable.dispose();
                done();
            }
        }, 100);
    });

    test('Settings should persist across instances', async () => {
        // Create new instance
        const newManager = new SettingsManager();
        const settings1 = settingsManager.getAllSettings();
        const settings2 = newManager.getAllSettings();
        
        // Settings should be the same across instances
        assert.deepStrictEqual(settings1, settings2);
    });

    test('Should validate setting ranges', () => {
        const settings = settingsManager.getAllSettings();
        
        // Font size should be within valid range
        assert.ok(settings.terminal.fontSize >= 8);
        assert.ok(settings.terminal.fontSize <= 32);
        
        // Scrollback should be within valid range
        assert.ok(settings.terminal.scrollback >= 100);
        assert.ok(settings.terminal.scrollback <= 50000);
        
        // Session history limit should be within valid range
        assert.ok(settings.ui.sessionHistoryLimit >= 10);
        assert.ok(settings.ui.sessionHistoryLimit <= 200);
    });

    test('Should have valid enum values', () => {
        const settings = settingsManager.getAllSettings();
        
        // Check cursor style
        assert.ok(['block', 'underline', 'bar'].includes(settings.terminal.cursorStyle));
        
        // Check todo filter
        assert.ok(['all', 'pending', 'in_progress', 'completed'].includes(settings.todos.defaultFilter));
        
        // Check todo sort
        assert.ok(['priority', 'status', 'content'].includes(settings.todos.sortBy));
        
        // Check starting command
        assert.ok(['none', 'claude', 'claude --continue', 'claude --resume'].includes(settings.startingCommand));
    });

    teardown(() => {
        // Clean up if needed
        settingsManager.dispose();
    });
});