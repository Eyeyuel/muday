import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication, path: string): void {
  const configuration = new DocumentBuilder()
    .setTitle('Muday API')
    .setDescription(
      'Local-first backend API for the Muday Telegram voice expense tracker. ' +
        'Telegram bot handlers are delivered through a webhook/long-polling adapter; ' +
        'the REST API primarily serves the Mini App and operational endpoints.',
    )
    .setVersion('0.1.0')
    .addTag('Health', 'Application and dependency health checks')
    .addTag('Telegram', 'Telegram webhook and bot update operations')
    .addTag('Dashboard', 'Authenticated Telegram Mini App endpoints')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Telegram-Bot-Api-Secret-Token',
        description: 'Telegram webhook secret configured with setWebhook',
      },
      'telegram-webhook-secret',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'Telegram Mini App authorization: tma <raw Telegram.WebApp.initData>',
      },
      'telegram-miniapp',
    )
    .build();

  const document = SwaggerModule.createDocument(app, configuration, {
    autoTagControllers: false,
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });

  SwaggerModule.setup(path, app, document, {
    customSiteTitle: 'Muday API Documentation',
    jsonDocumentUrl: `${path}/openapi.json`,
    yamlDocumentUrl: `${path}/openapi.yaml`,
    swaggerOptions: {
      displayRequestDuration: true,
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  });
}
