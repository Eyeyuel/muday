import 'dotenv/config';

import { Queue } from 'bullmq';

import { validateEnvironment } from './config/environment.js';
import { bullMqConnection } from './voice/bullmq-connection.js';

async function run(): Promise<void> {
  const environment = validateEnvironment(process.env);
  const names = [
    environment.VOICE_QUEUE_NAME,
    environment.RECEIPT_QUEUE_NAME,
    environment.NOTIFICATION_QUEUE_NAME,
  ];
  const queues = names.map(
    (name) => new Queue(name, { connection: bullMqConnection(environment.REDIS_URL) }),
  );
  try {
    const reports = await Promise.all(
      queues.map(async (queue) => ({
        queue: queue.name,
        counts: await queue.getJobCounts('wait', 'active', 'delayed', 'failed', 'completed'),
      })),
    );
    process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
  } finally {
    await Promise.all(queues.map((queue) => queue.close()));
  }
}

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Queue inspection failed'}\n`);
  process.exitCode = 1;
});
