/**
 * PhaseList.tsx - Phase Tree Component
 * 
 * React component for displaying a hierarchical list of phases
 * with expand/collapse functionality and status indicators.
 */

import React, { useCallback } from 'react';
import { Phase, PhaseStatus } from '../../types';

/**
 * Phase list component props
 */
interface PhaseListProps {
    phases: Phase[];
    selectedPhase: string | null;
    expandedPhases: Set<string>;
    onSelect: (phaseId: string) => void;
    onExpand: (phaseId: string, expanded: boolean) => void;
    onExecute: (phaseId: string) => void;
}

/**
 * Get status icon based on phase status
 */
const getStatusIcon = (status: PhaseStatus): string => {
    switch (status) {
        case 'completed':
            return 'codicon-pass';
        case 'in-progress':
            return 'codicon-sync codicon--spin';
        case 'failed':
            return 'codicon-error';
        case 'pending':
        default:
            return 'codicon-circle-outline';
    }
};

/**
 * Get status class for styling
 */
const getStatusClass = (status: PhaseStatus): string => {
    return `status--${status}`;
};

/**
 * Phase item component
 */
interface PhaseItemProps {
    phase: Phase;
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: (phaseId: string) => void;
    onExpand: (phaseId: string, expanded: boolean) => void;
    onExecute: (phaseId: string) => void;
}

const PhaseItem = ({
    phase,
    isSelected,
    isExpanded,
    onSelect,
    onExpand,
    onExecute
}: PhaseItemProps) => {
    const handleClick = useCallback(() => {
        onSelect(phase.id);
    }, [phase.id, onSelect]);

    const handleExpandClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onExpand(phase.id, !isExpanded);
    }, [phase.id, isExpanded, onExpand]);

    const handleExecuteClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onExecute(phase.id);
    }, [phase.id, onExecute]);

    const hasDetails = phase.files && phase.files.length > 0 || 
                       phase.dependencies && phase.dependencies.length > 0 ||
                       phase.tickets && phase.tickets.length > 0;

    return (
        <div 
            className={`phase-item ${isSelected ? 'phase-item--selected' : ''} ${getStatusClass(phase.status)}`}
            onClick={handleClick}
        >
            <div className="phase-item__header">
                {/* Expand/collapse button */}
                {hasDetails ? (
                    <button 
                        className={`phase-item__expand-btn ${isExpanded ? 'expanded' : ''}`}
                        onClick={handleExpandClick}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                        <i className="codicon codicon-chevron-right"></i>
                    </button>
                ) : (
                    <span className="phase-item__expand-placeholder"></span>
                )}

                {/* Status icon */}
                <i className={`codicon ${getStatusIcon(phase.status)} phase-item__status`}></i>

                {/* Phase name and info */}
                <div className="phase-item__content">
                    <span className="phase-item__name">{phase.name}</span>
                    <span className="phase-item__meta">
                        {phase.tickets && (
                            <span className="meta-badge">
                                <i className="codicon codicon-tasklist"></i>
                                {phase.tickets.filter(t => t.status === 'completed').length}/{phase.tickets.length}
                            </span>
                        )}
                        {phase.files && (
                            <span className="meta-badge">
                                <i className="codicon codicon-file-code"></i>
                                {phase.files.length}
                            </span>
                        )}
                        {phase.estimatedTime && (
                            <span className="meta-badge">
                                <i className="codicon codicon-clock"></i>
                                {phase.estimatedTime}ms
                            </span>
                        )}
                    </span>
                </div>

                {/* Execute button */}
                <button
                    className="phase-item__execute-btn"
                    onClick={handleExecuteClick}
                    disabled={phase.status === 'in-progress'}
                    title="Execute Phase"
                >
                    {phase.status === 'in-progress' ? (
                        <i className="codicon codicon-sync codicon--spin"></i>
                    ) : (
                        <i className="codicon codicon-play"></i>
                    )}
                </button>
            </div>

            {/* Expanded details */}
            {isExpanded && hasDetails && (
                <div className="phase-item__details">
                    {phase.description && (
                        <p className="phase-item__description">{phase.description}</p>
                    )}

                    {/* Tickets */}
                    {phase.tickets && phase.tickets.length > 0 && (
                        <div className="phase-item__section">
                            <h4>Tickets</h4>
                            <ul className="ticket-list">
                                {phase.tickets.map(ticket => (
                                    <li 
                                        key={ticket.id} 
                                        className={`ticket-item status--${ticket.status}`}
                                    >
                                        <i className={`codicon ${
                                            ticket.status === 'completed' ? 'codicon-pass' :
                                            ticket.status === 'in-progress' ? 'codicon-sync' :
                                            ticket.status === 'blocked' ? 'codicon-warning' :
                                            ticket.status === 'failed' ? 'codicon-error' :
                                            'codicon-circle-outline'
                                        }`}></i>
                                        <span className="ticket-name">{ticket.name}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Files */}
                    {phase.files && phase.files.length > 0 && (
                        <div className="phase-item__section">
                            <h4>Files</h4>
                            <ul className="file-list">
                                {phase.files.map((file, index) => (
                                    <li key={index} className="file-item">
                                        <i className="codicon codicon-file-code"></i>
                                        <span>{file}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Dependencies */}
                    {phase.dependencies && phase.dependencies.length > 0 && (
                        <div className="phase-item__section">
                            <h4>Dependencies</h4>
                            <ul className="dependency-list">
                                {phase.dependencies.map((dep: string, index: number) => (
                                    <li key={index} className="dependency-item">
                                        <i className="codicon codicon-link"></i>
                                        <span>{dep}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Phase list component
 */
export const PhaseList = ({
    phases,
    selectedPhase,
    expandedPhases,
    onSelect,
    onExpand,
    onExecute
}: PhaseListProps) => {
    if (phases.length === 0) {
        return (
            <div className="phase-list phase-list--empty">
                <div className="empty-state">
                    <i className="codicon codicon-inbox"></i>
                    <p>No phases found</p>
                    {phases.length === 0 && (
                        <span className="empty-hint">Try adjusting your search or filter</span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="phase-list">
            {phases.map(phase => (
                <PhaseItem
                    key={phase.id}
                    phase={phase}
                    isSelected={selectedPhase === phase.id}
                    isExpanded={expandedPhases.has(phase.id)}
                    onSelect={onSelect}
                    onExpand={onExpand}
                    onExecute={onExecute}
                />
            ))}
        </div>
    );
};

/**
 * Compact phase list for sidebar
 */
interface CompactPhaseListProps {
    phases: Phase[];
    onSelect: (phaseId: string) => void;
}

export const CompactPhaseList: React.FC<CompactPhaseListProps> = ({
    phases,
    onSelect
}) => {
    return (
        <div className="phase-list phase-list--compact">
            {phases.map(phase => (
                <div
                    key={phase.id}
                    className={`phase-item--compact ${getStatusClass(phase.status)}`}
                    onClick={() => onSelect(phase.id)}
                >
                    <i className={`codicon ${getStatusIcon(phase.status)}`}></i>
                    <span className="phase-name">{phase.name}</span>
                </div>
            ))}
        </div>
    );
};

export default PhaseList;
