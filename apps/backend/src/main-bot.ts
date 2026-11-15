import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { StructuredLogger } from './observability/structured-logger.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from './telegram/transport/telegram-transport.interface.js';

process.env.APP_ROLE = 'bot';

async function bootstrap(): Promise<void> {
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const logger = app.get(StructuredLogger);
  app.useLogger(logger);
  const transport = app.get<TelegramTransport>(TELEGRAM_TRANSPORT);

  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    logger.log('Stopping Telegram bot', { signal });
    await transport.stop();
    await app.close();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await transport.start();
  } catch (error) {
    logger.error('Telegram bot failed to start', {
      exceptionType: error instanceof Error ? error.name : typeof error,
      reason: error instanceof Error ? error.message : 'Unknown startup error',
    });
    await app.close();
    process.exitCode = 1;
  }
}

void bootstrap();
