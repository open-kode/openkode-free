/**
 * Chat Store - Persistent conversation storage.
 * Uses ChatRepository (file-based JSON) as primary store;
 * falls back to VSCode globalState if the workspace path is unavailable.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { ChatRepository, Conversation } from './chatRepository';

export type { Conversation };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    filesChanged?: string[];
    latency?: number;
    model?: string;
    error?: string;
  };
}

const GLOBALSTATE_KEY = 'openkode.conversations';

export class ChatStore {
  private repo: ChatRepository;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const storagePath =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
      context.globalStorageUri?.fsPath ??
      os.tmpdir();
    this.repo = new ChatRepository(storagePath);
    this.migrateFromGlobalState();
  }

  private async migrateFromGlobalState(): Promise<void> {
    try {
      const existing = this.context.globalState.get<Conversation[]>(GLOBALSTATE_KEY, []);
      if (existing.length === 0) { return; }
      for (const conv of existing) {
        await this.repo.saveConversation(conv);
      }
      await this.context.globalState.update(GLOBALSTATE_KEY, []);
    } catch { /* non-fatal */ }
  }

  async getAllConversations(): Promise<Conversation[]> {
    return this.repo.getAllConversations();
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return (await this.repo.getConversation(id)) ?? undefined;
  }

  async getOrCreateConversation(workspaceRoot: string, mode: string): Promise<Conversation> {
    const existing = await this.repo.getConversationByWorkspace(workspaceRoot);
    if (existing) { return existing; }

    const newConv: Conversation = {
      id: this.generateId(),
      title: 'New Project',
      workspaceRoot,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: mode as Conversation['mode'],
    };
    await this.repo.saveConversation(newConv);
    return newConv;
  }

  async addMessage(conversationId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<void> {
    const newMessage: ChatMessage = {
      ...message,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    await this.repo.addMessage(conversationId, newMessage);

    // Auto-title from first user message
    if (message.role === 'user') {
      const conv = await this.repo.getConversation(conversationId);
      if (conv && conv.messages.length === 1) {
        conv.title = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
        await this.repo.saveConversation(conv);
      }
    }
  }

  async updateMode(conversationId: string, mode: string): Promise<void> {
    await this.repo.updateMode(conversationId, mode);
  }

  async deleteConversation(id: string): Promise<void> {
    await this.repo.deleteConversation(id);
  }

  async searchConversations(query: string): Promise<Conversation[]> {
    return this.repo.searchConversations(query);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
