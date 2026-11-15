import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { CorrelationContext } from '../src/observability/correlation-context.service.js';
import {
  CORRELATION_ID_HEADER,
  CorrelationMiddleware,
} from '../src/observability/correlation.middleware.js';

describe('CorrelationMiddleware', () => {
  it('keeps a valid caller correlation ID', () => {
    const context = new CorrelationContext();
    const middleware = new CorrelationMiddleware(context);
    const setHeader = vi.fn();
    const request = {
      header: vi.fn().mockReturnValue('request-12345678'),
    } as unknown as Request;
    const response = { setHeader } as unknown as Response;
    let observed = '';

    middleware.use(request, response, (() => {
      observed = context.getId();
    }) as NextFunction);

    expect(observed).toBe('request-12345678');
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'request-12345678');
  });

  it('replaces an unsafe correlation ID', () => {
    const context = new CorrelationContext();
    const middleware = new CorrelationMiddleware(context);
    const setHeader = vi.fn();
    const request = {
      header: vi.fn().mockReturnValue('bad value with spaces'),
    } as unknown as Request;
    const response = { setHeader } as unknown as Response;
    let observed = '';

    middleware.use(request, response, (() => {
      observed = context.getId();
    }) as NextFunction);

    expect(observed).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, observed);
  });
});
