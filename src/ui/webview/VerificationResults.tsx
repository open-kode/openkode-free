/**
 * VerificationResults.tsx - Issue List Component
 * 
 * React component for displaying verification results in the webview.
 * Shows issue list with severity indicators and fix suggestions.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageType, WebviewMessage } from '../messageHandler';
import { VerificationResult, VerificationIssue, IssueSeverity } from '../../types';

// VSCode API type declaration
declare const acquireVsCodeApi: () => {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
};

// Initialize VSCode API
const vscode = acquireVsCodeApi();

/**
 * Issue severity configuration
 */
const SEVERITY_CONFIG: Record<IssueSeverity, { icon: string; label: string; color: string }> = {
    error: {
        icon: 'codicon-error',
        label: 'Error',
        color: '#f48771'
    },
    warning: {
        icon: 'codicon-warning',
        label: 'Warning',
        color: '#cca700'
    },
    info: {
        icon: 'codicon-info',
        label: 'Info',
        color: '#75beff'
    }
};

/**
 * Issue item component props
 */
interface IssueItemProps {
    issue: VerificationIssue;
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: (issueId: string) => void;
    onExpand: (issueId: string) => void;
    onShowDiff: (issueId: string) => void;
    onApplyFix: (issueId: string, fix: string) => void;
    onIgnore: (issueId: string) => void;
}

/**
 * Individual issue item component
 */
