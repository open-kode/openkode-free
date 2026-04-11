/**
 * Chat Repository - File-based JSON persistence for conversations.
 * Stores data in {workspaceRoot}/.openkode/conversations.json.
 * No external database required.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ChatMessage } from './chatStore';

export interface Conversation {
  id: string;
  title: string;
  workspaceRoot: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  mode: 'precision' | 'blueprint' | 'visionary' | 'rocket';
}

interface Store {
  conversations: Conversation[];
}

export class ChatRepository {
  private readonly filePath: string;
  private cache: Store | null = null;

  constructor(storagePath: string) {
    this.filePath = path.join(storagePath, '.openkode', 'conversations.json');
  }

  private async read(): Promise<Store> {
    if (this.cache) { return this.cache; }
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.cache = JSON.parse(raw) as Store;
    } catch {
      this.cache = { conversations: [] };
    }
    return this.cache;
  }

  private async write(store: Store): Promise<void> {
    this.cache = store;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  async getAllConversations(): Promise<Conversation[]> {
    const store = await this.read();
    return [...store.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const store = await this.read();
    return store.conversations.find(c => c.id === id) ?? null;
  }

  async getConversationByWorkspace(workspaceRoot: string): Promise<Conversation | null> {
    const store = await this.read();
    return store.conversations
      .filter(c => c.workspaceRoot === workspaceRoot)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    const store = await this.read();
    conversation.updatedAt = Date.now();
    const idx = store.conversations.findIndex(c => c.id === conversation.id);
    if (idx >= 0) {
      store.conversations[idx] = conversation;
    } else {
      store.conversations.push(conversation);
    }
    await this.write(store);
  }

  async addMessage(conversationId: string, message: ChatMessage): Promise<void> {
    const store = await this.read();
    const conv = store.conversations.find(c => c.id === conversationId);
    if (!conv) { return; }
    conv.messages.push(message);
    conv.updatedAt = Date.now();
    await this.write(store);
  }

  async updateMode(conversationId: string, mode: string): Promise<void> {
    const store = await this.read();
    const conv = store.conversations.find(c => c.id === conversationId);
    if (!conv) { return; }
    conv.mode = mode as Conversation['mode'];
    conv.updatedAt = Date.now();
    await this.write(store);
  }

  async deleteConversation(id: string): Promise<void> {
    const store = await this.read();
    store.conversations = store.conversations.filter(c => c.id !== id);
    this.cache = store;
    await this.write(store);
  }

  async searchConversations(query: string): Promise<Conversation[]> {
    const store = await this.read();
    const q = query.toLowerCase();
    return store.conversations
      .filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some(m => m.content.toLowerCase().includes(q))
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Invalidate in-memory cache (call if file was modified externally). */
  invalidateCache(): void {
    this.cache = null;
  }
}
