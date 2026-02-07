/**
 * Error Handler for Zotero Citation extension
 */

import * as vscode from 'vscode';
import { ErrorContext } from './types';

export class ErrorHandler {
    constructor(private outputChannel: vscode.OutputChannel) {}

    /**
     * Classify error based on error message and context
     */
    private classifyError(error: Error): ErrorContext {
        const message = error.message.toLowerCase();

        if (message.includes('already open') || message.includes('already in progress') || message.includes('已在运行')) {
            return ErrorContext.NetworkError; // Will show as connection issue with specific message
        }

        if (message.includes('zotero is not running') || message.includes('econnrefused')) {
            return ErrorContext.ZoteroNotRunning;
        }

        if (message.includes('better bibtex') && (message.includes('not installed') || message.includes('404'))) {
            return ErrorContext.BetterBibTeXNotInstalled;
        }

        if (message.includes('timeout') || message.includes('network') || message.includes('etimedout')) {
            return ErrorContext.NetworkError;
        }

        if (message.includes('file') || message.includes('permission') || message.includes('enoent') || message.includes('eacces')) {
            return ErrorContext.FileAccessError;
        }

        if (message.includes('cancel') || message.includes('cancelled')) {
            return ErrorContext.UserCancelled;
        }

        if (message.includes('configuration') || message.includes('invalid')) {
            return ErrorContext.InvalidConfiguration;
        }

        return ErrorContext.NetworkError; // Default
    }

    /**
     * Get user-friendly error message based on error context
     */
    private getUserMessage(context: ErrorContext, originalMessage: string): string {
        switch (context) {
            case ErrorContext.ZoteroNotRunning:
                return 'Zotero is not running. Please start Zotero and try again.';

            case ErrorContext.BetterBibTeXNotInstalled:
                return 'Better BibTeX plugin is not installed. Please install it from Zotero\'s Add-ons Manager.\n\n' +
                       'Installation steps:\n' +
                       '1. Download from: https://github.com/retorquere/zotero-better-bibtex/releases/latest\n' +
                       '2. In Zotero: Tools → Add-ons → Install Add-on From File\n' +
                       '3. Select the .xpi file and restart Zotero';

            case ErrorContext.NetworkError:
                if (originalMessage.includes('already open') || originalMessage.includes('already in progress') || originalMessage.includes('已在运行')) {
                    return 'Zotero picker is already open in another application.\n\n' +
                           'Please:\n' +
                           '1. Close any other applications using Zotero (Word, LibreOffice, etc.)\n' +
                           '2. Or complete/cancel the current Zotero picker dialog\n' +
                           '3. If the problem persists, restart Zotero';
                }
                return 'Cannot connect to Zotero. Please ensure Zotero is running and Better BibTeX is installed.';

            case ErrorContext.FileAccessError:
                return `Cannot access file. Please check file permissions.\n\nDetails: ${originalMessage}`;

            case ErrorContext.UserCancelled:
                // Don't show error message for user cancellation
                return '';

            case ErrorContext.InvalidConfiguration:
                return `Invalid configuration. Please check your settings.\n\nDetails: ${originalMessage}`;

            default:
                return `An error occurred: ${originalMessage}`;
        }
    }

    /**
     * Log error to output channel with detailed information
     */
    logError(error: Error, context: ErrorContext, operationContext?: string): void {
        const timestamp = new Date().toISOString();
        const contextStr = operationContext ? ` [${operationContext}]` : '';
        
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(`[${timestamp}] ERROR${contextStr}`);
        this.outputChannel.appendLine(`Error Type: ${context}`);
        this.outputChannel.appendLine(`Message: ${error.message}`);
        
        if (error.stack) {
            this.outputChannel.appendLine(`Stack Trace:\n${error.stack}`);
        }
        
        this.outputChannel.appendLine('');
    }

    /**
     * Handle error by logging and showing user message
     */
    async handleError(error: Error, operationContext?: string): Promise<void> {
        const context = this.classifyError(error);
        
        // Log detailed error information
        this.logError(error, context, operationContext);

        // Show user-friendly message (except for user cancellation)
        if (context !== ErrorContext.UserCancelled) {
            const userMessage = this.getUserMessage(context, error.message);
            if (userMessage) {
                await vscode.window.showErrorMessage(userMessage);
            }
        }
    }

    /**
     * Show error message with optional actions
     */
    async showErrorMessage(message: string, ...actions: string[]): Promise<string | undefined> {
        return await vscode.window.showErrorMessage(message, ...actions);
    }
}
