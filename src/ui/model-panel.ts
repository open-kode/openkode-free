/**
 * Model Profiles Panel — TreeView UI.
 *
 * Displays all four workflow modes and their active LLM profiles in the
 * OpenKode sidebar. Each row shows:
 *   <workflow icon>  <Mode Name>    <provider badge>  <model name>
 *
 * Clicking a row opens an inline "Apply" QuickPick via promptAndApplyProfile().
 *
 * Registered as a VS Code TreeDataProvider and wired to the
 * "openkode.modelProfilesTree" view in the activity bar container.
 */
import * as vscode from 'vscode';
import {
  getAllProfiles,
  getRecommendedProfile,
  applyProfile,
  promptAndApplyProfile,
  RECOMMENDED_PROFILES,
  MODE_ICONS,
  WORKFLOW_ICONS,
  type ModelProfile,
  type WorkflowModeName,
} from '../core/model-profiles';
import { llmRouter } from '../core/llm-router';

// ─── Tree item types ──────────────────────────────────────────────────────────

/** Discriminated union for tree nodes. */
type TreeNodeKind = 'mode-header' | 'active-profile' | 'recommended-badge' | 'action';

/**
 * A single item displayed in the Model Profiles tree.
 */
export class ModelProfileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly kind: TreeNodeKind,
    label: string,
    public readonly workflowMode?: WorkflowModeName,
    public readonly profile?: ModelProfile,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
  ) {
    super(label, collapsibleState);
  }
}

// ─── TreeDataProvider ─────────────────────────────────────────────────────────

/**
 * Provides the data for the "Model Profiles" tree view.
 * Refreshes automatically when VS Code configuration changes.
 */
export class ModelProfilesProvider
  implements vscode.TreeDataProvider<ModelProfileTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    ModelProfileTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _configListener: vscode.Disposable;

  constructor() {
    // Re-render tree whenever any openkode.* config changes
    this._configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('openkode')) {
        this.refresh();
      }
    });
  }

  /** Force a full tree refresh. */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /** Dispose the configuration listener. */
  dispose(): void {
    this._configListener.dispose();
    this._onDidChangeTreeData.dispose();
  }

  // ── TreeDataProvider implementation ─────────────────────────────────────────

  getTreeItem(element: ModelProfileTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ModelProfileTreeItem): ModelProfileTreeItem[] {
    if (!element) {
      // Root: one entry per workflow mode
      return this._buildRootItems();
    }

    if (element.kind === 'mode-header' && element.workflowMode) {
      return this._buildProfileChildren(element.workflowMode);
    }

    return [];
  }

  // ── Private builders ─────────────────────────────────────────────────────────

  private _buildRootItems(): ModelProfileTreeItem[] {
    const modes: WorkflowModeName[] = ['Precision', 'Blueprint', 'Visionary', 'Rocket'];
    const activeConfig = llmRouter.getConfig();

    return modes.map((modeName) => {
      const profile = getRecommendedProfile(modeName);
      const providerIcon = MODE_ICONS[profile.mode];
      const workflowIcon = WORKFLOW_ICONS[modeName];
      const badge = profile.mode === 'local' ? 'Local' : profile.mode === 'cloud-key' ? 'Cloud' : 'Relay';
      const isActive =
        activeConfig.mode === profile.mode &&
        (profile.mode === 'local'
          ? activeConfig.local?.model === profile.model
          : activeConfig.cloud?.model === profile.model);

      const item = new ModelProfileTreeItem(
        'mode-header',
        modeName,
        modeName,
        profile,
        vscode.TreeItemCollapsibleState.Collapsed,
      );

      item.description = `$(${providerIcon}) ${badge} • ${profile.model}`;
      item.tooltip = new vscode.MarkdownString(
        `**${modeName} Mode**\n\n` +
        `Provider: \`${profile.mode}\`\n\n` +
        `Model: \`${profile.model}\`\n\n` +
        (isActive ? '_✓ Currently active_' : '_Click to expand and apply_'),
      );
      item.iconPath = new vscode.ThemeIcon(
        workflowIcon,
        isActive
          ? new vscode.ThemeColor('testing.iconPassed')
          : new vscode.ThemeColor('foreground'),
      );
      item.contextValue = 'modelProfileMode';

      return item;
    });
  }

  private _buildProfileChildren(workflowMode: WorkflowModeName): ModelProfileTreeItem[] {
    const current = getRecommendedProfile(workflowMode);
    const recommended = RECOMMENDED_PROFILES[workflowMode];
    const items: ModelProfileTreeItem[] = [];

    // ── Active profile row ─────────────────────────────────────────────────
    const activeItem = new ModelProfileTreeItem(
      'active-profile',
      `$(${MODE_ICONS[current.mode]})  ${current.model}`,
      workflowMode,
      current,
    );
    activeItem.description = current.mode === 'local' ? 'Local inference' : current.mode === 'cloud-key' ? 'Cloud API' : 'Managed relay';
    activeItem.tooltip = `Active profile for ${workflowMode} mode`;
    activeItem.iconPath = new vscode.ThemeIcon('check');
    activeItem.contextValue = 'modelProfileActive';
    items.push(activeItem);

    // ── Recommended badge (if different from current) ─────────────────────
    const isDifferent =
      recommended.mode !== current.mode || recommended.model !== current.model;

    if (isDifferent) {
      const recItem = new ModelProfileTreeItem(
        'recommended-badge',
        `Recommended: ${recommended.model}`,
        workflowMode,
        recommended,
      );
      recItem.description = recommended.mode === 'local' ? '$(cpu) Local' : '$(cloud) Cloud';
      recItem.tooltip = `Reset to recommended profile (${recommended.model})`;
      recItem.iconPath = new vscode.ThemeIcon('lightbulb');
      recItem.command = {
        command: 'openkode.applyRecommendedProfile',
        title: 'Apply Recommended',
        arguments: [workflowMode],
      };
      recItem.contextValue = 'modelProfileRecommended';
      items.push(recItem);
    }

    // ── "Change…" action row ──────────────────────────────────────────────
    const changeItem = new ModelProfileTreeItem(
      'action',
      'Change profile…',
      workflowMode,
      undefined,
    );
    changeItem.iconPath = new vscode.ThemeIcon('edit');
    changeItem.tooltip = `Open profile editor for ${workflowMode} mode`;
    changeItem.command = {
      command: 'openkode.editModeProfile',
      title: 'Change profile',
      arguments: [workflowMode],
    };
    changeItem.contextValue = 'modelProfileAction';
    items.push(changeItem);

    return items;
  }
}

