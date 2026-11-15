import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, type NextFunction, type Request, type Response } from 'express';

import type { Environment } from './config/environment.js';
import { setupSwagger } from './docs/swagger.js';
import { StructuredLogger } from './observability/structured-logger.service.js';

process.env.APP_ROLE = 'api';

async function bootstrap(): Promise<void> {
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.use(json({ limit: '256kb', type: 'application/json' }));
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const logger = app.get(StructuredLogger);
  const port = config.get('PORT', { infer: true });
  app.useLogger(logger);
  const isDev = config.get('NODE_ENV', { infer: true }) === 'development';
  const miniappUrl = config.get('MINIAPP_URL', { infer: true });
  const allowedOrigins: (string | RegExp)[] = [miniappUrl];
  if (isDev) {
    allowedOrigins.push(
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    );
  }

  app.enableCors({
    origin: isDev ? allowedOrigins : miniappUrl,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
  });
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (!config.get('SWAGGER_ENABLED', { infer: true })) {
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      );
    }
    if (config.get('NODE_ENV', { infer: true }) === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    setupSwagger(app, config.get('SWAGGER_PATH', { infer: true }));
  }

  const host = config.get('HOST', { infer: true });
  await app.listen(port, host);
  logger.log(`Muday API listening on http://${host}:${port}`, {
    context: 'Bootstrap',
  });
  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    logger.log(
      `Swagger UI available at http://127.0.0.1:${port}/${config.get('SWAGGER_PATH', { infer: true })}`,
      { context: 'Bootstrap' },
    );
  }
}

void bootstrap();
