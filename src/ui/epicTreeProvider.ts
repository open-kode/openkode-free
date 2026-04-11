/**
 * Epic Tree Provider - TreeView Provider for Epics/Phases
 * 
 * Provides a TreeDataProvider for VSCode's sidebar showing
 * Epic → Phase → Ticket hierarchy with context menus.
 */

import * as vscode from 'vscode';
import { Epic, Phase, Ticket, TicketStatus, PhaseStatus } from '../types';

/**
 * Tree item types for the epic tree
 */
export type EpicTreeItem = EpicItem | PhaseItem | TicketItem;

/**
 * Epic item in the tree
 */
export class EpicItem extends vscode.TreeItem {
    constructor(
        public readonly epic: Epic,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(epic.name, collapsibleState);
        this.tooltip = epic.description;
        this.description = `${epic.phases.length} phases`;
        this.contextValue = 'epic';
        this.iconPath = new vscode.ThemeIcon('project');
        this.id = `epic-${epic.id}`;
        
        // Set command for clicking
        this.command = {
            command: 'openkode.showEpicDetails',
            title: 'Show Epic Details',
            arguments: [epic]
        };
    }
}

/**
 * Phase item in the tree
 */
export class PhaseItem extends vscode.TreeItem {
    constructor(
        public readonly phase: Phase,
        public readonly epicId: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(phase.name, collapsibleState);
        this.tooltip = phase.description;
        this.description = this.getPhaseDescription(phase);
        this.contextValue = 'phase';
        this.id = `phase-${phase.id}`;
        
        // Set icon based on status
        this.iconPath = this.getStatusIcon(phase.status);
        
        // Set command for clicking
        this.command = {
            command: 'openkode.showPhaseDetails',
            title: 'Show Phase Details',
            arguments: [phase]
        };
    }

    private getPhaseDescription(phase: Phase): string {
        const ticketCount = phase.tickets?.length || 0;
        const completedTickets = phase.tickets?.filter(t => t.status === 'completed').length || 0;
        return `${completedTickets}/${ticketCount} tickets • ${phase.status}`;
    }

    private getStatusIcon(status: PhaseStatus): vscode.ThemeIcon {
        switch (status) {
            case 'completed':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            case 'in-progress':
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('testing.iconQueued'));
            case 'failed':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
            case 'pending':
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }
}

/**
 * Ticket item in the tree
 */
export class TicketItem extends vscode.TreeItem {
    constructor(
        public readonly ticket: Ticket,
        public readonly phaseId: string,
        public readonly epicId: string
    ) {
        super(ticket.name, vscode.TreeItemCollapsibleState.None);
        this.tooltip = ticket.description;
        this.description = ticket.status;
        this.contextValue = 'ticket';
        this.id = `ticket-${ticket.id}`;
        
        // Set icon based on status
        this.iconPath = this.getStatusIcon(ticket.status);
        
        // Set command for clicking
        this.command = {
            command: 'openkode.showTicketDetails',
            title: 'Show Ticket Details',
            arguments: [ticket]
        };
    }

    private getStatusIcon(status: TicketStatus): vscode.ThemeIcon {
        switch (status) {
            case 'completed':
                return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
            case 'in-progress':
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('testing.iconQueued'));
            case 'blocked':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
            case 'failed':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
            case 'pending':
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }
}

/**
 * Epic Tree Data Provider
 */
