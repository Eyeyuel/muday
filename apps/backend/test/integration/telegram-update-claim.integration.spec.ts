import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { TelegramUpdateClaimService } from '../../src/telegram/telegram-update-claim.service.js';

const updateId = 8_100_000_001;
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 4 }) });
const claims = new TelegramUpdateClaimService(prisma as unknown as PrismaService);

describe('TelegramUpdateClaimService integration', () => {
  beforeEach(async () => {
    await prisma.processedUpdate.deleteMany({ where: { telegramUpdateId: BigInt(updateId) } });
  });

  afterAll(async () => {
    await prisma.processedUpdate.deleteMany({ where: { telegramUpdateId: BigInt(updateId) } });
    await prisma.$disconnect();
  });

  it('allows exactly one concurrent claim for a Telegram update', async () => {
    const metadata = { updateId, updateType: 'message', chatId: 20, messageId: 30 };
    const results = await Promise.all(Array.from({ length: 6 }, () => claims.claim(metadata)));

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(
      await prisma.processedUpdate.count({ where: { telegramUpdateId: BigInt(updateId) } }),
    ).toBe(1);
  });
});
