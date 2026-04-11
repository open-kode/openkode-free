/**
 * Message Handler - Message Passing Between Extension and Webviews
 * 
 * Provides bidirectional communication between the extension host
 * and webview panels with type-safe message handling.
 */

import * as vscode from 'vscode';
import { SpecPlan, Phase, Ticket, VerificationResult, VerificationIssue } from '../types';

/**
 * Message types for communication
 */
export enum MessageType {
    // From Extension to Webview
    PLAN_UPDATED = 'planUpdated',
    PHASE_UPDATED = 'phaseUpdated',
    TICKET_UPDATED = 'ticketUpdated',
    VERIFICATION_RESULTS = 'verificationResults',
    ISSUE_ADDED = 'issueAdded',
    HIGHLIGHT_ISSUE = 'highlightIssue',
    CLEAR_RESULTS = 'clearResults',
    FILTERED_ISSUES = 'filteredIssues',
    PROGRESS_UPDATE = 'progressUpdate',
    ERROR = 'error',
    
    // From Webview to Extension
    READY = 'ready',
    PHASE_SELECTED = 'phaseSelected',
    TICKET_SELECTED = 'ticketSelected',
    FILE_PREVIEW_REQUEST = 'filePreviewRequest',
    EXECUTE_PHASE = 'executePhase',
    EXECUTE_TICKET = 'executeTicket',
    EXPAND_ALL = 'expandAll',
    COLLAPSE_ALL = 'collapseAll',
    ISSUE_SELECTED = 'issueSelected',
    SHOW_DIFF = 'showDiff',
    APPLY_FIX = 'applyFix',
    IGNORE_ISSUE = 'ignoreIssue',
    FILTER_ISSUES = 'filterIssues',
    SEARCH = 'search',
    
    // Bidirectional
    PING = 'ping',
    PONG = 'pong'
}

/**
 * Base message interface
 */
export interface BaseMessage {
    type: MessageType;
    payload?: unknown;
}

/**
 * Plan updated message
 */
export interface PlanUpdatedMessage extends BaseMessage {
    type: MessageType.PLAN_UPDATED;
    payload: SpecPlan;
}

/**
 * Phase updated message
 */
export interface PhaseUpdatedMessage extends BaseMessage {
    type: MessageType.PHASE_UPDATED;
    payload: Phase;
}

/**
 * Ticket updated message
 */
export interface TicketUpdatedMessage extends BaseMessage {
    type: MessageType.TICKET_UPDATED;
    payload: Ticket;
}

/**
 * Verification results message
 */
export interface VerificationResultsMessage extends BaseMessage {
    type: MessageType.VERIFICATION_RESULTS;
    payload: VerificationResult;
}

/**
 * Issue added message
 */
export interface IssueAddedMessage extends BaseMessage {
    type: MessageType.ISSUE_ADDED;
    payload: VerificationIssue;
}

/**
 * Highlight issue message
 */
export interface HighlightIssueMessage extends BaseMessage {
    type: MessageType.HIGHLIGHT_ISSUE;
    payload: { issueId: string };
}

/**
 * Clear results message
 */
export interface ClearResultsMessage extends BaseMessage {
    type: MessageType.CLEAR_RESULTS;
}

/**
 * Filtered issues message
 */
export interface FilteredIssuesMessage extends BaseMessage {
    type: MessageType.FILTERED_ISSUES;
    payload: { issues: VerificationIssue[] };
}

/**
 * Progress update message
 */
export interface ProgressUpdateMessage extends BaseMessage {
    type: MessageType.PROGRESS_UPDATE;
    payload: { message: string; percent: number };
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
    type: MessageType.ERROR;
    payload: { message: string; details?: string };
}

/**
 * Ready message
 */
export interface ReadyMessage extends BaseMessage {
    type: MessageType.READY;
}

/**
 * Phase selected message
 */
export interface PhaseSelectedMessage extends BaseMessage {
    type: MessageType.PHASE_SELECTED;
    payload: { phaseId: string };
}

/**
 * Ticket selected message
 */
export interface TicketSelectedMessage extends BaseMessage {
    type: MessageType.TICKET_SELECTED;
    payload: { ticketId: string };
}

/**
 * File preview request message
 */
