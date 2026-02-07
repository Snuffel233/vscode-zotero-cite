/**
 * BibTeX File Manager for handling .bib file operations
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from './configurationManager';

export class BibTeXFileManager {
    constructor(
        private configManager: ConfigurationManager
    ) {}

    /**
     * Get the configured .bib file or prompt user to select one
     */
    async selectBibFile(): Promise<vscode.Uri | null> {
        // First, check if there's a configured default
        const defaultBibFile = this.configManager.getDefaultBibFile();
        
        if (defaultBibFile) {
            const bibFileUri = this.configManager.resolveBibFilePath(defaultBibFile);
            if (bibFileUri) {
                return bibFileUri;
            }
        }

        // No default configured, prompt user to select
        const selected = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'BibTeX Files': ['bib']
            },
            title: 'Select .bib file for citations'
        });

        if (!selected || selected.length === 0) {
            return null; // User cancelled
        }

        return selected[0];
    }

    /**
     * Parse .bib file and extract existing citation keys
     */
    async parseBibFile(fileUri: vscode.Uri): Promise<Set<string>> {
        const keys = new Set<string>();

        try {
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const content = Buffer.from(fileContent).toString('utf8');

            // Use regex to extract citation keys: @type{key,
            const regex = /^@\w+\{([^,]+),/gm;
            let match;

            while ((match = regex.exec(content)) !== null) {
                const key = match[1].trim();
                if (key) {
                    keys.add(key);
                }
            }
        } catch (error) {
            // File might not exist yet, return empty set
            console.log(`Could not read .bib file: ${error}`);
        }

        return keys;
    }

    /**
     * Append BibTeX entries to file, skipping duplicates
     */
    async appendEntries(
        fileUri: vscode.Uri,
        bibtexEntries: string,
        existingKeys: Set<string>
    ): Promise<void> {
        // Parse the new entries to extract their keys
        const newEntries: Array<{ key: string; content: string }> = [];
        const entryRegex = /(@\w+\{[^,]+,[\s\S]*?\n\})/g;
        const keyRegex = /@\w+\{([^,]+),/;

        let match;
        while ((match = entryRegex.exec(bibtexEntries)) !== null) {
            const entryContent = match[1];
            const keyMatch = keyRegex.exec(entryContent);
            
            if (keyMatch) {
                const key = keyMatch[1].trim();
                newEntries.push({ key, content: entryContent });
            }
        }

        // Filter out entries that already exist
        const entriesToAppend = newEntries.filter(entry => !existingKeys.has(entry.key));

        if (entriesToAppend.length === 0) {
            // All entries already exist
            return;
        }

        // Read existing file content (or empty string if file doesn't exist)
        let existingContent = '';
        try {
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            existingContent = Buffer.from(fileContent).toString('utf8');
        } catch (error) {
            // File doesn't exist, will be created
        }

        // Ensure existing content ends with newline
        if (existingContent && !existingContent.endsWith('\n')) {
            existingContent += '\n';
        }

        // Append new entries
        const newContent = existingContent + '\n' + entriesToAppend.map(e => e.content).join('\n\n') + '\n';

        // Write back to file
        await vscode.workspace.fs.writeFile(
            fileUri,
            Buffer.from(newContent, 'utf8')
        );
    }

    /**
     * Get the configured .bib file URI (without prompting)
     */
    getConfiguredBibFile(): vscode.Uri | null {
        const defaultBibFile = this.configManager.getDefaultBibFile();
        
        if (!defaultBibFile) {
            return null;
        }

        return this.configManager.resolveBibFilePath(defaultBibFile);
    }
}
