import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AnalyticsReportCommandModule } from './analytics/analytics-report-command.module.js';
import { AnalyticsReportService } from './analytics/analytics-report.service.js';

process.env.APP_ROLE = 'api';

function asOfArgument(): Date {
  const argument = process.argv.slice(2).find((value) => value.startsWith('--as-of='));
  if (!argument) return new Date();
  const value = argument.slice('--as-of='.length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use --as-of=YYYY-MM-DD');
  const parsed = new Date(`${value}T23:59:59.999+03:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Use a valid --as-of=YYYY-MM-DD');
  return parsed;
}

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AnalyticsReportCommandModule, {
    logger: false,
  });
  try {
    const report = await app.get(AnalyticsReportService).generate(asOfArgument());
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Analytics report failed'}\n`);
  process.exitCode = 1;
});
