import { randomUUID } from 'node:crypto';

import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { CorrelationContext } from './correlation-context.service.js';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
const validCorrelationId = /^[a-zA-Z0-9._:-]{8,128}$/;

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(
    @Inject(CorrelationContext) private readonly correlationContext: CorrelationContext,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const provided = request.header(CORRELATION_ID_HEADER);
    const correlationId = provided && validCorrelationId.test(provided) ? provided : randomUUID();

    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    this.correlationContext.run(correlationId, next);
  }
}
