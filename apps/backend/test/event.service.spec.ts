import { describe, expect, it, vi } from 'vitest';

import { AllowedEventType, EventService } from '../src/analytics/event.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';

describe('EventService', () => {
  it('records allowlisted events without metadata', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'event-id' });
    const service = new EventService({ event: { create } } as unknown as PrismaService);
    await service.record('user-id', AllowedEventType.SIGNUP);
    expect(create).toHaveBeenCalledWith({
      data: { userId: 'user-id', eventType: 'signup' },
    });
  });

  it('rejects an event outside the allowlist', () => {
    const service = new EventService({ event: { create: vi.fn() } } as unknown as PrismaService);
    expect(() => service.record('user-id', 'raw_message' as never)).toThrow(
      'Unsupported analytics event type',
    );
  });

  it('accepts only the documented metadata for each event type', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'event-id' });
    const service = new EventService({ event: { create } } as unknown as PrismaService);
    await service.record('user-id', AllowedEventType.TRANSACTION_LOGGED, {
      source: 'voice',
      transactionCount: 2,
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-id',
        eventType: 'transaction_logged',
        metadata: { source: 'voice', transactionCount: 2 },
      },
    });
    expect(() =>
      service.record('user-id', AllowedEventType.TRANSACTION_LOGGED, {
        source: 'text',
        transactionCount: 1,
        amount: '500.00',
      }),
    ).toThrow('Unsupported analytics event metadata');
  });
});
