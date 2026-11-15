import { BadRequestException, type ArgumentsHost, type LoggerService } from '@nestjs/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from '../src/common/errors/global-exception.filter.js';
import { CorrelationContext } from '../src/observability/correlation-context.service.js';

describe('GlobalExceptionFilter', () => {
  it('returns the safe response contract with correlation ID', () => {
    const status = vi.fn();
    const json = vi.fn();
    status.mockReturnValue({ json });
    const response = { status } as unknown as Response;
    const request = {
      method: 'POST',
      originalUrl: '/example',
      url: '/example',
      path: '/example',
    } as Request;
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    const logger = {
      error: vi.fn(),
    } as unknown as LoggerService;
    const context = new CorrelationContext();
    const filter = new GlobalExceptionFilter(context, logger);

    context.run('filter-correlation-123', () => {
      filter.catch(new BadRequestException({ token: 'secret' }), host);
    });

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: {
          code: 'BAD_REQUEST',
          message: 'The request is invalid.',
        },
        correlationId: 'filter-correlation-123',
        path: '/example',
      }),
    );
    expect(JSON.stringify(json.mock.calls)).not.toContain('secret');
  });
});
