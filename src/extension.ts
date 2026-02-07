import * as vscode from 'vscode';
import { ZoteroAPIClient } from './zoteroApiClient';
import { ErrorHandler } from './errorHandler';
import { ConfigurationManager } from './configurationManager';
import { BibTeXFileManager } from './bibtexFileManager';
import { TriggerDetector } from './triggerDetector';
import { CitationInserter } from './citationInserter';
import { ZoteroCiteCompletionProvider } from './completionProvider';
import { StatusBarManager } from './statusBarManager';
import { BibTeXCleaner } from './bibtexCleaner';
import { DuplicateDetector } from './duplicateDetector';
import { TriggerMatch } from './types';

let outputChannel: vscode.OutputChannel;
let apiClient: ZoteroAPIClient;
let errorHandler: ErrorHandler;
let configManager: ConfigurationManager;
let bibFileManager: BibTeXFileManager;
let triggerDetector: TriggerDetector;
let citationInserter: CitationInserter;
let statusBarManager: StatusBarManager;
let isProcessingTrigger: boolean = false;

export function activate(context: vscode.ExtensionContext) {
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Zotero Cite');
    outputChannel.appendLine('Zotero Citation extension activated');

    // Initialize components
    apiClient = new ZoteroAPIClient();
    errorHandler = new ErrorHandler(outputChannel);
    configManager = new ConfigurationManager();
    bibFileManager = new BibTeXFileManager(configManager);
    triggerDetector = new TriggerDetector();
    citationInserter = new CitationInserter();
    statusBarManager = new StatusBarManager(configManager, apiClient);

    // Show status bar items
    statusBarManager.show();
    context.subscriptions.push(statusBarManager);

    // Validate configuration on startup
    configManager.validateConfiguration().then(validation => {
        if (!validation.valid) {
            outputChannel.appendLine('Configuration validation warnings:');
            validation.errors.forEach(error => outputChannel.appendLine(`  - ${error}`));
        }
    });

    // Register completion provider for LaTeX files
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        { language: 'latex', scheme: 'file' },
        new ZoteroCiteCompletionProvider(),
        '\\' // Trigger on backslash
    );
    context.subscriptions.push(completionProvider);

    // Register select .bib file command
    const selectBibFileCommand = vscode.commands.registerCommand(
        'zotero-cite.selectBibFile',
        async () => {
            await statusBarManager.selectBibFile();
        }
    );
    context.subscriptions.push(selectBibFileCommand);

    // Register check connection command
    const checkConnectionCommand = vscode.commands.registerCommand(
        'zotero-cite.checkConnection',
        async () => {
            await statusBarManager.manualConnectionCheck();
        }
    );
    context.subscriptions.push(checkConnectionCommand);

    // Register detect duplicates command
    const detectDuplicatesCommand = vscode.commands.registerCommand(
        'zotero-cite.detectDuplicates',
        async () => {
            await detectDuplicatesInBibFile();
        }
    );
    context.subscriptions.push(detectDuplicatesCommand);

    // Register manual trigger command
    const manualTriggerCommand = vscode.commands.registerCommand(
        'zotero-cite.triggerManually',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const document = editor.document;
            const position = editor.selection.active;

            // Find \zoteroCite before cursor
            const lineContent = document.lineAt(position.line).text;
            const textBeforeCursor = lineContent.substring(0, position.character);
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

                const triggerMatch: TriggerMatch = {
                    range,
                    position
                };

                await handleTriggerDetected(document, triggerMatch);
            }
        }
    );
    context.subscriptions.push(manualTriggerCommand);

    // Register text document change listener for trigger detection
    const changeListener = triggerDetector.createChangeListener(
        (document, match) => handleTriggerDetected(document, match)
    );
    context.subscriptions.push(changeListener);

    outputChannel.appendLine('Extension initialization complete');
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}

export function getOutputChannel(): vscode.OutputChannel {
    return outputChannel;
}

/**
 * Detect duplicates in a .bib file
 */
