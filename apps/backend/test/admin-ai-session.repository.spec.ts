import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAiSessionRepository } from '../src/admin-ai/admin-ai-session.repository.js';
import type { ChatTurn } from '../src/admin-ai/admin-ai.types.js';
import type { RedisService } from '../src/redis/redis.service.js';

describe('AdminAiSessionRepository', () => {
  let repository: AdminAiSessionRepository;
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      delete: vi.fn().mockResolvedValue(1),
    };

    repository = new AdminAiSessionRepository(mockRedis as unknown as RedisService);
  });

  it('saves a session to Redis with 2-hour TTL and auto-generates title', async () => {
    const turns: ChatTurn[] = [
      { role: 'user', parts: [{ text: 'Who spent the most on Telebirr this month?' }] },
      { role: 'model', parts: [{ text: 'Gamer spent the most with 8,400 ETB.' }] },
    ];

    const saved = await repository.saveSession('admin-1', 'session-123', turns);

    expect(saved.sessionId).toBe('session-123');
    expect(saved.title).toBe('Who spent the most on Telebirr this mont...');
    expect(saved.turns).toHaveLength(2);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'admin_ai_session:admin-1:session-123',
      expect.any(String),
      7200,
    );
  });

  it('truncates conversation turns exceeding maxTurns (10)', async () => {
    const turns: ChatTurn[] = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      parts: [{ text: `Turn ${i + 1}` }],
    }));

    const saved = await repository.saveSession('admin-1', 'session-trunc', turns);

    expect(saved.turns).toHaveLength(10);
    expect(saved.turns[0]?.parts[0]).toEqual({ text: 'Turn 6' });
    expect(saved.turns[9]?.parts[0]).toEqual({ text: 'Turn 15' });
  });

  it('retrieves an existing session from Redis', async () => {
    const stored = {
      sessionId: 'session-abc',
      adminId: 'admin-1',
      title: 'Top Telebirr Spenders',
      turns: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRedis.get.mockResolvedValueOnce(JSON.stringify(stored));

    const result = await repository.getSession('admin-1', 'session-abc');

    expect(result).not.toBeNull();
    expect(result?.sessionId).toBe('session-abc');
    expect(result?.title).toBe('Top Telebirr Spenders');
  });

  it('deletes a session and updates the index', async () => {
    mockRedis.delete.mockResolvedValue(1);

    const deleted = await repository.deleteSession('admin-1', 'session-123');
    expect(deleted).toBe(true);
    expect(mockRedis.delete).toHaveBeenCalledWith('admin_ai_session:admin-1:session-123');
  });

  it('falls back to memory store if Redis is unavailable', async () => {
    const memoryRepo = new AdminAiSessionRepository(); // no Redis provided

    const turns: ChatTurn[] = [{ role: 'user', parts: [{ text: 'Testing memory fallback' }] }];

    await memoryRepo.saveSession('admin-2', 'session-mem', turns);

    const retrieved = await memoryRepo.getSession('admin-2', 'session-mem');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe('Testing memory fallback');

    const sessions = await memoryRepo.listSessions('admin-2');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionId).toBe('session-mem');

    const deleted = await memoryRepo.deleteSession('admin-2', 'session-mem');
    expect(deleted).toBe(true);

    const afterDelete = await memoryRepo.getSession('admin-2', 'session-mem');
    expect(afterDelete).toBeNull();
  });
});
