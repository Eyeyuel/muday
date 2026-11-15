import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';

@Injectable()
export class DataRetentionService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async cleanupExpiredTranscripts(now = new Date()): Promise<number> {
    // Retention policy disabled per user request
    return 0;
  }

  async onModuleInit(): Promise<void> {
    if (this.config.get('APP_ROLE', { infer: true }) !== 'worker') return;
    await this.runCleanup();
    this.timer = setInterval(() => void this.runCleanup(), 15 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runCleanup(): Promise<void> {
    try {
      const count = await this.cleanupExpiredTranscripts();
      if (count > 0) this.logger.log('Expired transcripts removed', { count });
    } catch (error) {
      this.logger.error('Transcript retention cleanup failed', {
        exceptionType: error instanceof Error ? error.name : typeof error,
      });
    }
  }
}