// ─── Panel registration ───────────────────────────────────────────────────────

let _provider: ModelProfilesProvider | undefined;

/**
 * Register the Model Profiles tree view and all related commands.
 * Must be called once from `activate()`.
 *
 * @param context  VS Code extension context.
 */
export function registerModelProfilesPanel(context: vscode.ExtensionContext): void {
  _provider = new ModelProfilesProvider();

  const treeView = vscode.window.createTreeView('openkode.modelProfilesTree', {
    treeDataProvider: _provider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView, _provider);

  // ── Commands ──────────────────────────────────────────────────────────────

  // Show / focus the tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('openkode.showModelProfiles', () => {
      treeView.reveal(_provider!.getChildren()[0], { focus: true, expand: true });
    }),
  );

  // Edit a specific mode's profile via QuickPick
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'openkode.editModeProfile',
      async (workflowMode: WorkflowModeName) => {
        await promptAndApplyProfile(workflowMode);
        _provider?.refresh();
      },
    ),
  );

  // Apply recommended default for a mode (triggered from tree item click)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'openkode.applyRecommendedProfile',
      async (workflowMode: WorkflowModeName) => {
        const recommended = RECOMMENDED_PROFILES[workflowMode];
        await applyProfile(workflowMode, recommended);
        _provider?.refresh();
        vscode.window.showInformationMessage(
          `OpenKode: Reset ${workflowMode} to recommended — ${recommended.model}`,
        );
      },
    ),
  );

  // Convenience: "Apply Rocket Profile" command (from the spec)
  context.subscriptions.push(
    vscode.commands.registerCommand('openkode.applyRocketProfile', async () => {
      const rocket = RECOMMENDED_PROFILES['Rocket'];
      await applyProfile('Rocket', rocket);
      _provider?.refresh();
      vscode.window.showInformationMessage(
        `OpenKode: Rocket profile applied → $(cpu) Local • ${rocket.model}`,
      );
    }),
  );

  // Inline "Apply" from header row context menu
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'openkode.applyModeProfile',
      async (item: ModelProfileTreeItem) => {
        if (!item.workflowMode || !item.profile) return;
        await applyProfile(item.workflowMode, item.profile);
        _provider?.refresh();
      },
    ),
  );
}

/** Refresh the tree from outside the module (e.g. after a router config change). */
export function refreshModelProfilesPanel(): void {
  _provider?.refresh();
}
