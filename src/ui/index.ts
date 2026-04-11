/**
 * OpenKode UI Module - Index
 * 
 * Exports all UI components for the OpenKode extension.
 */

// Main UI Components
export { SidebarPanelProvider } from './sidebarPanel';
export { PlanViewer, PlanViewerOptions, PlanViewerState } from './planViewer';
export { 
    EpicTreeProvider, 
    EpicTreeItem, 
    EpicItem, 
    PhaseItem, 
    TicketItem 
} from './epicTreeProvider';
export { 
    VerificationPanel, 
    VerificationPanelOptions, 
    VerificationPanelState 
} from './verificationPanel';
export { 
    StatusBarManager, 
    StatusBarProgressReporter 
} from './statusBar';

// Message Handler
export {
    MessageHandler,
    MessageType,
    MessageFactory,
    // Message type guards
    isPlanUpdatedMessage,
    isPhaseUpdatedMessage,
    isTicketUpdatedMessage,
    isVerificationResultsMessage,
    isIssueAddedMessage,
    isHighlightIssueMessage,
    isClearResultsMessage,
    isFilteredIssuesMessage,
    isProgressUpdateMessage,
    isErrorMessage,
    isReadyMessage,
    isPhaseSelectedMessage,
    isTicketSelectedMessage,
    isFilePreviewRequestMessage,
    isExecutePhaseMessage,
    isExecuteTicketMessage,
    isExpandAllMessage,
    isCollapseAllMessage,
    isIssueSelectedMessage,
    isShowDiffMessage,
    isApplyFixMessage,
    isIgnoreIssueMessage,
    isFilterIssuesMessage,
    isSearchMessage,
    isPingMessage,
    isPongMessage,
    // Types
    WebviewMessage,
    BaseMessage,
    PlanUpdatedMessage,
    PhaseUpdatedMessage,
    TicketUpdatedMessage,
    VerificationResultsMessage,
    IssueAddedMessage,
    HighlightIssueMessage,
    ClearResultsMessage,
    FilteredIssuesMessage,
    ProgressUpdateMessage,
    ErrorMessage,
    ReadyMessage,
    PhaseSelectedMessage,
    TicketSelectedMessage,
    FilePreviewRequestMessage,
    ExecutePhaseMessage,
    ExecuteTicketMessage,
    ExpandAllMessage,
    CollapseAllMessage,
    IssueSelectedMessage,
    ShowDiffMessage,
    ApplyFixMessage,
    IgnoreIssueMessage,
    FilterIssuesMessage,
    SearchMessage,
    PingMessage,
    PongMessage
} from './messageHandler';
