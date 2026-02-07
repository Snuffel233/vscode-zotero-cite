/**
 * Completion Provider for \zoteroCite command
 */

import * as vscode from 'vscode';

export class ZoteroCiteCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.CompletionItem[] | undefined {
        // Get the text before cursor
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Only provide completion after backslash
        if (!linePrefix.endsWith('\\') && !linePrefix.match(/\\z(o(t(e(r(o(C(i(t(e?)?)?)?)?)?)?)?)?)?$/)) {
            return undefined;
        }

        const completionItem = new vscode.CompletionItem(
            'zoteroCite',
            vscode.CompletionItemKind.Function
        );

        completionItem.insertText = 'zoteroCite';
        completionItem.detail = 'Insert citation from Zotero';
        completionItem.documentation = new vscode.MarkdownString(
            'Insert a citation from your Zotero library.\n\n' +
            'This will:\n' +
            '1. Open Zotero\'s citation picker\n' +
            '2. Fetch BibTeX entries for selected references\n' +
            '3. Append entries to your .bib file\n' +
            '4. Replace with `\\cite{keys}`\n\n' +
            '**Requirements:**\n' +
            '- Zotero must be running\n' +
            '- Better BibTeX plugin must be installed'
        );

        // Set sort text to appear at top of suggestions
        completionItem.sortText = '0';
        
        // Add command to trigger after insertion
        completionItem.command = {
            command: 'zotero-cite.triggerManually',
            title: 'Trigger Zotero Citation'
        };

        return [completionItem];
    }
}
