/**
 * Configuration Manager for Zotero Citation extension
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ValidationResult } from './types';

export class ConfigurationManager {
    private static readonly CONFIG_SECTION = 'zotero-cite';
    private static readonly DEFAULT_BIB_FILE_KEY = 'defaultBibFile';
    private static readonly AUTO_APPEND_KEY = 'autoAppend';

    /**
     * Get the default .bib file path from configuration
     * Returns undefined if not configured
     */
    getDefaultBibFile(): string | undefined {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        const bibFile = config.get<string>(ConfigurationManager.DEFAULT_BIB_FILE_KEY);
        
        if (!bibFile || bibFile.trim() === '') {
            return undefined;
        }
        
        return bibFile.trim();
    }

    /**
     * Check if auto-append is enabled
     */
    isAutoAppendEnabled(): boolean {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        return config.get<boolean>(ConfigurationManager.AUTO_APPEND_KEY, true);
    }

    /**
     * Resolve a .bib file path (absolute or workspace-relative) to an absolute URI
     */
    resolveBibFilePath(bibFilePath: string): vscode.Uri | null {
        if (!bibFilePath) {
            return null;
        }

        // Check if it's an absolute path
        if (path.isAbsolute(bibFilePath)) {
            return vscode.Uri.file(bibFilePath);
        }

        // Try to resolve as workspace-relative path
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        // Use the first workspace folder as the base
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const absolutePath = path.join(workspaceRoot, bibFilePath);
        
        return vscode.Uri.file(absolutePath);
    }

    /**
     * Validate configuration values
     */
    async validateConfiguration(): Promise<ValidationResult> {
        const errors: string[] = [];
        const bibFile = this.getDefaultBibFile();

        if (bibFile) {
            const bibFileUri = this.resolveBibFilePath(bibFile);
            
            if (!bibFileUri) {
                errors.push(`Cannot resolve .bib file path: ${bibFile}. No workspace folder found.`);
            } else {
                // Check if file exists
                try {
                    await vscode.workspace.fs.stat(bibFileUri);
                    
                    // Check if it's a .bib file
                    if (!bibFileUri.fsPath.toLowerCase().endsWith('.bib')) {
                        errors.push(`Configured file is not a .bib file: ${bibFile}`);
                    }
                } catch (error) {
                    // File doesn't exist - this is a warning, not an error
                    // The file might be created later
                    console.log(`Configured .bib file does not exist yet: ${bibFile}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Show configuration warnings if any
     */
    async showConfigurationWarnings(): Promise<void> {
        const validation = await this.validateConfiguration();
        
        if (!validation.valid) {
            const message = `Zotero Citation configuration issues:\n\n${validation.errors.join('\n')}`;
            await vscode.window.showWarningMessage(message);
        }
    }
}