export interface FilePreviewRequestMessage extends BaseMessage {
    type: MessageType.FILE_PREVIEW_REQUEST;
    payload: { filePath: string; line?: number; column?: number };
}

/**
 * Execute phase message
 */
export interface ExecutePhaseMessage extends BaseMessage {
    type: MessageType.EXECUTE_PHASE;
    payload: { phaseId: string };
}

/**
 * Execute ticket message
 */
export interface ExecuteTicketMessage extends BaseMessage {
    type: MessageType.EXECUTE_TICKET;
    payload: { ticketId: string };
}

/**
 * Expand all message
 */
export interface ExpandAllMessage extends BaseMessage {
    type: MessageType.EXPAND_ALL;
}

/**
 * Collapse all message
 */
export interface CollapseAllMessage extends BaseMessage {
    type: MessageType.COLLAPSE_ALL;
}

/**
 * Issue selected message
 */
export interface IssueSelectedMessage extends BaseMessage {
    type: MessageType.ISSUE_SELECTED;
    payload: { issueId: string };
}

/**
 * Show diff message
 */
export interface ShowDiffMessage extends BaseMessage {
    type: MessageType.SHOW_DIFF;
    payload: { issueId: string };
}

/**
 * Apply fix message
 */
export interface ApplyFixMessage extends BaseMessage {
    type: MessageType.APPLY_FIX;
    payload: { issueId: string; fix: string };
}

/**
 * Ignore issue message
 */
export interface IgnoreIssueMessage extends BaseMessage {
    type: MessageType.IGNORE_ISSUE;
    payload: { issueId: string };
}

/**
 * Filter issues message
 */
export interface FilterIssuesMessage extends BaseMessage {
    type: MessageType.FILTER_ISSUES;
    payload: { severity?: string; status?: string; searchQuery?: string };
}

/**
 * Search message
 */
export interface SearchMessage extends BaseMessage {
    type: MessageType.SEARCH;
    payload: { query: string };
}

/**
 * Ping message
 */
export interface PingMessage extends BaseMessage {
    type: MessageType.PING;
}

/**
 * Pong message
 */
export interface PongMessage extends BaseMessage {
    type: MessageType.PONG;
}

/**
 * Union type of all messages
 */
export type WebviewMessage =
    | PlanUpdatedMessage
    | PhaseUpdatedMessage
    | TicketUpdatedMessage
    | VerificationResultsMessage
    | IssueAddedMessage
    | HighlightIssueMessage
    | ClearResultsMessage
    | FilteredIssuesMessage
    | ProgressUpdateMessage
    | ErrorMessage
    | ReadyMessage
    | PhaseSelectedMessage
    | TicketSelectedMessage
    | FilePreviewRequestMessage
    | ExecutePhaseMessage
    | ExecuteTicketMessage
    | ExpandAllMessage
    | CollapseAllMessage
    | IssueSelectedMessage
    | ShowDiffMessage
    | ApplyFixMessage
    | IgnoreIssueMessage
    | FilterIssuesMessage
    | SearchMessage
    | PingMessage
    | PongMessage;

/**
 * Type guard functions
 */
export const isPlanUpdatedMessage = (msg: WebviewMessage): msg is PlanUpdatedMessage =>
    msg.type === MessageType.PLAN_UPDATED;

export const isPhaseUpdatedMessage = (msg: WebviewMessage): msg is PhaseUpdatedMessage =>
    msg.type === MessageType.PHASE_UPDATED;

export const isTicketUpdatedMessage = (msg: WebviewMessage): msg is TicketUpdatedMessage =>
    msg.type === MessageType.TICKET_UPDATED;

export const isVerificationResultsMessage = (msg: WebviewMessage): msg is VerificationResultsMessage =>
    msg.type === MessageType.VERIFICATION_RESULTS;

export const isIssueAddedMessage = (msg: WebviewMessage): msg is IssueAddedMessage =>
    msg.type === MessageType.ISSUE_ADDED;

export const isHighlightIssueMessage = (msg: WebviewMessage): msg is HighlightIssueMessage =>
    msg.type === MessageType.HIGHLIGHT_ISSUE;

export const isClearResultsMessage = (msg: WebviewMessage): msg is ClearResultsMessage =>
    msg.type === MessageType.CLEAR_RESULTS;

