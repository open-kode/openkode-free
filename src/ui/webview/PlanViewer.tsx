/**
 * PlanViewer.tsx - Main Plan Display Component
 * 
 * React component for displaying OpenKode plans in the webview.
 * Shows phase tree, file changes, and plan details.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PhaseList } from './PhaseList';
import { MessageType, WebviewMessage } from '../messageHandler';
import { SpecPlan, Phase, PlanPhase } from '../../types';

// VSCode API type declaration
declare const acquireVsCodeApi: () => {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
};

// Initialize VSCode API
const vscode = acquireVsCodeApi();

/**
 * Plan viewer component props
 */
interface PlanViewerProps {
    initialPlan?: SpecPlan;
}

/**
 * Plan viewer state
 */
interface PlanViewerState {
    plan: SpecPlan | null;
    selectedPhase: string | null;
    expandedPhases: Set<string>;
    searchQuery: string;
    filterStatus: 'all' | 'pending' | 'in-progress' | 'completed' | 'failed';
}

/**
 * Main Plan Viewer Component
 */
export const PlanViewer: React.FC<PlanViewerProps> = ({ initialPlan }) => {
    const [state, setState] = useState<PlanViewerState>({
        plan: initialPlan || null,
        selectedPhase: null,
        expandedPhases: new Set(),
        searchQuery: '',
        filterStatus: 'all'
    });

    const [isLoading, setIsLoading] = useState(false);

    // Send ready message to extension
    useEffect(() => {
        vscode.postMessage({ type: MessageType.READY });
    }, []);

    // Listen for messages from extension
    useEffect(() => {
        const handleMessage = (event: MessageEvent<WebviewMessage>) => {
            const message = event.data;
            
            switch (message.type) {
                case MessageType.PLAN_UPDATED:
                    setState(prev => ({
                        ...prev,
                        plan: message.payload as SpecPlan
                    }));
                    setIsLoading(false);
                    break;
                
                case MessageType.PHASE_UPDATED:
                    const updatedPhase = message.payload as Phase;
                    setState(prev => {
                        if (!prev.plan) return prev;
                        
                        const updatedPhases = prev.plan.phases.map(p =>
                            p.id === updatedPhase.id ? updatedPhase : p
                        );
                        
                        return {
                            ...prev,
                            plan: {
                                ...prev.plan,
                                phases: updatedPhases
                            }
                        };
                    });
                    break;
                
                case MessageType.PROGRESS_UPDATE:
                    setIsLoading(true);
                    break;
                
                case MessageType.ERROR:
                    setIsLoading(false);
                    console.error('Error from extension:', message.payload);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Persist state
    useEffect(() => {
        vscode.setState(state);
    }, [state]);

    // Restore state on mount
    useEffect(() => {
        const savedState = vscode.getState() as PlanViewerState | undefined;
        if (savedState) {
            setState(prev => ({
                ...prev,
                expandedPhases: new Set(savedState.expandedPhases),
                searchQuery: savedState.searchQuery,
                filterStatus: savedState.filterStatus
            }));
        }
    }, []);

    // Handle phase selection
    const handlePhaseSelect = useCallback((phaseId: string) => {
        setState(prev => ({ ...prev, selectedPhase: phaseId }));
        vscode.postMessage({
            type: MessageType.PHASE_SELECTED,
            payload: { phaseId }
        });
    }, []);

    // Handle phase expand/collapse
    const handlePhaseExpand = useCallback((phaseId: string, expanded: boolean) => {
        setState(prev => {
            const newExpanded = new Set(prev.expandedPhases);
            if (expanded) {
                newExpanded.add(phaseId);
            } else {
                newExpanded.delete(phaseId);
            }
            return { ...prev, expandedPhases: newExpanded };
        });
    }, []);

    // Handle execute phase
    const handleExecutePhase = useCallback((phaseId: string) => {
        vscode.postMessage({
            type: MessageType.EXECUTE_PHASE,
            payload: { phaseId }
        });
    }, []);

    // Handle expand all
    const handleExpandAll = useCallback(() => {
        if (state.plan) {
            const allPhaseIds = new Set(state.plan.phases.map(p => p.id));
            setState(prev => ({ ...prev, expandedPhases: allPhaseIds }));
        }
        vscode.postMessage({ type: MessageType.EXPAND_ALL });
    }, [state.plan]);

    // Handle collapse all
    const handleCollapseAll = useCallback(() => {
        setState(prev => ({ ...prev, expandedPhases: new Set() }));
        vscode.postMessage({ type: MessageType.COLLAPSE_ALL });
    }, []);

    // Handle search
    const handleSearch = useCallback((query: string) => {
        setState(prev => ({ ...prev, searchQuery: query }));
    }, []);

    // Handle filter change
    const handleFilterChange = useCallback((status: PlanViewerState['filterStatus']) => {
        setState(prev => ({ ...prev, filterStatus: status }));
    }, []);

    // Filter phases based on search and status
    const filteredPhases = React.useMemo(() => {
        if (!state.plan) return [];
        
        return state.plan.phases.filter(phase => {
            // Filter by status
            if (state.filterStatus !== 'all' && phase.status !== state.filterStatus) {
                return false;
            }
            
            // Filter by search query
            if (state.searchQuery) {
                const query = state.searchQuery.toLowerCase();
                const matchesName = phase.name.toLowerCase().includes(query);
                const matchesDescription = phase.description?.toLowerCase().includes(query);
                const matchesFiles = phase.files?.some(f => 
                    f.toLowerCase().includes(query)
                );
                return matchesName || matchesDescription || matchesFiles;
            }
            
            return true;
        });
    }, [state.plan, state.searchQuery, state.filterStatus]);

    // Get selected phase details
    const selectedPhaseDetails = React.useMemo(() => {
        if (!state.plan || !state.selectedPhase) return null;
        return state.plan.phases.find(p => p.id === state.selectedPhase);
    }, [state.plan, state.selectedPhase]);

    // Calculate progress
    const progress = React.useMemo(() => {
        if (!state.plan || state.plan.phases.length === 0) {
            return { completed: 0, total: 0, percentage: 0 };
        }
        
        const completed = state.plan.phases.filter(p => p.status === 'completed').length;
        return {
            completed,
            total: state.plan.phases.length,
            percentage: Math.round((completed / state.plan.phases.length) * 100)
        };
    }, [state.plan]);

    if (!state.plan) {
        return (
            <div className="plan-viewer plan-viewer--empty">
                <div className="empty-state">
                    <i className="codicon codicon-notebook-empty"></i>
                    <h2>No Plan Loaded</h2>
                    <p>Generate or load a plan to see it here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="plan-viewer">
            {/* Header */}
            <header className="plan-viewer__header">
                <div className="plan-viewer__title">
                    <h1>{state.plan.name}</h1>
                    <span className="plan-viewer__version">v{state.plan.version}</span>
                </div>
                <p className="plan-viewer__description">{state.plan.description}</p>
                
                {/* Progress bar */}
                <div className="plan-viewer__progress">
                    <div className="progress-bar">
                        <div 
                            className="progress-bar__fill"
                            style={{ width: `${progress.percentage}%` }}
                        ></div>
                    </div>
                    <span className="progress-text">
                        {progress.completed} / {progress.total} phases ({progress.percentage}%)
                    </span>
                </div>
            </header>

            {/* Toolbar */}
            <div className="plan-viewer__toolbar">
                <div className="toolbar-group">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search phases..."
                        value={state.searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                    <select
                        className="filter-select"
                        value={state.filterStatus}
                        onChange={(e) => handleFilterChange(e.target.value as PlanViewerState['filterStatus'])}
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
                <div className="toolbar-group">
                    <button 
                        className="btn btn--secondary"
                        onClick={handleExpandAll}
                        title="Expand All"
                    >
                        <i className="codicon codicon-expand-all"></i>
                    </button>
                    <button 
                        className="btn btn--secondary"
                        onClick={handleCollapseAll}
                        title="Collapse All"
                    >
                        <i className="codicon codicon-collapse-all"></i>
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="plan-viewer__content">
                {/* Phase list */}
                <div className="plan-viewer__phases">
                    {isLoading && (
                        <div className="loading-overlay">
                            <i className="codicon codicon-sync codicon--spin"></i>
                            <span>Loading...</span>
                        </div>
                    )}
                    <PhaseList
                        phases={filteredPhases}
                        selectedPhase={state.selectedPhase}
                        expandedPhases={state.expandedPhases}
                        onSelect={handlePhaseSelect}
                        onExpand={handlePhaseExpand}
                        onExecute={handleExecutePhase}
                    />
                </div>

                {/* Phase details panel */}
                {selectedPhaseDetails && (
                    <div className="plan-viewer__details">
                        <div className="phase-details">
                            <h3>{selectedPhaseDetails.name}</h3>
                            <p className="phase-details__description">
                                {selectedPhaseDetails.description}
                            </p>
                            
                            <div className="phase-details__meta">
                                <div className="meta-item">
                                    <span className="meta-label">Status:</span>
                                    <span className={`meta-value status--${selectedPhaseDetails.status}`}>
                                        {selectedPhaseDetails.status}
                                    </span>
                                </div>
                                {selectedPhaseDetails.estimatedTime && (
                                    <div className="meta-item">
                                        <span className="meta-label">Estimated:</span>
                                        <span className="meta-value">
                                            {selectedPhaseDetails.estimatedTime}ms
                                        </span>
                                    </div>
                                )}
                            </div>

                            {selectedPhaseDetails.files && selectedPhaseDetails.files.length > 0 && (
                                <div className="phase-details__files">
                                    <h4>Files</h4>
                                    <ul>
                                        {selectedPhaseDetails.files.map((file, index) => (
                                            <li key={index} className="file-item">
                                                <i className="codicon codicon-file-code"></i>
                                                <span>{file}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {selectedPhaseDetails.dependencies && selectedPhaseDetails.dependencies.length > 0 && (
                                <div className="phase-details__dependencies">
                                    <h4>Dependencies</h4>
                                    <ul>
                                        {selectedPhaseDetails.dependencies.map((dep, index) => (
                                            <li key={index} className="dependency-item">
                                                <i className="codicon codicon-link"></i>
                                                <span>{dep}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="phase-details__actions">
                                <button
                                    className="btn btn--primary"
                                    onClick={() => handleExecutePhase(selectedPhaseDetails.id)}
                                    disabled={selectedPhaseDetails.status === 'in-progress'}
                                >
                                    {selectedPhaseDetails.status === 'in-progress' ? (
                                        <>
                                            <i className="codicon codicon-sync codicon--spin"></i>
                                            Executing...
                                        </>
                                    ) : (
                                        <>
                                            <i className="codicon codicon-play"></i>
                                            Execute Phase
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
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
    container.render(<PlanViewer />);
}