const IssueItem: React.FC<IssueItemProps> = ({
    issue,
    isSelected,
    isExpanded,
    onSelect,
    onExpand,
    onShowDiff,
    onApplyFix,
    onIgnore
}) => {
    const config = SEVERITY_CONFIG[issue.severity];

    const handleClick = useCallback(() => {
        onSelect(issue.id);
    }, [issue.id, onSelect]);

    const handleExpand = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onExpand(issue.id);
    }, [issue.id, onExpand]);

    const handleShowDiff = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onShowDiff(issue.id);
    }, [issue.id, onShowDiff]);

    const handleApplyFix = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (issue.suggestedFix) {
            onApplyFix(issue.id, issue.suggestedFix);
        }
    }, [issue.id, issue.suggestedFix, onApplyFix]);

    const handleIgnore = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onIgnore(issue.id);
    }, [issue.id, onIgnore]);

    return (
        <div 
            className={`issue-item ${isSelected ? 'issue-item--selected' : ''} issue-item--${issue.severity}`}
            onClick={handleClick}
        >
            <div className="issue-item__header">
                {/* Expand button */}
                <button 
                    className={`issue-item__expand-btn ${isExpanded ? 'expanded' : ''}`}
                    onClick={handleExpand}
                >
                    <i className="codicon codicon-chevron-right"></i>
                </button>

                {/* Severity icon */}
                <i 
                    className={`codicon ${config.icon} issue-item__severity`}
                    style={{ color: config.color }}
                    title={config.label}
                ></i>

                {/* Issue content */}
                <div className="issue-item__content">
                    <span className="issue-item__message">{issue.message}</span>
                    <span className="issue-item__location">
                        {issue.filePath && (
                            <>
                                <i className="codicon codicon-file-code"></i>
                                {issue.filePath}
                                {issue.line !== undefined && (
                                    <>:{issue.line}{issue.column !== undefined && `:${issue.column}`}</>
                                )}
                            </>
                        )}
                    </span>
                </div>

                {/* Quick actions */}
                <div className="issue-item__actions">
                    {issue.suggestedFix && (
                        <button
                            className="btn btn--icon"
                            onClick={handleShowDiff}
                            title="Show Diff"
                        >
                            <i className="codicon codicon-diff"></i>
                        </button>
                    )}
                    <button
                        className="btn btn--icon"
                        onClick={handleIgnore}
                        title="Ignore Issue"
                    >
                        <i className="codicon codicon-close"></i>
                    </button>
                </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
                <div className="issue-item__details">
                    {issue.description && (
                        <div className="issue-detail">
                            <h4>Description</h4>
                            <p>{issue.description}</p>
                        </div>
                    )}

                    {issue.codeSnippet && (
                        <div className="issue-detail">
                            <h4>Code</h4>
                            <pre className="code-snippet">
                                <code>{issue.codeSnippet}</code>
                            </pre>
                        </div>
                    )}

                    {issue.suggestedFix && (
                        <div className="issue-detail">
                            <h4>Suggested Fix</h4>
                            <pre className="code-snippet code-snippet--fix">
                                <code>{issue.suggestedFix}</code>
                            </pre>
                            <div className="issue-detail__actions">
                                <button
                                    className="btn btn--primary"
                                    onClick={handleApplyFix}
                                >
                                    <i className="codicon codicon-check"></i>
                                    Apply Fix
                                </button>
                                <button
                                    className="btn btn--secondary"
                                    onClick={handleShowDiff}
                                >
                                    <i className="codicon codicon-diff"></i>
                                    Show Diff
                                </button>
                            </div>
                        </div>
                    )}

                    {issue.ruleId && (
                        <div className="issue-detail">
                            <span className="meta-label">Rule:</span>
                            <span className="meta-value">{issue.ruleId}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Verification results component props
 */
interface VerificationResultsProps {
    initialResults?: VerificationResult;
}

/**
 * Main verification results component
 */
export const VerificationResults: React.FC<VerificationResultsProps> = ({ initialResults }) => {
    const [results, setResults] = useState<VerificationResult | null>(initialResults || null);
    const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
    const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
    const [filterSeverity, setFilterSeverity] = useState<IssueSeverity | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [groupByFile, setGroupByFile] = useState(false);

    // Send ready message to extension
    useEffect(() => {
        vscode.postMessage({ type: MessageType.READY });
    }, []);

    // Listen for messages from extension
    useEffect(() => {
        const handleMessage = (event: MessageEvent<WebviewMessage>) => {
            const message = event.data;
            
            switch (message.type) {
                case MessageType.VERIFICATION_RESULTS:
                    setResults(message.payload as VerificationResult);
                    setExpandedIssues(new Set());
                    break;
                
                case MessageType.ISSUE_ADDED:
                    const newIssue = message.payload as VerificationIssue;
                    setResults(prev => {
                        if (!prev) return { success: true, issues: [newIssue] };
                        return {
                            ...prev,
                            issues: [...prev.issues, newIssue]
                        };
                    });
                    break;
                
                case MessageType.HIGHLIGHT_ISSUE:
                    const { issueId } = message.payload as { issueId: string };
                    setSelectedIssue(issueId);
                    setExpandedIssues(prev => new Set([...prev, issueId]));
                    break;
                
                case MessageType.CLEAR_RESULTS:
                    setResults(null);
                    setSelectedIssue(null);
                    setExpandedIssues(new Set());
                    break;
                
                case MessageType.FILTERED_ISSUES:
                    const { issues } = message.payload as { issues: VerificationIssue[] };
                    if (results) {
                        setResults({ ...results, issues });
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [results]);

    // Persist state
    useEffect(() => {
        vscode.setState({ filterSeverity, searchQuery, groupByFile });
    }, [filterSeverity, searchQuery, groupByFile]);

    // Restore state on mount
    useEffect(() => {
        const savedState = vscode.getState() as { filterSeverity: IssueSeverity | 'all'; searchQuery: string; groupByFile: boolean } | undefined;
        if (savedState) {
            setFilterSeverity(savedState.filterSeverity);
            setSearchQuery(savedState.searchQuery);
            setGroupByFile(savedState.groupByFile);
        }
    }, []);

    // Filter and search issues
    const filteredIssues = useMemo(() => {
        if (!results) return [];
        
        return results.issues.filter(issue => {
            // Filter by severity
            if (filterSeverity !== 'all' && issue.severity !== filterSeverity) {
                return false;
            }
            
            // Search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    issue.message.toLowerCase().includes(query) ||
                    issue.filePath?.toLowerCase().includes(query) ||
                    issue.description?.toLowerCase().includes(query)
                );
            }
            
            return true;
        });
    }, [results, filterSeverity, searchQuery]);

    // Group issues by file
    const groupedIssues = useMemo(() => {
        if (!groupByFile) return null;
        
        const groups: Record<string, VerificationIssue[]> = {};
        filteredIssues.forEach(issue => {
            const file = issue.filePath || 'Unknown';
            if (!groups[file]) groups[file] = [];
            groups[file].push(issue);
        });
        return groups;
    }, [filteredIssues, groupByFile]);

    // Calculate statistics
    const stats = useMemo(() => {
        if (!results) return { total: 0, error: 0, warning: 0, info: 0 };
        
        return {
            total: results.issues.length,
            error: results.issues.filter(i => i.severity === 'error').length,
            warning: results.issues.filter(i => i.severity === 'warning').length,
            info: results.issues.filter(i => i.severity === 'info').length
        };
    }, [results]);

    // Handle issue selection
    const handleSelect = useCallback((issueId: string) => {
        setSelectedIssue(issueId);
        vscode.postMessage({
            type: MessageType.ISSUE_SELECTED,
            payload: { issueId }
        });
    }, []);

    // Handle issue expand
    const handleExpand = useCallback((issueId: string) => {
        setExpandedIssues(prev => {
            const newSet = new Set(prev);
            if (newSet.has(issueId)) {
                newSet.delete(issueId);
            } else {
                newSet.add(issueId);
            }
            return newSet;
        });
    }, []);

    // Handle show diff
    const handleShowDiff = useCallback((issueId: string) => {
        vscode.postMessage({
            type: MessageType.SHOW_DIFF,
            payload: { issueId }
        });
    }, []);

    // Handle apply fix
    const handleApplyFix = useCallback((issueId: string, fix: string) => {
        vscode.postMessage({
            type: MessageType.APPLY_FIX,
            payload: { issueId, fix }
        });
    }, []);

    // Handle ignore issue
    const handleIgnore = useCallback((issueId: string) => {
        vscode.postMessage({
            type: MessageType.IGNORE_ISSUE,
            payload: { issueId }
        });
    }, []);

    // Handle clear all
    const handleClear = useCallback(() => {
        vscode.postMessage({ type: MessageType.CLEAR_RESULTS });
    }, []);

    // Handle filter change
    const handleFilterChange = useCallback((severity: IssueSeverity | 'all') => {
        setFilterSeverity(severity);
        vscode.postMessage({
            type: MessageType.FILTER_ISSUES,
            payload: { severity: severity === 'all' ? undefined : severity }
        });
    }, []);

    if (!results) {
        return (
            <div className="verification-results verification-results--empty">
                <div className="empty-state">
                    <i className="codicon codicon-pass"></i>
                    <h2>No Issues Found</h2>
                    <p>All verification checks passed successfully.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="verification-results">
            {/* Header */}
            <header className="verification-results__header">
                <h1>Verification Results</h1>
                
                {/* Statistics */}
                <div className="stats-bar">
                    <div className={`stat stat--total ${stats.total > 0 ? 'has-issues' : ''}`}>
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total</span>
                    </div>
                    <div className={`stat stat--error ${stats.error > 0 ? 'has-issues' : ''}`}>
                        <span className="stat-value">{stats.error}</span>
                        <span className="stat-label">Errors</span>
                    </div>
                    <div className={`stat stat--warning ${stats.warning > 0 ? 'has-issues' : ''}`}>
                        <span className="stat-value">{stats.warning}</span>
                        <span className="stat-label">Warnings</span>
                    </div>
                    <div className={`stat stat--info ${stats.info > 0 ? 'has-issues' : ''}`}>
                        <span className="stat-value">{stats.info}</span>
                        <span className="stat-label">Info</span>
                    </div>
                </div>
            </header>

            {/* Toolbar */}
            <div className="verification-results__toolbar">
                <div className="toolbar-group">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search issues..."
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    />
                    <select
                        className="filter-select"
                        value={filterSeverity}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange(e.target.value as IssueSeverity | 'all')}
                    >
                        <option value="all">All Severities</option>
                        <option value="error">Errors</option>
                        <option value="warning">Warnings</option>
                        <option value="info">Info</option>
                    </select>
                </div>
                <div className="toolbar-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={groupByFile}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupByFile(e.target.checked)}
                        />
                        Group by File
                    </label>
                    <button className="btn btn--secondary" onClick={handleClear}>
                        <i className="codicon codicon-clear-all"></i>
                        Clear
                    </button>
                </div>
            </div>

            {/* Issue list */}
            <div className="verification-results__list">
                {filteredIssues.length === 0 ? (
                    <div className="empty-state">
                        <i className="codicon codicon-search"></i>
                        <p>No issues match your filters</p>
                    </div>
                ) : groupByFile && groupedIssues ? (
                    // Grouped by file
                    Object.entries(groupedIssues).map(([file, issues]) => (
                        <div key={file} className="issue-group">
                            <h3 className="issue-group__header">
                                <i className="codicon codicon-file-code"></i>
                                {file}
                                <span className="issue-count">({issues.length})</span>
                            </h3>
                            <div className="issue-group__list">
                                {issues.map(issue => (
                                    <IssueItem
                                        key={issue.id}
                                        issue={issue}
                                        isSelected={selectedIssue === issue.id}
                                        isExpanded={expandedIssues.has(issue.id)}
                                        onSelect={handleSelect}
                                        onExpand={handleExpand}
                                        onShowDiff={handleShowDiff}
                                        onApplyFix={handleApplyFix}
                                        onIgnore={handleIgnore}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    // Flat list
                    filteredIssues.map(issue => (
                        <IssueItem
                            key={issue.id}
                            issue={issue}
                            isSelected={selectedIssue === issue.id}
                            isExpanded={expandedIssues.has(issue.id)}
                            onSelect={handleSelect}
                            onExpand={handleExpand}
                            onShowDiff={handleShowDiff}
                            onApplyFix={handleApplyFix}
                            onIgnore={handleIgnore}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// Render the app
const root = document.getElementById('root');
if (root) {
    const ReactDOM = require('react-dom/client');
    const container = ReactDOM.createRoot(root);
    container.render(<VerificationResults />);
}

export default VerificationResults;
