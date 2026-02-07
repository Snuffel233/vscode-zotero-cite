/**
 * BibTeX Cleaner - Remove unwanted fields from BibTeX entries
 */

import * as vscode from 'vscode';

export class BibTeXCleaner {
    // Default fields to remove
    private static readonly DEFAULT_FIELDS_TO_REMOVE = [
        'annotation',
        'file',
    ];

    /**
     * Get fields to remove from configuration
     */
    private static getFieldsToRemove(): string[] {
        const config = vscode.workspace.getConfiguration('zotero-cite');
        const configuredFields = config.get<string[]>('removeFields');
        
        if (configuredFields && Array.isArray(configuredFields)) {
            return configuredFields.map(f => f.toLowerCase());
        }
        
        return this.DEFAULT_FIELDS_TO_REMOVE;
    }

    /**
     * Clean BibTeX entries by removing unwanted fields
     */
    static cleanBibTeX(bibtex: string): string {
        const fieldsToRemove = this.getFieldsToRemove();
        
        if (fieldsToRemove.length === 0) {
            return bibtex; // No cleaning needed
        }

        // Split into individual entries
        const entries = this.splitEntries(bibtex);
        
        // Clean each entry
        const cleanedEntries = entries.map(entry => this.cleanEntry(entry, fieldsToRemove));
        
        // Join back together
        return cleanedEntries.join('\n\n');
    }

    /**
     * Split BibTeX string into individual entries
     */
    private static splitEntries(bibtex: string): string[] {
        const entries: string[] = [];
        const lines = bibtex.split('\n');
        let currentEntry: string[] = [];
        let inEntry = false;
        let braceCount = 0;

        for (const line of lines) {
            // Check if this line starts an entry
            if (line.trim().match(/^@\w+\{/)) {
                if (currentEntry.length > 0) {
                    entries.push(currentEntry.join('\n'));
                }
                currentEntry = [line];
                inEntry = true;
                braceCount = 1;
            } else if (inEntry) {
                currentEntry.push(line);
                
                // Count braces to detect end of entry
                for (const char of line) {
                    if (char === '{') braceCount++;
                    if (char === '}') braceCount--;
                }

                if (braceCount === 0) {
                    inEntry = false;
                }
            }
        }

        // Add last entry
        if (currentEntry.length > 0) {
            entries.push(currentEntry.join('\n'));
        }

        return entries;
    }

    /**
     * Clean a single BibTeX entry
     */
    private static cleanEntry(entry: string, fieldsToRemove: string[]): string {
        const lines = entry.split('\n');
        const cleanedLines: string[] = [];
        let skipNextLines = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Keep the entry header (@article{key,)
            if (trimmed.match(/^@\w+\{/)) {
                cleanedLines.push(line);
                continue;
            }

            // Keep the closing brace
            if (trimmed === '}' && i === lines.length - 1) {
                cleanedLines.push(line);
                continue;
            }

            // Check if this line starts a field to remove
            const fieldMatch = trimmed.match(/^(\w+)\s*=/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1].toLowerCase();
                
                if (fieldsToRemove.includes(fieldName)) {
                    // Skip this field
                    // Check if field value spans multiple lines (ends with comma or not)
                    if (!trimmed.endsWith(',')) {
                        skipNextLines = true;
                    }
                    continue;
                }
            }

            // If we're skipping a multi-line field value
            if (skipNextLines) {
                // Continue skipping until we find a line ending with comma or new field
                if (trimmed.endsWith(',') || trimmed.match(/^\w+\s*=/)) {
                    skipNextLines = false;
                    
                    // If this line starts a new field, process it
                    if (trimmed.match(/^\w+\s*=/)) {
                        const fieldMatch = trimmed.match(/^(\w+)\s*=/);
                        if (fieldMatch) {
                            const fieldName = fieldMatch[1].toLowerCase();
                            if (!fieldsToRemove.includes(fieldName)) {
                                cleanedLines.push(line);
                            }
                        }
                    }
                }
                continue;
            }

            // Keep this line
            cleanedLines.push(line);
        }

        return cleanedLines.join('\n');
    }

    /**
     * Get list of fields that will be removed
     */
    static getRemovedFields(): string[] {
        return this.getFieldsToRemove();
    }
}
