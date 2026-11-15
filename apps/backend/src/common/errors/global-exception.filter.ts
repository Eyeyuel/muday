import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Inject,
  type LoggerService,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { CorrelationContext } from '../../observability/correlation-context.service.js';
import { StructuredLogger } from '../../observability/structured-logger.service.js';
import type { HttpErrorResponse } from './http-error-response.js';
import { mapException } from './exception-mapper.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(CorrelationContext) private readonly correlationContext: CorrelationContext,
    @Inject(StructuredLogger) private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const mapped = mapException(exception);
    const correlationId = this.correlationContext.getId();
    const path = request.path;

    this.logger.error('HTTP request failed', {
      code: mapped.code,
      statusCode: mapped.statusCode,
      method: request.method,
      path,
      unexpected: mapped.isUnexpected,
      exceptionType: exception instanceof Error ? exception.name : typeof exception,
    });

    const body: HttpErrorResponse = {
      statusCode: mapped.statusCode,
      error: {
        code: mapped.code,
        message: mapped.message,
      },
      correlationId,
      timestamp: new Date().toISOString(),
      path,
    };

    response.status(mapped.statusCode).json(body);
  }
}
