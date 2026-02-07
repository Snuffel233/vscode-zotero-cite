/**
 * Zotero API Client for Better BibTeX JSON-RPC communication
 */

import * as http from 'http';
import { JSONRPCRequest, JSONRPCResponse } from './types';

const ZOTERO_API_BASE = 'localhost';
const ZOTERO_API_PORT = 23119;
const ZOTERO_API_PATH = '/better-bibtex/json-rpc';
const REQUEST_TIMEOUT = 30000; // 30 seconds

export class ZoteroAPIClient {
    private requestIdCounter = 0;

    /**
     * Generate a unique request ID for JSON-RPC
     */
    private generateRequestId(): number {
        return ++this.requestIdCounter;
    }

    /**
     * Make a JSON-RPC request to Better BibTeX API
     */
    private async makeRequest<T>(method: string, params?: any[]): Promise<T> {
        const requestId = this.generateRequestId();
        
        const requestBody: JSONRPCRequest = {
            jsonrpc: '2.0',
            method,
            params: params || [],
            id: requestId
        };

        const postData = JSON.stringify(requestBody);

        return new Promise((resolve, reject) => {
            const options: http.RequestOptions = {
                hostname: ZOTERO_API_BASE,
                port: ZOTERO_API_PORT,
                path: ZOTERO_API_PATH,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: REQUEST_TIMEOUT
            };

            const req = http.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response: JSONRPCResponse<T> = JSON.parse(data);

                        if (response.error) {
                            reject(new Error(`Zotero API error: ${response.error.message}`));
                        } else if (response.result !== undefined) {
                            resolve(response.result);
                        } else {
                            reject(new Error('Invalid JSON-RPC response: no result or error'));
                        }
                    } catch (err) {
                        reject(new Error(`Failed to parse JSON-RPC response: ${err}`));
                    }
                });
            });

            req.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'ECONNREFUSED') {
                    reject(new Error('Zotero is not running. Please start Zotero and try again.'));
                } else if (err.code === 'ETIMEDOUT') {
                    reject(new Error('Request timed out. Please ensure Zotero is running.'));
                } else {
                    reject(new Error(`Network error: ${err.message}`));
                }
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out. Please ensure Zotero is running.'));
            });

            req.write(postData);
            req.end();
        });
    }

    /**
     * Check if Zotero and Better BibTeX are available
     */
    async checkAvailability(): Promise<boolean> {
        try {
            // Call user.groups to verify Better BibTeX is accessible
            await this.makeRequest('user.groups');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Convert item keys to citation keys
     * @param itemKeys Array of item keys in format [libraryID]:[itemKey] or just [itemKey]
     * @returns Object mapping item keys to citation keys
     */
    async getCitationKeys(itemKeys: string[]): Promise<{ [key: string]: string }> {
        if (itemKeys.length === 0) {
            return {};
        }

        try {
            const result = await this.makeRequest<{ [key: string]: string }>('item.citationkey', [itemKeys]);
            return result;
        } catch (error) {
            throw new Error(`Failed to get citation keys: ${error instanceof Error ? error.message : error}`);
        }
    }

    /**
     * Invoke Zotero's CAYW (Cite As You Write) picker
     * Returns array of selected citation keys
     */
    async invokePicker(): Promise<string[]> {
        // Use HTTP GET for CAYW endpoint with pandoc format
        // This returns citation keys directly in format: [@key1; @key2]
        return new Promise((resolve, reject) => {
            const options: http.RequestOptions = {
                hostname: ZOTERO_API_BASE,
                port: ZOTERO_API_PORT,
                path: '/better-bibtex/cayw?format=pandoc',
                method: 'GET',
                timeout: REQUEST_TIMEOUT
            };

            const req = http.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        // Check for specific error messages
                        if (data.includes('already in progress') || data.includes('已在运行')) {
                            reject(new Error('Zotero picker is already open in another application. Please close it and try again.'));
                        } else {
                            reject(new Error(`Zotero API returned error ${res.statusCode}. Make sure Better BibTeX is installed and Zotero is running.`));
                        }
                        return;
                    }

                    // If user cancelled, data will be empty
                    if (data.trim() === '') {
                        resolve([]);
                        return;
                    }

                    // Parse pandoc format: [@key1; @key2] or @key1
                    // Extract citation keys by finding all @word patterns
                    const citationKeys: string[] = data
                        .split(/[^a-zA-Z0-9@_-]+/)
                        .filter(s => s.startsWith('@') && s.length > 1)
                        .map(s => s.substring(1));

                    if (citationKeys.length === 0) {
                        reject(new Error(`Failed to parse citation keys from response: ${data}`));
                        return;
                    }

                    resolve(citationKeys);
                });
            });

            req.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'ECONNREFUSED') {
                    reject(new Error('Cannot connect to Zotero. Please ensure Zotero is running and Better BibTeX plugin is installed.'));
                } else if (err.code === 'ETIMEDOUT') {
                    reject(new Error('Request timed out. Please ensure Zotero is running.'));
                } else {
                    reject(new Error(`Failed to open Zotero picker: ${err.message}`));
                }
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out. Please ensure Zotero is running.'));
            });

            req.end();
        });
    }

    /**
     * Export BibTeX entries for given citation keys
     * @param citationKeys Array of citation keys (not item keys)
     * @returns BibTeX string
     */
    async exportBibTeX(citationKeys: string[]): Promise<string> {
        if (citationKeys.length === 0) {
            return '';
        }

        try {
            const bibtex = await this.makeRequest<string>('item.export', [citationKeys, 'Better BibTeX']);
            return bibtex;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            
            // If error mentions "not found", try to identify which keys are invalid
            if (errorMsg.includes('not found')) {
                // Try exporting keys one by one to identify valid ones
                const validEntries: string[] = [];
                const invalidKeys: string[] = [];
                
                for (const key of citationKeys) {
                    try {
                        const entry = await this.makeRequest<string>('item.export', [[key], 'Better BibTeX']);
                        if (entry && entry.trim()) {
                            validEntries.push(entry);
                        }
                    } catch (keyError) {
                        invalidKeys.push(key);
                    }
                }
                
                if (validEntries.length > 0) {
                    // Return valid entries and log invalid keys
                    if (invalidKeys.length > 0) {
                        console.warn(`Skipped invalid citation keys: ${invalidKeys.join(', ')}`);
                    }
                    return validEntries.join('\n\n');
                }
            }
            
            throw new Error(`Failed to export BibTeX: ${errorMsg}`);
        }
    }
}