export const isFilteredIssuesMessage = (msg: WebviewMessage): msg is FilteredIssuesMessage =>
    msg.type === MessageType.FILTERED_ISSUES;

export const isProgressUpdateMessage = (msg: WebviewMessage): msg is ProgressUpdateMessage =>
    msg.type === MessageType.PROGRESS_UPDATE;

export const isErrorMessage = (msg: WebviewMessage): msg is ErrorMessage =>
    msg.type === MessageType.ERROR;

export const isReadyMessage = (msg: WebviewMessage): msg is ReadyMessage =>
    msg.type === MessageType.READY;

export const isPhaseSelectedMessage = (msg: WebviewMessage): msg is PhaseSelectedMessage =>
    msg.type === MessageType.PHASE_SELECTED;

export const isTicketSelectedMessage = (msg: WebviewMessage): msg is TicketSelectedMessage =>
    msg.type === MessageType.TICKET_SELECTED;

export const isFilePreviewRequestMessage = (msg: WebviewMessage): msg is FilePreviewRequestMessage =>
    msg.type === MessageType.FILE_PREVIEW_REQUEST;

export const isExecutePhaseMessage = (msg: WebviewMessage): msg is ExecutePhaseMessage =>
    msg.type === MessageType.EXECUTE_PHASE;

export const isExecuteTicketMessage = (msg: WebviewMessage): msg is ExecuteTicketMessage =>
    msg.type === MessageType.EXECUTE_TICKET;

export const isExpandAllMessage = (msg: WebviewMessage): msg is ExpandAllMessage =>
    msg.type === MessageType.EXPAND_ALL;

export const isCollapseAllMessage = (msg: WebviewMessage): msg is CollapseAllMessage =>
    msg.type === MessageType.COLLAPSE_ALL;

export const isIssueSelectedMessage = (msg: WebviewMessage): msg is IssueSelectedMessage =>
    msg.type === MessageType.ISSUE_SELECTED;

export const isShowDiffMessage = (msg: WebviewMessage): msg is ShowDiffMessage =>
    msg.type === MessageType.SHOW_DIFF;

export const isApplyFixMessage = (msg: WebviewMessage): msg is ApplyFixMessage =>
    msg.type === MessageType.APPLY_FIX;

export const isIgnoreIssueMessage = (msg: WebviewMessage): msg is IgnoreIssueMessage =>
    msg.type === MessageType.IGNORE_ISSUE;

export const isFilterIssuesMessage = (msg: WebviewMessage): msg is FilterIssuesMessage =>
    msg.type === MessageType.FILTER_ISSUES;

export const isSearchMessage = (msg: WebviewMessage): msg is SearchMessage =>
    msg.type === MessageType.SEARCH;

export const isPingMessage = (msg: WebviewMessage): msg is PingMessage =>
    msg.type === MessageType.PING;

export const isPongMessage = (msg: WebviewMessage): msg is PongMessage =>
    msg.type === MessageType.PONG;

/**
 * Message handler class for webview communication
 */
export class MessageHandler {
    private messageListeners: ((message: WebviewMessage) => void)[] = [];
    private disposables: vscode.Disposable[] = [];

    constructor(private webview: vscode.Webview) {
        // Set up message listener
        this.disposables.push(
            this.webview.onDidReceiveMessage((message: WebviewMessage) => {
                this.handleMessage(message);
            })
        );
    }

    /**
     * Post a message to the webview
     */
    public postMessage(message: WebviewMessage): Thenable<boolean> {
        return this.webview.postMessage(message);
    }

    /**
     * Register a message listener
     */
    public onMessage(listener: (message: WebviewMessage) => void): void {
        this.messageListeners.push(listener);
    }

    /**
     * Remove a message listener
     */
    public offMessage(listener: (message: WebviewMessage) => void): void {
        const index = this.messageListeners.indexOf(listener);
        if (index >= 0) {
            this.messageListeners.splice(index, 1);
        }
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(message: WebviewMessage): void {
        // Notify all listeners
        this.messageListeners.forEach(listener => {
            try {
                listener(message);
            } catch (error) {
                console.error('Error in message listener:', error);
            }
        });
    }

    /**
     * Send ping to check if webview is alive
     */
    public ping(): Promise<boolean> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 5000);
            