async function detectDuplicatesInBibFile(): Promise<void> {
    try {
        // Get current .bib file from status bar or prompt user
        let bibFileUri = statusBarManager.getCurrentBibFile();
        
        if (!bibFileUri) {
            bibFileUri = await bibFileManager.selectBibFile();
            
            if (!bibFileUri) {
                return;
            }
            
            statusBarManager.setCurrentBibFile(bibFileUri);
        }

        outputChannel.appendLine(`Detecting duplicates in: ${bibFileUri.fsPath}`);
        
        // Read BibTeX file
        const bibTeXContent = await vscode.workspace.fs.readFile(bibFileUri);
        const bibTeXString = Buffer.from(bibTeXContent).toString('utf8');
        
        // Parse entries
        const entries = DuplicateDetector.parseBibTeX(bibTeXString);
        outputChannel.appendLine(`Found ${entries.length} entries`);
        
        // Find duplicates within the file
        const duplicates: any[] = [];
        
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                const match = (DuplicateDetector as any).compareEntries(entries[i], entries[j]);
                if (match) {
                    duplicates.push(match);
                }
            }
        }
        
        if (duplicates.length === 0) {
            vscode.window.showInformationMessage(`No duplicates found in ${bibFileUri.fsPath}`);
            outputChannel.appendLine('No duplicates detected');
            return;
        }
        
        // Show results
        outputChannel.appendLine(`Found ${duplicates.length} duplicate(s):`);
        duplicates.forEach(d => {
            outputChannel.appendLine(`  - ${d.newEntry.key} ↔ ${d.existingEntry.key} (${d.reason})`);
        });
        
        const message = `Found ${duplicates.length} potential duplicate${duplicates.length > 1 ? 's' : ''} in ${bibFileUri.fsPath}.\n\nCheck the Output panel (Zotero Cite) for details.`;
        
        const action = await vscode.window.showWarningMessage(
            message,
            'View Output',
            'OK'
        );
        
        if (action === 'View Output') {
            outputChannel.show();
        }
        
    } catch (error) {
        outputChannel.appendLine(`Error detecting duplicates: ${error instanceof Error ? error.message : error}`);
        await errorHandler.handleError(
            error instanceof Error ? error : new Error(String(error)),
            'Duplicate detection'
        );
    }
}

/**
 * Handle \zoteroCite trigger detection
 */
