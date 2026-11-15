import { describe, expect, it, vi } from 'vitest';

import { CorrelationContext } from '../src/observability/correlation-context.service.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import type { TelegramUpdateClaimService } from '../src/telegram/telegram-update-claim.service.js';
import { TelegramUpdateProcessorService } from '../src/telegram/telegram-update-processor.service.js';
import type { TelegramUpdateRouterService } from '../src/telegram/telegram-update-router.service.js';
import type { TelegramUpdate } from '../src/telegram/telegram.types.js';
import type { TelegramTransport } from '../src/telegram/transport/telegram-transport.interface.js';

describe('TelegramUpdateProcessorService', () => {
  it('logs only non-identifying update metadata for duplicates', async () => {
    const setUpdateHandler = vi.fn();
    const claim = vi.fn().mockResolvedValue(false);
    const route = vi.fn();
    const debug = vi.fn();
    const processor = new TelegramUpdateProcessorService(
      { setUpdateHandler } as unknown as TelegramTransport,
      { claim } as unknown as TelegramUpdateClaimService,
      { route } as unknown as TelegramUpdateRouterService,
      new CorrelationContext(),
      { debug } as unknown as StructuredLogger,
    );
    const update = {
      update_id: 91,
      message: {
        message_id: 92,
        date: 1_700_000_000,
        chat: { id: 93, type: 'private', first_name: 'Private' },
        from: { id: 94, is_bot: false, first_name: 'Private' },
        text: 'private message text',
      },
    } as TelegramUpdate;

    await expect(processor.process(update)).resolves.toBe('duplicate');

    expect(debug).toHaveBeenCalledWith('Duplicate Telegram update ignored', {
      updateId: 91,
      updateType: 'message',
    });
    expect(JSON.stringify(debug.mock.calls)).not.toMatch(/private|92|93|94/i);
    expect(route).not.toHaveBeenCalled();
  });
});