export class EpicTreeProvider implements vscode.TreeDataProvider<EpicTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<EpicTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<EpicTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<EpicTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private epics: Epic[] = [];
    private expandedEpics: Set<string> = new Set();
    private expandedPhases: Set<string> = new Set();

    constructor(private context: vscode.ExtensionContext) {
        // Register context menu commands
        this.registerCommands();
    }

    /**
     * Get tree item for an element
     */
    getTreeItem(element: EpicTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children of an element
     */
    getChildren(element?: EpicTreeItem): Thenable<EpicTreeItem[]> {
        if (!element) {
            // Root level - return epics
            return Promise.resolve(
                this.epics.map(epic => 
                    new EpicItem(
                        epic,
                        this.expandedEpics.has(epic.id) 
                            ? vscode.TreeItemCollapsibleState.Expanded 
                            : vscode.TreeItemCollapsibleState.Collapsed
                    )
                )
            );
        }

        if (element instanceof EpicItem) {
            // Epic level - return phases
            return Promise.resolve(
                element.epic.phases.map(phase => 
                    new PhaseItem(
                        phase,
                        element.epic.id,
                        this.expandedPhases.has(phase.id)
                            ? vscode.TreeItemCollapsibleState.Expanded
                            : vscode.TreeItemCollapsibleState.Collapsed
                    )
                )
            );
        }

        if (element instanceof PhaseItem) {
            // Phase level - return tickets
            return Promise.resolve(
                (element.phase.tickets || []).map(ticket => 
                    new TicketItem(ticket, element.phase.id, element.epicId)
                )
            );
        }

        return Promise.resolve([]);
    }

    /**
     * Get parent of an element (required for reveal)
     */
    getParent(element: EpicTreeItem): vscode.ProviderResult<EpicTreeItem> {
        if (element instanceof PhaseItem) {
            const epic = this.epics.find(e => e.id === element.epicId);
            if (epic) {
                return new EpicItem(epic, vscode.TreeItemCollapsibleState.Expanded);
            }
        }

        if (element instanceof TicketItem) {
            for (const epic of this.epics) {
                const phase = epic.phases.find(p => p.id === element.phaseId);
                if (phase) {
                    return new PhaseItem(phase, epic.id, vscode.TreeItemCollapsibleState.Expanded);
                }
            }
        }

        return null;
    }

    /**
     * Set epics data and refresh the tree
     */
    setEpics(epics: Epic[]): void {
        this.epics = epics;
        this.refresh();
    }

    /**
     * Add a single epic
     */
    addEpic(epic: Epic): void {
        const existingIndex = this.epics.findIndex(e => e.id === epic.id);
        if (existingIndex >= 0) {
            this.epics[existingIndex] = epic;
        } else {
            this.epics.push(epic);
        }
        this.refresh();
    }

    /**
     * Remove an epic
     */
    removeEpic(epicId: string): void {
        this.epics = this.epics.filter(e => e.id !== epicId);
        this.refresh();
    }

    /**
     * Update a phase status
     */
    updatePhaseStatus(epicId: string, phaseId: string, status: PhaseStatus): void {
        const epic = this.epics.find(e => e.id === epicId);
        if (epic) {
            const phase = epic.phases.find(p => p.id === phaseId);
            if (phase) {
                phase.status = status;
                this.refresh();
            }
        }
    }

    /**
     * Update a ticket status
     */
    updateTicketStatus(epicId: string, phaseId: string, ticketId: string, status: TicketStatus): void {
        const epic = this.epics.find(e => e.id === epicId);
        if (epic) {
            const phase = epic.phases.find(p => p.id === phaseId);
            if (phase && phase.tickets) {
                const ticket = phase.tickets.find(t => t.id === ticketId);
                if (ticket) {
                    ticket.status = status;
                    this.refresh();
                }
            }
        }
    }

    /**
     * Expand all items
     */
    expandAll(): void {
        this.epics.forEach(epic => {
            this.expandedEpics.add(epic.id);
            epic.phases.forEach(phase => {
                this.expandedPhases.add(phase.id);
            });
        });
        this.refresh();
    }

    /**
     * Collapse all items
     */
    collapseAll(): void {
        this.expandedEpics.clear();
        this.expandedPhases.clear();
        this.refresh();
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Find and reveal an item in the tree
     */
    async revealItem(
        treeView: vscode.TreeView<EpicTreeItem>,
        itemId: string,
        itemType: 'epic' | 'phase' | 'ticket'
    ): Promise<void> {
        // Expand parents first
        if (itemType === 'ticket') {
            for (const epic of this.epics) {
                for (const phase of epic.phases) {
                    if (phase.tickets?.some(t => t.id === itemId)) {
                        this.expandedEpics.add(epic.id);
                        this.expandedPhases.add(phase.id);
                        this.refresh();
                        break;
                    }
                }
            }
        } else if (itemType === 'phase') {
            for (const epic of this.epics) {
                if (epic.phases.some(p => p.id === itemId)) {
                    this.expandedEpics.add(epic.id);
                    this.refresh();
                    break;
                }
            }
        }

        // Find and reveal the item
        const item = await this.findItem(itemId, itemType);
        if (item) {
            await treeView.reveal(item, { select: true, focus: true });
        }
    }

    /**
     * Find an item by ID and type
     */
    private async findItem(
        itemId: string, 
        itemType: 'epic' | 'phase' | 'ticket'
    ): Promise<EpicTreeItem | undefined> {
        if (itemType === 'epic') {
            const epic = this.epics.find(e => e.id === itemId);
            if (epic) {
                return new EpicItem(epic, vscode.TreeItemCollapsibleState.None);
            }
        }

        if (itemType === 'phase') {
            for (const epic of this.epics) {
                const phase = epic.phases.find(p => p.id === itemId);
                if (phase) {
                    return new PhaseItem(phase, epic.id, vscode.TreeItemCollapsibleState.None);
                }
            }
        }

        if (itemType === 'ticket') {
            for (const epic of this.epics) {
                for (const phase of epic.phases) {
                    const ticket = phase.tickets?.find(t => t.id === itemId);
                    if (ticket) {
                        return new TicketItem(ticket, phase.id, epic.id);
                    }
                }
            }
        }

        return undefined;
    }

    /**
     * Register context menu commands
     */
    private registerCommands(): void {
        // Epic commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('openkode.executeEpic', (item: EpicItem) => {
                vscode.commands.executeCommand('openkode.executeEpicCommand', item.epic);
            }),
            vscode.commands.registerCommand('openkode.deleteEpic', (item: EpicItem) => {
                this.removeEpic(item.epic.id);
            }),
            vscode.commands.registerCommand('openkode.editEpic', (item: EpicItem) => {
                vscode.commands.executeCommand('openkode.editEpicCommand', item.epic);
            })
        );

        // Phase commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('openkode.executePhase', (item: PhaseItem) => {
                vscode.commands.executeCommand('openkode.executePhaseCommand', item.phase);
            }),
            vscode.commands.registerCommand('openkode.skipPhase', (item: PhaseItem) => {
                this.updatePhaseStatus(item.epicId, item.phase.id, 'completed');
            }),
            vscode.commands.registerCommand('openkode.resetPhase', (item: PhaseItem) => {
                this.updatePhaseStatus(item.epicId, item.phase.id, 'pending');
            })
        );

        // Ticket commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('openkode.executeTicket', (item: TicketItem) => {
                vscode.commands.executeCommand('openkode.executeTicketCommand', item.ticket);
            }),
            vscode.commands.registerCommand('openkode.markTicketComplete', (item: TicketItem) => {
                this.updateTicketStatus(item.epicId, item.phaseId, item.ticket.id, 'completed');
            }),
            vscode.commands.registerCommand('openkode.markTicketBlocked', (item: TicketItem) => {
                this.updateTicketStatus(item.epicId, item.phaseId, item.ticket.id, 'blocked');
            })
        );

        // General commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('openkode.expandAll', () => {
                this.expandAll();
            }),
            vscode.commands.registerCommand('openkode.collapseAll', () => {
                this.collapseAll();
            })
        );
    }
}
