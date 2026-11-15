import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  FinancialEventKind,
  TransactionType,
  TransactionSource,
  Prisma,
} from '../apps/backend/src/generated/prisma/client.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });

export async function seedTimelineTransactions() {
  console.log('\n======================================================');
  console.log('🌱 SEEDING MULTI-TIMELINE TRANSACTIONS');
  console.log('======================================================\n');

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
  });

  if (users.length === 0) {
    console.log('❌ No active registered users found yet.');
    console.log(
      '👉 Please open Telegram, send /start to your bot, choose language & agree to consent.',
    );
    return false;
  }

  const now = new Date();
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const user of users) {
    console.log(`👤 Found active user: ${user.id} (@${user.username || user.firstName || 'user'})`);

    const timelineItems = [
      // ── 1. TODAY (Daily - 3 transactions) ──
      {
        platform: 'telebirr',
        amount: 350.0,
        type: TransactionType.EXPENSE,
        kind: FinancialEventKind.EXPENSE,
        category: 'food_groceries',
        note: 'Lunch at Kuriftu',
        occurredAt: new Date(now.getTime() - 2 * HOUR_MS),
      },
      {
        platform: 'cash',
        amount: 120.0,
        type: TransactionType.EXPENSE,
        kind: FinancialEventKind.EXPENSE,
        category: 'transport',
        note: 'Ride taxi to Bole Medhanialem',
        occurredAt: new Date(now.getTime() - 4 * HOUR_MS),
      },
      {
        platform: 'cbe',
        amount: 15000.0,
        type: TransactionType.INCOME,
        kind: FinancialEventKind.INCOME,
        category: 'salary',
        note: 'Monthly salary deposit from Tech Corp',
        occurredAt: new Date(now.getTime() - 6 * HOUR_MS),
      },

      // ── 2. YESTERDAY (Aug 31 - This Week - 3 transactions) ──
      {
        platform: 'cbe',
        amount: 1850.0,
        type: TransactionType.EXPENSE,
        kind: FinancialEventKind.EXPENSE,
        category: 'food_groceries',
        note: 'Groceries at Fresh Corner',
        occurredAt: new Date(now.getTime() - 24 * HOUR_MS),
      },
      {
        platform: 'boa',
        amount: 750.0,
        type: TransactionType.EXPENSE,
        kind: FinancialEventKind.EXPENSE,
        category: 'utilities',
        note: 'Electricity and water utility bill',
        occurredAt: new Date(now.getTime() - 26 * HOUR_MS),
      },
      {
        platform: 'telebirr',
        amount: 4500.0,
        type: TransactionType.INCOME,
        kind: FinancialEventKind.INCOME,
        category: 'freelance',
        note: 'Freelance web design payment',
        occurredAt: new Date(now.getTime() - 28 * HOUR_MS),
      },

      // ── 3. PREVIOUS MONTH (August - All Time - 4 transactions) ──
      {
        platform: 'awash',
        amount: 420.0,
        type: TransactionType.EXPENSE,
        kind: FinancialEventKind.EXPENSE,
        category: 'health',
        note: 'Prescription medication at Lion Pharmacy',
        occurredAt: new Date(now.getTime() - 10 * DAY_MS),
      },
      {
        platform: 'cbe',
        amount: 8000.0,
        type: TransactionType.EXPENSE,
        kind: FinancialEventKind.EXPENSE,
        category: 'housing_rent',
        note: 'Apartment monthly rent',
        occurredAt: new Date(now.getTime() - 15 * DAY_MS),
      },
      {
        platform: 'dashen',
        amount: 2300.0,
        type: TransactionType.EXPENSE,
        kind: FinancialEventKind.EXPENSE,
        category: 'shopping_clothing',
        note: 'New shoes at Edna Mall',
        occurredAt: new Date(now.getTime() - 20 * DAY_MS),
      },
      {
        platform: 'cbe',
        amount: 18000.0,
        type: TransactionType.INCOME,
        kind: FinancialEventKind.INCOME,
        category: 'business',
        note: 'Sold old laptop to friend',
        occurredAt: new Date(now.getTime() - 40 * DAY_MS),
      },
    ];

    let seq = Date.now();
    for (const item of timelineItems) {
      seq++;
      const group = await prisma.transactionGroup.create({
        data: {
          userId: user.id,
          source: TransactionSource.TEXT,
          telegramUpdateId: BigInt(seq),
          telegramMessageId: BigInt(seq),
          messageAt: item.occurredAt,
          extractionModel: 'gemini-2.0-flash',
          promptVersion: 'v1.0.0',
          createdAt: item.occurredAt,
        },
      });

      await prisma.transaction.create({
        data: {
          userId: user.id,
          groupId: group.id,
          kind:
            item.type === TransactionType.INCOME
              ? FinancialEventKind.INCOME
              : FinancialEventKind.EXPENSE,
          type: item.type,
          amountEtb: new Prisma.Decimal(item.amount.toFixed(2)),
          category: item.category,
          note: item.note,
          platform: item.platform,
          occurredAt: item.occurredAt,
          createdAt: item.occurredAt,
        },
      });
    }

    console.log(`✅ Seeded ${timelineItems.length} transactions for user ${user.id}.`);
  }

  return true;
}

if (process.argv[1]?.includes('seed-timeline-transactions')) {
  seedTimelineTransactions()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
