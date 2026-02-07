/**
 * Trigger Detector for \zoteroCite command
 */

import * as vscode from 'vscode';
import { TriggerMatch } from './types';

export class TriggerDetector {
    private static readonly TRIGGER_PATTERN = /\\zoteroCite\b/;

    /**
     * Check if document is a LaTeX file
     */
    private isLatexFile(document: vscode.TextDocument): boolean {
        return document.languageId === 'latex' || document.fileName.endsWith('.tex');
    }

    /**
     * Detect \zoteroCite trigger in document changes
     */
    detectTrigger(
        document: vscode.TextDocument,
        changes: readonly vscode.TextDocumentContentChangeEvent[]
    ): TriggerMatch | null {
        // Only process LaTeX files
        if (!this.isLatexFile(document)) {
            console.log('[TriggerDetector] Not a LaTeX file:', document.fileName, 'languageId:', document.languageId);
            return null;
        }

        // Check each change for the trigger pattern
        for (const change of changes) {
            console.log('[TriggerDetector] Change detected:', change.text);
            if (change.text.includes('zoteroCite')) {
                // Get the position after the change
                const position = new vscode.Position(
                    change.range.start.line,
                    change.range.start.character + change.text.length
                );

                // Get the line content at this position
                const lineContent = document.lineAt(position.line).text;
                const textBeforeCursor = lineContent.substring(0, position.character);

                // Check if \zoteroCite is complete (with word boundary)
                if (TriggerDetector.TRIGGER_PATTERN.test(textBeforeCursor)) {
                    // Find the exact range of \zoteroCite
                    const match = textBeforeCursor.match(/\\zoteroCite\b/);
                    if (match && match.index !== undefined) {
                        const startChar = match.index;
                        const endChar = startChar + match[0].length;

                        const range = new vscode.Range(
                            position.line,
                            startChar,
                            position.line,
                            endChar
                        );

                        return {
                            range,
                            position
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Create a document change listener
     */
    createChangeListener(
        onTriggerDetected: (document: vscode.TextDocument, match: TriggerMatch) => void
    ): vscode.Disposable {
        return vscode.workspace.onDidChangeTextDocument((event) => {
            const match = this.detectTrigger(event.document, event.contentChanges);
            if (match) {
                onTriggerDetected(event.document, match);
            }
        });
    }
}