async function handleTriggerDetected(
    document: vscode.TextDocument,
    match: TriggerMatch
): Promise<void> {
    // Prevent re-entry while processing
    if (isProcessingTrigger) {
        outputChannel.appendLine('Already processing a trigger, ignoring...');
        return;
    }

    isProcessingTrigger = true;
    outputChannel.appendLine(`Trigger detected at line ${match.position.line + 1}`);

    try {
        // Step 1: Check if Zotero and Better BibTeX are available
        outputChannel.appendLine('Checking Zotero availability...');
        const isAvailable = await apiClient.checkAvailability();
        
        if (!isAvailable) {
            throw new Error('Zotero is not running or Better BibTeX plugin is not installed. Please start Zotero and ensure Better BibTeX is installed.');
        }

        outputChannel.appendLine('Zotero is available');

        // Step 2: Invoke CAYW picker
        outputChannel.appendLine('Opening Zotero picker...');
        
        // Set picker in use flag to prevent concurrent API calls
        statusBarManager.setPickerInUse(true);
        
        let citationKeys: string[];
        try {
            citationKeys = await apiClient.invokePicker();
        } finally {
            // Always clear the flag, even if picker fails
            statusBarManager.setPickerInUse(false);
        }

        // User cancelled
        if (citationKeys.length === 0) {
            outputChannel.appendLine('User cancelled picker');
            
            // Delete the \zoteroCite trigger since user cancelled
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === document) {
                await editor.edit((editBuilder) => {
                    editBuilder.delete(match.range);
                });
                outputChannel.appendLine('Removed \\zoteroCite trigger after cancellation');
            }
            
            isProcessingTrigger = false;
            return;
        }

        outputChannel.appendLine(`Selected ${citationKeys.length} citation(s): ${citationKeys.join(', ')}`);

        // Step 3: Fetch BibTeX entries using citation keys
        outputChannel.appendLine('Fetching BibTeX entries...');
        const bibtex = await apiClient.exportBibTeX(citationKeys);

        if (!bibtex) {
            throw new Error('Failed to fetch BibTeX entries from Zotero');
        }

        outputChannel.appendLine(`Fetched BibTeX (${bibtex.length} characters)`);

        // Clean BibTeX entries (remove annotation and other unwanted fields)
        const cleanedBibtex = BibTeXCleaner.cleanBibTeX(bibtex);
        outputChannel.appendLine(`Cleaned BibTeX (removed fields: ${BibTeXCleaner.getRemovedFields().join(', ')})`);
        outputChannel.appendLine(`Cleaned BibTeX (${cleanedBibtex.length} characters)`);

        // Step 4: Determine target .bib file
        outputChannel.appendLine('Selecting .bib file...');
        
        // First try to get from status bar
        let bibFileUri = statusBarManager.getCurrentBibFile();
        
        // If no file selected in status bar, prompt user
        if (!bibFileUri) {
            bibFileUri = await bibFileManager.selectBibFile();
            
            if (!bibFileUri) {
                // User cancelled file selection
                outputChannel.appendLine('User cancelled .bib file selection');
                
                // Delete the \zoteroCite trigger since user cancelled
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document === document) {
                    await editor.edit((editBuilder) => {
                        editBuilder.delete(match.range);
                    });
                    outputChannel.appendLine('Removed \\zoteroCite trigger after cancellation');
                }
                
                isProcessingTrigger = false;
                return;
            }
            
            // Update status bar with selected file
            statusBarManager.setCurrentBibFile(bibFileUri);
        }

        outputChannel.appendLine(`Using .bib file: ${bibFileUri.fsPath}`);

        // Step 5: Check for duplicates and append entries
        if (configManager.isAutoAppendEnabled()) {
            outputChannel.appendLine('Parsing existing .bib file...');
            const existingKeys = await bibFileManager.parseBibFile(bibFileUri);
            outputChannel.appendLine(`Found ${existingKeys.size} existing entries`);

            // Read existing BibTeX content for duplicate detection
            const existingBibTeX = await vscode.workspace.fs.readFile(bibFileUri);
            const existingBibTeXString = Buffer.from(existingBibTeX).toString('utf8');

            // Detect potential duplicates
            outputChannel.appendLine('Checking for potential duplicates...');
            const duplicates = DuplicateDetector.detectDuplicates(cleanedBibtex, existingBibTeXString);
            
            if (duplicates.length > 0) {
                outputChannel.appendLine(`Found ${duplicates.length} potential duplicate(s)`);
                
                // Show dialog to user
                const action = await DuplicateDetector.showDuplicateDialog(duplicates);
                
                if (action === 'cancel') {
                    outputChannel.appendLine('User cancelled due to duplicates');
                    isProcessingTrigger = false;
                    return;
                }
                
                if (action === 'skip') {
                    // Filter out duplicates from new entries
                    const filteredBibtex = DuplicateDetector.filterDuplicates(cleanedBibtex, duplicates, 'skip');
                    
                    if (filteredBibtex.trim().length === 0) {
                        vscode.window.showInformationMessage('All selected entries already exist in the .bib file');
                        isProcessingTrigger = false;
                        return;
                    }
                    
                    outputChannel.appendLine('Appending non-duplicate entries...');
                    await bibFileManager.appendEntries(bibFileUri, filteredBibtex, existingKeys);
                } else if (action === 'replace') {
                    // Remove duplicates from existing file, then append new entries
                    const cleanedExisting = DuplicateDetector.removeDuplicatesFromExisting(existingBibTeXString, duplicates);
                    
                    // Write cleaned existing + new entries
                    const combined = cleanedExisting + '\n\n' + cleanedBibtex;
                    await vscode.workspace.fs.writeFile(bibFileUri, Buffer.from(combined, 'utf8'));
                    
                    outputChannel.appendLine('Replaced duplicate entries with new versions');
                } else {
                    // keep-both: append all entries
                    outputChannel.appendLine('Appending all entries (keeping duplicates)...');
                    await bibFileManager.appendEntries(bibFileUri, cleanedBibtex, new Set());
                }
            } else {
                outputChannel.appendLine('No duplicates found');
                outputChannel.appendLine('Appending new entries...');
                await bibFileManager.appendEntries(bibFileUri, cleanedBibtex, existingKeys);
            }
            
            outputChannel.appendLine('BibTeX entries appended successfully');
        }

        // Step 6: Replace \zoteroCite with \cite{keys}
        outputChannel.appendLine('Replacing trigger with citation command...');
        const success = await citationInserter.replaceTrigger(
            document,
            match.range,
            citationKeys
        );

        if (success) {
            outputChannel.appendLine('Citation inserted successfully');
            vscode.window.showInformationMessage(
                `Inserted ${citationKeys.length} citation(s) from Zotero`
            );
        } else {
            throw new Error('Failed to replace trigger with citation command');
        }

    } catch (error) {
        outputChannel.appendLine(`Error: ${error instanceof Error ? error.message : error}`);
        await errorHandler.handleError(
            error instanceof Error ? error : new Error(String(error)),
            'Citation insertion'
        );
    } finally {
        // Always clear the flag, even if there was an error
        isProcessingTrigger = false;
    }
}
