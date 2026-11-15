import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { CorrelationContext } from '../src/observability/correlation-context.service.js';
import { StructuredLogger } from '../src/observability/structured-logger.service.js';

describe('StructuredLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits correlated JSON and redacts metadata', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const config = {
      get: vi.fn().mockReturnValue('debug'),
    } as unknown as ConfigService<Environment, true>;
    const context = new CorrelationContext();
    const logger = new StructuredLogger(context, config);

    context.run('correlation-123456', () => {
      logger.log('Processing token=private', {
        source: 'voice',
        authorization: 'Bearer secret',
        rawTranscript: 'private message',
      });
    });

    expect(output).toHaveBeenCalledOnce();
    const record = JSON.parse(output.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(record.correlationId).toBe('correlation-123456');
    expect(record.source).toBe('voice');
    expect(record.authorization).toBe('[REDACTED]');
    expect(record.rawTranscript).toBe('[REDACTED]');
    expect(record.message).not.toContain('private');
  });
});
