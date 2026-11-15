import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { NotificationFanoutService } from './notifications/notification-fanout.service.js';
import type { NotificationKind } from './notifications/notification.types.js';

process.env.APP_ROLE = 'api';

const kindByArgument: Record<string, NotificationKind> = {
  morning: 'morning_reminder',
  night: 'night_status',
  weekly: 'weekly_summary',
  monthly: 'monthly_summary',
};

async function run(): Promise<void> {
  if ((process.env.NODE_ENV ?? 'development') !== 'development') {
    throw new Error('Manual notification triggers are development-only');
  }
  const argument = process.argv[2] ?? '';
  const kind = kindByArgument[argument];
  if (!kind) throw new Error('Use morning, night, weekly, or monthly');
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const created = await app
      .get(NotificationFanoutService)
      .trigger(kind, new Date(), undefined, `manual-${kind}-${Date.now()}`);
    process.stdout.write(`Queued ${created} ${argument} notification(s).\n`);
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Manual trigger failed'}\n`);
  process.exitCode = 1;
});
