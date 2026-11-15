import { Global, Module } from '@nestjs/common';

import { CorrelationContext } from './correlation-context.service.js';
import { CorrelationMiddleware } from './correlation.middleware.js';
import { StructuredLogger } from './structured-logger.service.js';

@Global()
@Module({
  providers: [CorrelationContext, CorrelationMiddleware, StructuredLogger],
  exports: [CorrelationContext, CorrelationMiddleware, StructuredLogger],
})
export class ObservabilityModule {}
