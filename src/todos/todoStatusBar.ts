/**
 * Todo Status Bar Manager for Claude Pilot
 * 
 * Manages the status bar item that displays todo completion progress
 * and provides quick access to the todo view.
 */

import * as vscode from 'vscode';
import { TodoManager, TodoStats } from './todoManager';
import { SettingsManager } from '../utils/settingsManager';

export class TodoStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private todoManager: TodoManager;
    private settingsManager: SettingsManager;
    private updateDebounceTimer?: NodeJS.Timeout;
    
    constructor(todoManager: TodoManager) {
        this.todoManager = todoManager;
        this.settingsManager = new SettingsManager();
        
        // Create status bar item with high priority
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        
        // Set up the command to focus on todo view
        this.statusBarItem.command = 'claudePilotTodos.focus';
        
        // Initialize the status bar
        this.update();
        
        // Listen for todo changes with debouncing
        this.todoManager.on('todoChanged', () => {
            this.debouncedUpdate();
        });
        
        // Listen for settings changes
        this.settingsManager.onSettingsChanged(() => {
            this.update();
        });
    }
    
    /**
     * Update the status bar with current todo stats
     */
    private update(): void {
        // Check if status bar should be shown based on settings
        const settings = this.settingsManager.getTodoSettings();
        if (!settings.showStatusBar) {
            this.statusBarItem.hide();
            return;
        }
        
        const stats = this.todoManager.getTodoStats();
        
        if (stats.total === 0) {
            // Hide status bar when no todos
            this.statusBarItem.hide();
            return;
        }
        
        // Calculate completion percentage
        const completionPercentage = Math.round((stats.completed / stats.total) * 100);
        
        // Update text with icon and progress
        this.statusBarItem.text = this.getStatusBarText(stats, completionPercentage);
        
        // Update tooltip with detailed information
        this.statusBarItem.tooltip = this.getStatusBarTooltip(stats, completionPercentage);
        
        // Update background color based on priority
        this.statusBarItem.backgroundColor = this.getBackgroundColor(stats);
        
        // Show the status bar
        this.statusBarItem.show();
    }
    
    /**
     * Debounced update to prevent flashing during rapid changes
     */
    private debouncedUpdate(): void {
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
        }
        
        this.updateDebounceTimer = setTimeout(() => {
            this.update();
        }, 300);
    }
    
    /**
     * Get the status bar text with appropriate icon
     */
    private getStatusBarText(stats: TodoStats, percentage: number): string {
        // Use different icons based on completion status
        let icon: string;
        if (percentage === 100) {
            icon = '$(pass-filled)';
        } else if (percentage >= 75) {
            icon = '$(checklist-3)';
        } else if (percentage >= 50) {
            icon = '$(checklist-2)';
        } else if (percentage >= 25) {
            icon = '$(checklist-1)';
        } else {
            icon = '$(checklist)';
        }
        
        // Show high priority indicator if there are high priority pending todos
        const highPriorityIndicator = stats.highPriority > 0 ? ' $(warning)' : '';
        
        return `${icon} ${stats.completed}/${stats.total}${highPriorityIndicator}`;
    }
    
    /**
     * Get detailed tooltip text
     */
    private getStatusBarTooltip(stats: TodoStats, percentage: number): string | vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;
        
        // Title
        tooltip.appendMarkdown(`**Claude Pilot Todos** (${percentage}% complete)\n\n`);
        
        // Progress bar visualization
        const progressBar = this.createProgressBar(percentage);
        tooltip.appendMarkdown(`${progressBar}\n\n`);
        
        // Stats breakdown
        tooltip.appendMarkdown('**Status Breakdown:**\n');
        tooltip.appendMarkdown(`- $(pass-filled) Completed: ${stats.completed}\n`);
        tooltip.appendMarkdown(`- $(sync) In Progress: ${stats.inProgress}\n`);
        tooltip.appendMarkdown(`- $(circle-outline) Pending: ${stats.pending}\n\n`);
        
        // Priority breakdown if applicable
        if (stats.highPriority > 0 || stats.mediumPriority > 0 || stats.lowPriority > 0) {
            tooltip.appendMarkdown('**Priority Breakdown:**\n');
            if (stats.highPriority > 0) {
                tooltip.appendMarkdown(`- $(warning) High: ${stats.highPriority}\n`);
            }
            if (stats.mediumPriority > 0) {
                tooltip.appendMarkdown(`- $(info) Medium: ${stats.mediumPriority}\n`);
            }
            if (stats.lowPriority > 0) {
                tooltip.appendMarkdown(`- $(circle-outline) Low: ${stats.lowPriority}\n`);
            }
            tooltip.appendMarkdown('\n');
        }
        
        // Action hint
        tooltip.appendMarkdown('*Click to open todo view*');
        
        return tooltip;
    }
    
    /**
     * Create a visual progress bar for the tooltip
     */
    private createProgressBar(percentage: number): string {
        const barLength = 20;
        const filledLength = Math.round((percentage / 100) * barLength);
        const emptyLength = barLength - filledLength;
        
        const filled = '█'.repeat(filledLength);
        const empty = '░'.repeat(emptyLength);
        
        return `\`${filled}${empty}\` ${percentage}%`;
    }
    
    /**
     * Get background color based on todo priorities
     */
    private getBackgroundColor(stats: TodoStats): vscode.ThemeColor | undefined {
        // Highlight if there are high priority incomplete todos
        if (stats.highPriority > 0 && stats.completed < stats.total) {
            return new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        
        // Success color if all todos are completed
        if (stats.completed === stats.total && stats.total > 0) {
            return new vscode.ThemeColor('statusBarItem.prominentBackground');
        }
        
        return undefined;
    }
    
    /**
     * Force an immediate update
     */
    public refresh(): void {
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
        }
        this.update();
    }
    
    /**
     * Dispose of the status bar
     */
    public dispose(): void {
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
        }
        this.statusBarItem.dispose();
    }
}