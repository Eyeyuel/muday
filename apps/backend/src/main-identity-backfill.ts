import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { IdentityBackfillCommandModule } from './identity/identity-backfill-command.module.js';
import { TelegramIdentityBackfillService } from './identity/telegram-identity-backfill.service.js';

process.env.APP_ROLE = 'api';

function argumentsFromCommandLine(): { dryRun: boolean; batchSize?: number } {
  const argumentsList = process.argv.slice(2);
  const apply = argumentsList.includes('--apply');
  if (apply && argumentsList.includes('--dry-run')) {
    throw new Error('Use either --dry-run or --apply, not both');
  }
  const batchArgument = argumentsList.find((argument) => argument.startsWith('--batch-size='));
  const batchSize = batchArgument ? Number(batchArgument.slice('--batch-size='.length)) : undefined;
  return { dryRun: !apply, ...(batchSize === undefined ? {} : { batchSize }) };
}

async function run(): Promise<void> {
  const options = argumentsFromCommandLine();
  const app = await NestFactory.createApplicationContext(IdentityBackfillCommandModule, {
    logger: false,
  });
  try {
    const result = await app.get(TelegramIdentityBackfillService).run(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.conflicts.length > 0) process.exitCode = 2;
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Identity backfill failed'}\n`);
  process.exitCode = 1;
});
