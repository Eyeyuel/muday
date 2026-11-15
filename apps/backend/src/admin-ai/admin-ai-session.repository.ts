import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
import type { ChatTurn } from './admin-ai.types.js';

export interface StoredAdminAiSession {
  sessionId: string;
  adminId: string;
  title: string;
  turns: ChatTurn[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminAiSessionSummary {
  sessionId: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
}

@Injectable()
export class AdminAiSessionRepository {
  private readonly logger = new Logger(AdminAiSessionRepository.name);
  private readonly ttlSeconds = 7200; // 2 hours
  private readonly maxTurns = 10; // Keep at most last 10 turns to protect context window

  // In-memory fallback if Redis is unavailable or for testing
  private readonly memoryStore = new Map<string, StoredAdminAiSession>();
  private readonly memoryIndices = new Map<string, AdminAiSessionSummary[]>();

  constructor(@Optional() @Inject(RedisService) private readonly redis?: RedisService) {}

  private getSessionKey(adminId: string, sessionId: string): string {
    return `admin_ai_session:${adminId}:${sessionId}`;
  }

  private getIndexKey(adminId: string): string {
    return `admin_ai_sessions_index:${adminId}`;
  }

  async getSession(adminId: string, sessionId: string): Promise<StoredAdminAiSession | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(this.getSessionKey(adminId, sessionId));
        if (raw) {
          return JSON.parse(raw) as StoredAdminAiSession;
        }
      } catch {
        this.logger.debug(`Redis read failed for session ${sessionId}, checking memory fallback`);
      }
    }

    return this.memoryStore.get(`${adminId}:${sessionId}`) ?? null;
  }

  async saveSession(
    adminId: string,
    sessionId: string,
    turns: ChatTurn[],
    title?: string,
  ): Promise<StoredAdminAiSession> {
    const existing = await this.getSession(adminId, sessionId);
    const now = new Date().toISOString();

    // Auto-truncate to maxTurns (keep latest turns)
    const truncatedTurns = turns.length > this.maxTurns ? turns.slice(-this.maxTurns) : turns;

    // Derive a clean title from first user message if not set
    let resolvedTitle = title ?? existing?.title;
    if (!resolvedTitle) {
      const firstUserTurn = turns.find((t) => t.role === 'user');
      const firstTextPart = firstUserTurn?.parts.find((p) => 'text' in p) as
        { text: string } | undefined;
      resolvedTitle = firstTextPart
        ? firstTextPart.text.slice(0, 40) + (firstTextPart.text.length > 40 ? '...' : '')
        : 'Data Exploration Chat';
    }

    const session: StoredAdminAiSession = {
      sessionId,
      adminId,
      title: resolvedTitle,
      turns: truncatedTurns,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (this.redis) {
      try {
        await this.redis.set(
          this.getSessionKey(adminId, sessionId),
          JSON.stringify(session),
          this.ttlSeconds,
        );
        await this.updateIndex(adminId, sessionId, resolvedTitle, truncatedTurns.length, now);
      } catch {
        this.logger.debug(`Redis write failed for session ${sessionId}, using memory fallback`);
      }
    }

    // Always keep memory fallback in sync
    this.memoryStore.set(`${adminId}:${sessionId}`, session);
    this.updateMemoryIndex(adminId, sessionId, resolvedTitle, truncatedTurns.length, now);

    return session;
  }

  async deleteSession(adminId: string, sessionId: string): Promise<boolean> {
    let deleted = false;

    if (this.redis) {
      try {
        const count = await this.redis.delete(this.getSessionKey(adminId, sessionId));
        deleted = count > 0;
        await this.removeFromIndex(adminId, sessionId);
      } catch {
        this.logger.debug(`Redis delete failed for session ${sessionId}`);
      }
    }

    const memoryDeleted = this.memoryStore.delete(`${adminId}:${sessionId}`);
    this.removeFromMemoryIndex(adminId, sessionId);

    return deleted || memoryDeleted;
  }

  async listSessions(adminId: string): Promise<AdminAiSessionSummary[]> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(this.getIndexKey(adminId));
        if (raw) {
          return JSON.parse(raw) as AdminAiSessionSummary[];
        }
      } catch {
        this.logger.debug(`Redis read failed for index ${adminId}`);
      }
    }

    return this.memoryIndices.get(adminId) ?? [];
  }

  private async updateIndex(
    adminId: string,
    sessionId: string,
    title: string,
    messageCount: number,
    lastMessageAt: string,
  ): Promise<void> {
    const list = await this.listSessions(adminId);
    const existingIndex = list.findIndex((s) => s.sessionId === sessionId);
    const entry: AdminAiSessionSummary = { sessionId, title, messageCount, lastMessageAt };

    if (existingIndex >= 0) {
      list[existingIndex] = entry;
    } else {
      list.unshift(entry);
    }

    // Keep at most 20 recent session summaries in the index
    const trimmedList = list.slice(0, 20);

    if (this.redis) {
      try {
        await this.redis.set(
          this.getIndexKey(adminId),
          JSON.stringify(trimmedList),
          this.ttlSeconds,
        );
      } catch {
        this.logger.debug(`Redis index write failed for ${adminId}`);
      }
    }

    this.memoryIndices.set(adminId, trimmedList);
  }

  private updateMemoryIndex(
    adminId: string,
    sessionId: string,
    title: string,
    messageCount: number,
    lastMessageAt: string,
  ): void {
    const list = this.memoryIndices.get(adminId) ?? [];
    const existingIndex = list.findIndex((s) => s.sessionId === sessionId);
    const entry: AdminAiSessionSummary = { sessionId, title, messageCount, lastMessageAt };

    if (existingIndex >= 0) {
      list[existingIndex] = entry;
    } else {
      list.unshift(entry);
    }

    this.memoryIndices.set(adminId, list.slice(0, 20));
  }

  private async removeFromIndex(adminId: string, sessionId: string): Promise<void> {
    const list = (await this.listSessions(adminId)).filter((s) => s.sessionId !== sessionId);
    if (this.redis) {
      try {
        await this.redis.set(this.getIndexKey(adminId), JSON.stringify(list), this.ttlSeconds);
      } catch {
        this.logger.debug(`Redis index update failed for ${adminId}`);
      }
    }
    this.memoryIndices.set(adminId, list);
  }

  private removeFromMemoryIndex(adminId: string, sessionId: string): void {
    const list = (this.memoryIndices.get(adminId) ?? []).filter((s) => s.sessionId !== sessionId);
    this.memoryIndices.set(adminId, list);
  }
}
