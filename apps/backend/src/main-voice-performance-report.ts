import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AnalyticsReportCommandModule } from './analytics/analytics-report-command.module.js';
import { VoicePerformanceReportService } from './analytics/voice-performance-report.service.js';

process.env.APP_ROLE = 'api';

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AnalyticsReportCommandModule, {
    logger: false,
  });
  try {
    const report = await app.get(VoicePerformanceReportService).generate();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Voice performance report failed'}\n`,
  );
  process.exitCode = 1;
});
