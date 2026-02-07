/**
 * Type definitions for the Zotero Citation extension
 */

import * as vscode from 'vscode';

/**
 * JSON-RPC request structure for Better BibTeX API
 */
export interface JSONRPCRequest {
    jsonrpc: '2.0';
    method: string;
    params?: any[];
    id: number;
}

/**
 * JSON-RPC response structure from Better BibTeX API
 */
export interface JSONRPCResponse<T = any> {
    jsonrpc: '2.0';
    result?: T;
    error?: JSONRPCError;
    id: number;
}

/**
 * JSON-RPC error structure
 */
export interface JSONRPCError {
    code: number;
    message: string;
}

/**
 * Trigger match information when \zoteroCite is detected
 */
export interface TriggerMatch {
    range: vscode.Range;
    position: vscode.Position;
}

/**
 * Citation data returned from Zotero
 */
export interface CitationData {
    keys: string[];
    bibTeX: string;
}

/**
 * Parsed BibTeX entry
 */
export interface ParsedBibEntry {
    key: string;
    type: string;
    rawContent: string;
}

/**
 * Error context for error handling
 */
export enum ErrorContext {
    ZoteroNotRunning = 'ZoteroNotRunning',
    BetterBibTeXNotInstalled = 'BetterBibTeXNotInstalled',
    NetworkError = 'NetworkError',
    FileAccessError = 'FileAccessError',
    UserCancelled = 'UserCancelled',
    InvalidConfiguration = 'InvalidConfiguration'
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
