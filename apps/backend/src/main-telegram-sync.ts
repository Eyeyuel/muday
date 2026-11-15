import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { StructuredLogger } from './observability/structured-logger.service.js';
import { TelegramProfileSyncService } from './telegram/transport/telegram-profile-sync.service.js';

process.env.APP_ROLE = 'telegram-sync';

async function bootstrap(): Promise<void> {
  const { TelegramSyncModule } = await import('./telegram/telegram-sync.module.js');
  const app = await NestFactory.createApplicationContext(TelegramSyncModule, { bufferLogs: true });
  const logger = app.get(StructuredLogger);
  app.useLogger(logger);

  try {
    const profileSync = app.get(TelegramProfileSyncService);
    await profileSync.sync({ strict: true, requirePublicMiniAppUrl: true });
    logger.log('Telegram deployment synchronization succeeded', { context: 'Bootstrap' });
  } catch (error) {
    logger.error('Telegram deployment synchronization failed', {
      context: 'Bootstrap',
      exceptionType: error instanceof Error ? error.name : typeof error,
      reason: error instanceof Error ? error.message : 'Unknown synchronization error',
    });
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
