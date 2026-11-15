import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import { CorrelationContext } from '../observability/correlation-context.service.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import { TelegramUpdateClaimService } from './telegram-update-claim.service.js';
import { TelegramUpdateRouterService } from './telegram-update-router.service.js';
import { getSafeUpdateMetadata, type TelegramUpdate } from './telegram.types.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from './transport/telegram-transport.interface.js';

export type UpdateProcessResult = 'processed' | 'duplicate';

@Injectable()
export class TelegramUpdateProcessorService implements OnModuleInit {
  constructor(
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(TelegramUpdateClaimService) private readonly claims: TelegramUpdateClaimService,
    @Inject(TelegramUpdateRouterService) private readonly router: TelegramUpdateRouterService,
    @Inject(CorrelationContext) private readonly correlationContext: CorrelationContext,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  onModuleInit(): void {
    this.transport.setUpdateHandler((update) => this.process(update).then(() => undefined));
  }

  async process(update: TelegramUpdate): Promise<UpdateProcessResult> {
    const metadata = getSafeUpdateMetadata(update);
    return this.correlationContext.run(`telegram-update-${metadata.updateId}`, async () => {
      const claimed = await this.claims.claim(metadata);
      if (!claimed) {
        this.logger.debug('Duplicate Telegram update ignored', {
          updateId: metadata.updateId,
          updateType: metadata.updateType,
        });
        return 'duplicate';
      }

      try {
        const finalizedInTransaction = await this.router.route(update);
        if (!finalizedInTransaction) await this.claims.complete(metadata.updateId);
        this.logger.debug('Telegram update completed', {
          updateId: metadata.updateId,
          updateType: metadata.updateType,
        });
        return 'processed';
      } catch (error) {
        await this.claims.fail(metadata.updateId).catch(() => undefined);
        this.logger.error('Telegram update failed', {
          updateId: metadata.updateId,
          updateType: metadata.updateType,
          exceptionType: error instanceof Error ? error.name : typeof error,
        });
        throw error;
      }
    });
  }
}
