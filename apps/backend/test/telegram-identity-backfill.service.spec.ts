import { describe, expect, it, vi } from 'vitest';

import type { IdentityRepository } from '../src/identity/identity.repository.js';
import { TelegramIdentityBackfillService } from '../src/identity/telegram-identity-backfill.service.js';

const user = {
  id: '00000000-0000-4000-8000-000000000101',
  telegramId: 5_014_137_13n,
  firstName: 'Test',
  lastName: 'User',
  username: 'test_user',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-02T00:00:00.000Z'),
};

describe('TelegramIdentityBackfillService', () => {
  it('defaults to a mutation-free dry run and reports would-create rows', async () => {
    const listUsersWithTelegramId = vi.fn().mockResolvedValueOnce([user]).mockResolvedValueOnce([]);
    const findTelegramCandidates = vi.fn().mockResolvedValue([]);
    const transaction = vi.fn();
    const service = new TelegramIdentityBackfillService({
      listUsersWithTelegramId,
      findTelegramCandidates,
      prisma: { $transaction: transaction },
    } as unknown as IdentityRepository);

    await expect(service.run({ dryRun: true })).resolves.toEqual({
      dryRun: true,
      examined: 1,
      eligible: 1,
      wouldCreate: 1,
      created: 0,
      existing: 0,
      conflicts: [],
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('creates an identity and safe audit event atomically in apply mode', async () => {
    const identity = { id: '00000000-0000-4000-8000-000000000201' };
    const identityLinkEventCreate = vi.fn().mockResolvedValue({ id: 'event-id' });
    const database = { identityLinkEvent: { create: identityLinkEventCreate } };
    const transaction = vi.fn(async (operation: (client: typeof database) => Promise<void>) =>
      operation(database),
    );
    const createTelegramIdentity = vi.fn().mockResolvedValue(identity);
    const service = new TelegramIdentityBackfillService({
      listUsersWithTelegramId: vi.fn().mockResolvedValueOnce([user]),
      findTelegramCandidates: vi.fn().mockResolvedValue([]),
      createTelegramIdentity,
      prisma: { $transaction: transaction },
    } as unknown as IdentityRepository);

    const result = await service.run({ dryRun: false });

    expect(result).toMatchObject({ created: 1, existing: 0, wouldCreate: 0, conflicts: [] });
    expect(createTelegramIdentity).toHaveBeenCalledWith(user, database);
    expect(identityLinkEventCreate).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        identityId: identity.id,
        eventType: 'CREATED',
        channel: 'BACKFILL',
        metadata: { source: 'users.telegram_id', version: 1 },
      },
    });
  });

  it('is idempotent when the canonical identity already exists', async () => {
    const service = new TelegramIdentityBackfillService({
      listUsersWithTelegramId: vi.fn().mockResolvedValueOnce([user]),
      findTelegramCandidates: vi.fn().mockResolvedValue([
        {
          userId: user.id,
          providerSubject: user.telegramId.toString(),
          telegramUserId: user.telegramId,
        },
      ]),
      prisma: { $transaction: vi.fn() },
    } as unknown as IdentityRepository);

    await expect(service.run({ dryRun: false })).resolves.toMatchObject({
      created: 0,
      existing: 1,
      conflicts: [],
    });
  });

  it('fails closed and reports an identity owned by another user', async () => {
    const service = new TelegramIdentityBackfillService({
      listUsersWithTelegramId: vi.fn().mockResolvedValueOnce([user]),
      findTelegramCandidates: vi.fn().mockResolvedValue([
        {
          userId: '00000000-0000-4000-8000-000000000999',
          providerSubject: user.telegramId.toString(),
          telegramUserId: user.telegramId,
        },
      ]),
      prisma: { $transaction: vi.fn() },
    } as unknown as IdentityRepository);

    await expect(service.run({ dryRun: false })).resolves.toMatchObject({
      created: 0,
      existing: 0,
      conflicts: [{ userId: user.id, reason: 'identity_owned_by_another_user' }],
    });
  });

  it('rejects unsafe batch sizes', async () => {
    const service = new TelegramIdentityBackfillService({} as IdentityRepository);
    await expect(service.run({ dryRun: true, batchSize: 0 })).rejects.toThrow(
      'Identity backfill batch size must be between 1 and 1000',
    );
  });
});
