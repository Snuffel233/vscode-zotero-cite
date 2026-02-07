/**
 * Citation Inserter for replacing \zoteroCite with \cite{keys}
 */

import * as vscode from 'vscode';

export class CitationInserter {
    /**
     * Check if position is inside a \cite{} command
     */
    private isInsideCiteCommand(
        document: vscode.TextDocument,
        position: vscode.Position
    ): { inside: boolean; range?: vscode.Range; existingKeys?: string[]; fullRange?: vscode.Range } {
        const line = document.lineAt(position.line).text;
        
        // Find all \cite{...} patterns in the line
        const citePattern = /\\cite\{([^}]*)\}/g;
        let match;
        
        while ((match = citePattern.exec(line)) !== null) {
            const startPos = match.index + 6; // After "\cite{"
            const endPos = match.index + match[0].length - 1; // Before "}"
            
            // Check if cursor is inside this \cite{}
            if (position.character >= startPos && position.character <= endPos) {
                const existingContent = match[1].trim();
                // Split by comma and filter out \zoteroCite and empty strings
                const existingKeys = existingContent 
                    ? existingContent.split(',')
                        .map(k => k.trim())
                        .filter(k => k && !k.includes('zoteroCite'))
                    : [];
                
                return {
                    inside: true,
                    range: new vscode.Range(
                        position.line,
                        startPos,
                        position.line,
                        endPos
                    ),
                    fullRange: new vscode.Range(
                        position.line,
                        match.index,
                        position.line,
                        match.index + match[0].length
                    ),
                    existingKeys
                };
            }
        }
        
        return { inside: false };
    }

    /**
     * Format citation keys as \cite{key1,key2,...}
     */
    private formatCitation(citationKeys: string[]): string {
        if (citationKeys.length === 0) {
            return '';
        }

        // Join keys with commas (no spaces)
        const keysString = citationKeys.join(',');
        return `\\cite{${keysString}}`;
    }

    /**
     * Format citation keys for insertion inside existing \cite{}
     */
    private formatKeysOnly(newKeys: string[], existingKeys: string[]): string {
        // Combine existing and new keys, removing duplicates
        const allKeys = [...existingKeys, ...newKeys];
        const uniqueKeys = Array.from(new Set(allKeys));
        
        return uniqueKeys.join(',');
    }

    /**
     * Replace \zoteroCite trigger with \cite{keys} command
     * or append keys to existing \cite{} if inside one
     */
    async replaceTrigger(
        document: vscode.TextDocument,
        range: vscode.Range,
        citationKeys: string[]
    ): Promise<boolean> {
        if (citationKeys.length === 0) {
            return false;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
            return false;
        }

        // Check if \zoteroCite is inside a \cite{} command
        const citeContext = this.isInsideCiteCommand(document, range.start);

        let success: boolean;

        if (citeContext.inside && citeContext.range && citeContext.existingKeys && citeContext.fullRange) {
            // We're inside a \cite{}, replace the entire \cite{} command in one atomic operation
            // This prevents triggering the detector multiple times
            
            // Combine existing keys (already filtered to exclude \zoteroCite) with new keys
            const allKeys = [...citeContext.existingKeys, ...citationKeys];
            const uniqueKeys = Array.from(new Set(allKeys));
            
            // Create the new \cite{} command
            const newCiteCommand = this.formatCitation(uniqueKeys);
            
            // Replace the entire \cite{} command
            success = await editor.edit((editBuilder) => {
                editBuilder.replace(citeContext.fullRange!, newCiteCommand);
            });

            if (success) {
                // Position cursor after the closing brace
                const newPosition = new vscode.Position(
                    citeContext.fullRange.start.line,
                    citeContext.fullRange.start.character + newCiteCommand.length
                );
                editor.selection = new vscode.Selection(newPosition, newPosition);
            }
        } else {
            // We're not inside a \cite{}, create a new one
            const replacement = this.formatCitation(citationKeys);

            success = await editor.edit((editBuilder) => {
                editBuilder.replace(range, replacement);
            });

            if (success) {
                // Position cursor after the closing brace
                const newPosition = new vscode.Position(
                    range.start.line,
                    range.start.character + replacement.length
                );
                editor.selection = new vscode.Selection(newPosition, newPosition);
            }
        }

        return success;
    }
}