            const pongListener = (message: WebviewMessage) => {
                if (isPongMessage(message)) {
                    clearTimeout(timeout);
                    this.offMessage(pongListener);
                    resolve(true);
                }
            };
            
            this.onMessage(pongListener);
            this.postMessage({ type: MessageType.PING });
        });
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.messageListeners = [];
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

/**
 * Create a message factory for common messages
 */
export const MessageFactory = {
    planUpdated: (plan: SpecPlan): PlanUpdatedMessage => ({
        type: MessageType.PLAN_UPDATED,
        payload: plan
    }),

    phaseUpdated: (phase: Phase): PhaseUpdatedMessage => ({
        type: MessageType.PHASE_UPDATED,
        payload: phase
    }),

    ticketUpdated: (ticket: Ticket): TicketUpdatedMessage => ({
        type: MessageType.TICKET_UPDATED,
        payload: ticket
    }),

    verificationResults: (results: VerificationResult): VerificationResultsMessage => ({
        type: MessageType.VERIFICATION_RESULTS,
        payload: results
    }),

    issueAdded: (issue: VerificationIssue): IssueAddedMessage => ({
        type: MessageType.ISSUE_ADDED,
        payload: issue
    }),

    highlightIssue: (issueId: string): HighlightIssueMessage => ({
        type: MessageType.HIGHLIGHT_ISSUE,
        payload: { issueId }
    }),

    clearResults: (): ClearResultsMessage => ({
        type: MessageType.CLEAR_RESULTS
    }),

    progressUpdate: (message: string, percent: number): ProgressUpdateMessage => ({
        type: MessageType.PROGRESS_UPDATE,
        payload: { message, percent }
    }),

    error: (message: string, details?: string): ErrorMessage => ({
        type: MessageType.ERROR,
        payload: { message, details }
    }),

    ready: (): ReadyMessage => ({
        type: MessageType.READY
    }),

    phaseSelected: (phaseId: string): PhaseSelectedMessage => ({
        type: MessageType.PHASE_SELECTED,
        payload: { phaseId }
    }),

    ticketSelected: (ticketId: string): TicketSelectedMessage => ({
        type: MessageType.TICKET_SELECTED,
        payload: { ticketId }
    }),

    filePreviewRequest: (filePath: string, line?: number, column?: number): FilePreviewRequestMessage => ({
        type: MessageType.FILE_PREVIEW_REQUEST,
        payload: { filePath, line, column }
    }),

    executePhase: (phaseId: string): ExecutePhaseMessage => ({
        type: MessageType.EXECUTE_PHASE,
        payload: { phaseId }
    }),

    executeTicket: (ticketId: string): ExecuteTicketMessage => ({
        type: MessageType.EXECUTE_TICKET,
        payload: { ticketId }
    }),

    expandAll: (): ExpandAllMessage => ({
        type: MessageType.EXPAND_ALL
    }),

    collapseAll: (): CollapseAllMessage => ({
        type: MessageType.COLLAPSE_ALL
    }),

    issueSelected: (issueId: string): IssueSelectedMessage => ({
        type: MessageType.ISSUE_SELECTED,
        payload: { issueId }
    }),

    showDiff: (issueId: string): ShowDiffMessage => ({
        type: MessageType.SHOW_DIFF,
        payload: { issueId }
    }),

    applyFix: (issueId: string, fix: string): ApplyFixMessage => ({
        type: MessageType.APPLY_FIX,
        payload: { issueId, fix }
    }),

    ignoreIssue: (issueId: string): IgnoreIssueMessage => ({
        type: MessageType.IGNORE_ISSUE,
        payload: { issueId }
    }),

    filterIssues: (severity?: string, status?: string, searchQuery?: string): FilterIssuesMessage => ({
        type: MessageType.FILTER_ISSUES,
        payload: { severity, status, searchQuery }
    }),

    search: (query: string): SearchMessage => ({
        type: MessageType.SEARCH,
        payload: { query }
    }),

    ping: (): PingMessage => ({
        type: MessageType.PING
    }),

    pong: (): PongMessage => ({
        type: MessageType.PONG
    })
};
