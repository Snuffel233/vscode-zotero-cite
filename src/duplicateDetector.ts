/**
 * Duplicate Detector for BibTeX entries
 * Detects potential duplicates based on multiple dimensions:
 * - Citation key
 * - DOI
 * - Title similarity
 * - Author + Year combination
 */

import * as vscode from 'vscode';

export interface BibTeXEntry {
    key: string;
    type: string;
    fields: Map<string, string>;
    rawText: string;
}

export interface DuplicateMatch {
    newEntry: BibTeXEntry;
    existingEntry: BibTeXEntry;
    matchType: 'key' | 'doi' | 'title' | 'author-year';
    similarity: number; // 0-1
    reason: string;
}

export class DuplicateDetector {
    /**
     * Parse BibTeX string into entries
     */
    static parseBibTeX(bibtex: string): BibTeXEntry[] {
        const entries: BibTeXEntry[] = [];
        
        // Match @type{key, ... }
        const entryPattern = /@(\w+)\s*\{\s*([^,\s]+)\s*,([^@]*?)(?=\n@|\n*$)/gs;
        let match;
        
        while ((match = entryPattern.exec(bibtex)) !== null) {
            const type = match[1].toLowerCase();
            const key = match[2].trim();
            const fieldsText = match[3];
            
            const fields = new Map<string, string>();
            
            // Parse fields: field = {value} or field = "value"
            const fieldPattern = /(\w+)\s*=\s*[{"](.*?)[}"]\s*(?:,|$)/gs;
            let fieldMatch;
            
            while ((fieldMatch = fieldPattern.exec(fieldsText)) !== null) {
                const fieldName = fieldMatch[1].toLowerCase();
                const fieldValue = fieldMatch[2].trim();
                fields.set(fieldName, fieldValue);
            }
            
            entries.push({
                key,
                type,
                fields,
                rawText: match[0]
            });
        }
        
        return entries;
    }

    /**
     * Detect duplicates between new entries and existing entries
     */
    static detectDuplicates(
        newBibTeX: string,
        existingBibTeX: string
    ): DuplicateMatch[] {
        const newEntries = this.parseBibTeX(newBibTeX);
        const existingEntries = this.parseBibTeX(existingBibTeX);
        
        const duplicates: DuplicateMatch[] = [];
        
        for (const newEntry of newEntries) {
            for (const existingEntry of existingEntries) {
                const match = this.compareEntries(newEntry, existingEntry);
                if (match) {
                    duplicates.push(match);
                }
            }
        }
        
        return duplicates;
    }

    /**
     * Compare two entries for potential duplicates
     */
    private static compareEntries(
        newEntry: BibTeXEntry,
        existingEntry: BibTeXEntry
    ): DuplicateMatch | null {
        // 1. Check citation key (exact match)
        if (newEntry.key === existingEntry.key) {
            return {
                newEntry,
                existingEntry,
                matchType: 'key',
                similarity: 1.0,
                reason: `Same citation key: ${newEntry.key}`
            };
        }

        // 2. Check DOI (exact match, case-insensitive)
        const newDOI = newEntry.fields.get('doi')?.toLowerCase();
        const existingDOI = existingEntry.fields.get('doi')?.toLowerCase();
        
        if (newDOI && existingDOI && newDOI === existingDOI) {
            return {
                newEntry,
                existingEntry,
                matchType: 'doi',
                similarity: 1.0,
                reason: `Same DOI: ${newDOI}`
            };
        }

        // 3. Check title similarity
        const newTitle = this.normalizeTitle(newEntry.fields.get('title') || '');
        const existingTitle = this.normalizeTitle(existingEntry.fields.get('title') || '');
        
        if (newTitle && existingTitle) {
            const titleSimilarity = this.calculateSimilarity(newTitle, existingTitle);
            
            if (titleSimilarity > 0.85) {
                return {
                    newEntry,
                    existingEntry,
                    matchType: 'title',
                    similarity: titleSimilarity,
                    reason: `Similar title (${(titleSimilarity * 100).toFixed(0)}% match)`
                };
            }
        }

        // 4. Check author + year combination
        const newAuthor = this.normalizeAuthor(newEntry.fields.get('author') || '');
        const existingAuthor = this.normalizeAuthor(existingEntry.fields.get('author') || '');
        const newYear = newEntry.fields.get('year');
        const existingYear = existingEntry.fields.get('year');
        
        if (newAuthor && existingAuthor && newYear === existingYear) {
            const authorSimilarity = this.calculateSimilarity(newAuthor, existingAuthor);
            
            if (authorSimilarity > 0.8) {
                return {
                    newEntry,
                    existingEntry,
                    matchType: 'author-year',
                    similarity: authorSimilarity,
                    reason: `Similar author and same year (${newYear})`
                };
            }
        }

        return null;
    }

    /**
     * Normalize title for comparison
     */
    private static normalizeTitle(title: string): string {
        return title
            .toLowerCase()
            .replace(/[{}\\]/g, '') // Remove LaTeX formatting
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    /**
     * Normalize author for comparison
     */
    private static normalizeAuthor(author: string): string {
        return author
            .toLowerCase()
            .replace(/\s+and\s+/g, ' ') // Remove "and"
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Calculate similarity between two strings using Levenshtein distance
     */
    private static calculateSimilarity(str1: string, str2: string): number {
        if (str1 === str2) return 1.0;
        if (str1.length === 0 || str2.length === 0) return 0.0;

        const maxLength = Math.max(str1.length, str2.length);
        const distance = this.levenshteinDistance(str1, str2);
        
        return 1 - (distance / maxLength);
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private static levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Show duplicate detection results to user
     */
    static async showDuplicateDialog(
        duplicates: DuplicateMatch[]
    ): Promise<'skip' | 'replace' | 'keep-both' | 'cancel'> {
        if (duplicates.length === 0) {
            return 'keep-both';
        }

        const message = this.formatDuplicateMessage(duplicates);
        
        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            'Skip Duplicates',
            'Replace Existing',
            'Keep Both',
            'Cancel'
        );

        switch (choice) {
            case 'Skip Duplicates':
                return 'skip';
            case 'Replace Existing':
                return 'replace';
            case 'Keep Both':
                return 'keep-both';
            default:
                return 'cancel';
        }
    }

    /**
     * Format duplicate detection message
     */
    private static formatDuplicateMessage(duplicates: DuplicateMatch[]): string {
        const count = duplicates.length;
        const summary = duplicates.slice(0, 3).map(d => 
            `• ${d.newEntry.key} ↔ ${d.existingEntry.key} (${d.reason})`
        ).join('\n');
        
        const more = count > 3 ? `\n... and ${count - 3} more` : '';
        
        return `Found ${count} potential duplicate${count > 1 ? 's' : ''}:\n\n${summary}${more}\n\nHow would you like to proceed?`;
    }

    /**
     * Filter out duplicate entries based on user choice
     */
    static filterDuplicates(
        newBibTeX: string,
        duplicates: DuplicateMatch[],
        action: 'skip' | 'replace' | 'keep-both'
    ): string {
        if (action === 'keep-both' || duplicates.length === 0) {
            return newBibTeX;
        }

        const newEntries = this.parseBibTeX(newBibTeX);
        const duplicateKeys = new Set(duplicates.map(d => d.newEntry.key));
        
        if (action === 'skip') {
            // Remove duplicate entries from new BibTeX
            const filtered = newEntries
                .filter(entry => !duplicateKeys.has(entry.key))
                .map(entry => entry.rawText)
                .join('\n\n');
            
            return filtered;
        }

        // For 'replace', we keep the new entries (they will overwrite existing ones)
        return newBibTeX;
    }

    /**
     * Remove duplicate entries from existing BibTeX
     */
    static removeDuplicatesFromExisting(
        existingBibTeX: string,
        duplicates: DuplicateMatch[]
    ): string {
        if (duplicates.length === 0) {
            return existingBibTeX;
        }

        const existingEntries = this.parseBibTeX(existingBibTeX);
        const duplicateKeys = new Set(duplicates.map(d => d.existingEntry.key));
        
        const filtered = existingEntries
            .filter(entry => !duplicateKeys.has(entry.key))
            .map(entry => entry.rawText)
            .join('\n\n');
        
        return filtered;
    }
}
