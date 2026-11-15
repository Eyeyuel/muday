import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { StructuredLogger } from '../observability/structured-logger.service.js';
import { InteractionRepository } from './interaction.repository.js';

@Injectable()
export class InteractionCleanupService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(InteractionRepository) private readonly interactions: InteractionRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.interactions.expireStale().catch((error: unknown) => {
        this.logger.error('Pending interaction cleanup failed', {
          exceptionType: error instanceof Error ? error.name : typeof error,
        });
      });
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
