import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '../src/common/errors/error-code.js';
import type { Environment } from '../src/config/environment.js';
import type { TelegramUpdateProcessorService } from '../src/telegram/telegram-update-processor.service.js';
import { TelegramWebhookController } from '../src/telegram/telegram-webhook.controller.js';

describe('TelegramWebhookController', () => {
  const secret = 'test_webhook_secret_123';
  const config = { get: vi.fn().mockReturnValue(secret) } as unknown as ConfigService<
    Environment,
    true
  >;

  it('rejects an invalid secret before processing the body', async () => {
    const process = vi.fn();
    const processor = { process } as unknown as TelegramUpdateProcessorService;
    const controller = new TelegramWebhookController(config, processor);

    await expect(controller.receive('wrong-secret', { update_id: 1 })).rejects.toMatchObject({
      code: ErrorCode.TELEGRAM_AUTH_FAILED,
    });
    expect(process).not.toHaveBeenCalled();
  });

  it('accepts a valid update and reports processor status', async () => {
    const process = vi.fn().mockResolvedValue('processed');
    const controller = new TelegramWebhookController(config, {
      process,
    } as unknown as TelegramUpdateProcessorService);

    await expect(controller.receive(secret, { update_id: 1 })).resolves.toEqual({
      ok: true,
      status: 'processed',
    });
    expect(process).toHaveBeenCalledOnce();
  });
});
