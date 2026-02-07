/**
 * Status Bar Manager for displaying and selecting .bib file
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from './configurationManager';
import { ZoteroAPIClient } from './zoteroApiClient';

export class StatusBarManager {
    private bibFileStatusBarItem: vscode.StatusBarItem;
    private zoteroStatusBarItem: vscode.StatusBarItem;
    private currentBibFile: vscode.Uri | null = null;
    private zoteroConnected: boolean = false;
    private checkInterval: NodeJS.Timeout | null = null;
    private isCheckingConnection: boolean = false;
    private pickerInUse: boolean = false;

    constructor(
        private configManager: ConfigurationManager,
        private apiClient: ZoteroAPIClient
    ) {
        // Create .bib file status bar item (aligned to right, priority 100)
        this.bibFileStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        this.bibFileStatusBarItem.command = 'zotero-cite.selectBibFile';
        this.bibFileStatusBarItem.tooltip = 'Click to select .bib file for Zotero citations';
        
        // Create Zotero connection status bar item (aligned to right, priority 101)
        this.zoteroStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            101
        );
        
        this.zoteroStatusBarItem.command = 'zotero-cite.checkConnection';
        
        // Initialize with configured file if available
        this.updateFromConfig();
        
        // Start checking Zotero connection
        this.startConnectionCheck();
    }

    /**
     * Start periodic connection check
     */
    private startConnectionCheck(): void {
        // Check immediately
        this.checkZoteroConnection();
        
        // Then check every 10 seconds
        this.checkInterval = setInterval(() => {
            this.checkZoteroConnection();
        }, 10000);
    }

    /**
     * Check Zotero connection status
     */
    private async checkZoteroConnection(): Promise<void> {
        // Skip if already checking or picker is in use
        if (this.isCheckingConnection || this.pickerInUse) {
            return;
        }

        this.isCheckingConnection = true;
        try {
            const isConnected = await this.apiClient.checkAvailability();
            this.setZoteroStatus(isConnected);
        } catch (error) {
            this.setZoteroStatus(false);
        } finally {
            this.isCheckingConnection = false;
        }
    }

    /**
     * Set Zotero connection status
     */
    private setZoteroStatus(connected: boolean): void {
        this.zoteroConnected = connected;
        this.updateZoteroDisplay();
    }

    /**
     * Update Zotero status bar display
     */
    private updateZoteroDisplay(): void {
        if (this.zoteroConnected) {
            this.zoteroStatusBarItem.text = '$(check) Zotero';
            this.zoteroStatusBarItem.tooltip = 'Zotero is connected and ready\n\nClick to refresh connection';
            this.zoteroStatusBarItem.backgroundColor = undefined;
        } else {
            this.zoteroStatusBarItem.text = '$(x) Zotero';
            this.zoteroStatusBarItem.tooltip = 'Zotero is not connected\n\nPlease start Zotero and ensure Better BibTeX is installed\n\nClick to retry connection';
            this.zoteroStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    /**
     * Update status bar from configuration
     */
    private updateFromConfig(): void {
        const defaultBibFile = this.configManager.getDefaultBibFile();
        if (defaultBibFile) {
            const bibFileUri = this.configManager.resolveBibFilePath(defaultBibFile);
            if (bibFileUri) {
                this.currentBibFile = bibFileUri;
            }
        }
        this.updateBibFileDisplay();
    }

    /**
     * Update .bib file status bar display
     */
    private updateBibFileDisplay(): void {
        if (this.currentBibFile) {
            const fileName = this.currentBibFile.fsPath.split(/[/\\]/).pop() || 'unknown';
            this.bibFileStatusBarItem.text = `$(book) ${fileName}`;
            this.bibFileStatusBarItem.tooltip = `Current .bib file: ${this.currentBibFile.fsPath}\n\nClick to change`;
        } else {
            this.bibFileStatusBarItem.text = '$(book) No .bib file';
            this.bibFileStatusBarItem.tooltip = 'Click to select .bib file for Zotero citations';
        }
    }

    /**
     * Show status bar items
     */
    show(): void {
        this.bibFileStatusBarItem.show();
        this.zoteroStatusBarItem.show();
    }

    /**
     * Hide status bar items
     */
    hide(): void {
        this.bibFileStatusBarItem.hide();
        this.zoteroStatusBarItem.hide();
    }

    /**
     * Get current .bib file
     */
    getCurrentBibFile(): vscode.Uri | null {
        return this.currentBibFile;
    }

    /**
     * Set current .bib file
     */
    setCurrentBibFile(bibFileUri: vscode.Uri | null): void {
        this.currentBibFile = bibFileUri;
        this.updateBibFileDisplay();
    }

    /**
     * Get Zotero connection status
     */
    isZoteroConnected(): boolean {
        return this.zoteroConnected;
    }

    /**
     * Set picker in use flag to prevent concurrent API calls
     */
    setPickerInUse(inUse: boolean): void {
        this.pickerInUse = inUse;
    }

    /**
     * Manually check connection (called by command)
     */
    async manualConnectionCheck(): Promise<void> {
        await this.checkZoteroConnection();
        
        if (this.zoteroConnected) {
            vscode.window.showInformationMessage('✓ Zotero is connected and ready');
        } else {
            vscode.window.showErrorMessage(
                'Zotero is not connected. Please start Zotero and ensure Better BibTeX plugin is installed.'
            );
        }
    }

    /**
     * Prompt user to select .bib file
     */
    async selectBibFile(): Promise<vscode.Uri | null> {
        const selected = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'BibTeX Files': ['bib']
            },
            title: 'Select .bib file for Zotero citations'
        });

        if (selected && selected.length > 0) {
            this.setCurrentBibFile(selected[0]);
            
            // Ask if user wants to save as default
            const saveAsDefault = await vscode.window.showInformationMessage(
                `Set ${selected[0].fsPath} as default .bib file?`,
                'Yes',
                'No'
            );

            if (saveAsDefault === 'Yes') {
                await this.saveAsDefault(selected[0]);
            }

            return selected[0];
        }

        return null;
    }

    /**
     * Save .bib file as default in workspace settings
     */
    private async saveAsDefault(bibFileUri: vscode.Uri): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            // Save as absolute path if no workspace
            await vscode.workspace.getConfiguration('zotero-cite').update(
                'defaultBibFile',
                bibFileUri.fsPath,
                vscode.ConfigurationTarget.Global
            );
        } else {
            // Try to save as workspace-relative path
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const bibPath = bibFileUri.fsPath;
            
            let relativePath = bibPath;
            if (bibPath.startsWith(workspaceRoot)) {
                relativePath = bibPath.substring(workspaceRoot.length + 1).replace(/\\/g, '/');
            }

            await vscode.workspace.getConfiguration('zotero-cite').update(
                'defaultBibFile',
                relativePath,
                vscode.ConfigurationTarget.Workspace
            );
        }

        vscode.window.showInformationMessage('Default .bib file saved to settings');
    }

    /**
     * Dispose status bar items and stop checking
     */
    dispose(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.bibFileStatusBarItem.dispose();
        this.zoteroStatusBarItem.dispose();
    }
}
