import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { StructuredLogger } from './observability/structured-logger.service.js';

process.env.APP_ROLE = 'worker';

async function bootstrap(): Promise<void> {
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(StructuredLogger);
  app.useLogger(logger);

  app.enableShutdownHooks();
  logger.log('Muday worker started', { context: 'Bootstrap' });
}

void bootstrap();
