import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  InteractionKind,
  InteractionState,
  FinancialEventKind,
  TransactionType,
  TransactionSource,
  Prisma,
} from '../apps/backend/src/generated/prisma/client.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });

async function seedCleanDemo() {
  console.log('\n======================================================');
  console.log('✨ SEEDING CLEAN DEMO WITH CLEAR TIMELINES & PENDING');
  console.log('======================================================\n');

  let user = await prisma.user.findFirst({
    where: { status: 'ACTIVE' },
  });

  if (!user) {
    console.error('No active user found. Please /start the bot first.');
    process.exit(1);
  }

  console.log(`👤 Target User: ${user.id} (@${user.username || user.firstName || 'user'})`);

  // Clear existing transactions and pending interactions for this user
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.transactionGroup.deleteMany({ where: { userId: user.id } });
  await prisma.pendingInteraction.deleteMany({ where: { userId: user.id } });

  const now = new Date();
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  // 1. TODAY (3 Confirmed Transactions)
  const todayTransactions = [
    {
      platform: 'telebirr',
      amount: 350.0,
      type: TransactionType.EXPENSE,
      category: 'food_groceries',
      note: 'Lunch at Kuriftu',
      occurredAt: new Date(now.getTime() - 2 * HOUR_MS),
    },
    {
      platform: 'cash',
      amount: 120.0,
      type: TransactionType.EXPENSE,
      category: 'transport',
      note: 'Ride taxi to Bole Medhanialem',
      occurredAt: new Date(now.getTime() - 4 * HOUR_MS),
    },
    {
      platform: 'cbe',
      amount: 15000.0,
      type: TransactionType.INCOME,
      category: 'salary',
      note: 'Monthly salary deposit from Tech Corp',
      occurredAt: new Date(now.getTime() - 6 * HOUR_MS),
    },
  ];

  // 2. YESTERDAY (Monday Aug 31 - part of This Week, but previous Month) (3 Confirmed Transactions)
  const yesterdayTransactions = [
    {
      platform: 'cbe',
      amount: 1850.0,
      type: TransactionType.EXPENSE,
      category: 'food_groceries',
      note: 'Groceries at Fresh Corner',
      occurredAt: new Date(now.getTime() - 24 * HOUR_MS),
    },
    {
      platform: 'boa',
      amount: 750.0,
      type: TransactionType.EXPENSE,
      category: 'utilities',
      note: 'Electricity and water utility bill',
      occurredAt: new Date(now.getTime() - 26 * HOUR_MS),
    },
    {
      platform: 'telebirr',
      amount: 4500.0,
      type: TransactionType.INCOME,
      category: 'freelance',
      note: 'Freelance web design payment',
      occurredAt: new Date(now.getTime() - 28 * HOUR_MS),
    },
  ];

  // 3. OLDER IN AUGUST (All Time) (3 Confirmed Transactions)
  const olderTransactions = [
    {
      platform: 'cbe',
      amount: 8000.0,
      type: TransactionType.EXPENSE,
      category: 'housing_rent',
      note: 'Apartment monthly rent',
      occurredAt: new Date(now.getTime() - 15 * DAY_MS),
    },
    {
      platform: 'dashen',
      amount: 2300.0,
      type: TransactionType.EXPENSE,
      category: 'shopping_clothing',
      note: 'New shoes at Edna Mall',
      occurredAt: new Date(now.getTime() - 20 * DAY_MS),
    },
    {
      platform: 'cbe',
      amount: 18000.0,
      type: TransactionType.INCOME,
      category: 'business',
      note: 'Sold old laptop to friend',
      occurredAt: new Date(now.getTime() - 40 * DAY_MS),
    },
  ];

  const allConfirmed = [...todayTransactions, ...yesterdayTransactions, ...olderTransactions];

  let seq = Date.now();
  for (const item of allConfirmed) {
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

  // 4. PENDING UNREVIEWED SMS DRAFTS (3 Pending Interactions)
  const pendingItems = [
    {
      bank: 'Telebirr',
      platform: 'telebirr',
      amount: 680.0,
      type: 'expense',
      note: 'Payment to Merchant 0911223344 via Telebirr',
      occurredAt: new Date(now.getTime() - 1 * HOUR_MS), // Today
    },
    {
      bank: 'CBE',
      platform: 'cbe',
      amount: 1450.0,
      type: 'expense',
      note: 'CBE POS Payment at Bole Store #42',
      occurredAt: new Date(now.getTime() - 3 * HOUR_MS), // Today
    },
    {
      bank: 'Abyssinia',
      platform: 'boa',
      amount: 2500.0,
      type: 'income',
      note: 'Direct Mobile Deposit from Abebe K.',
      occurredAt: new Date(now.getTime() - 25 * HOUR_MS), // Yesterday
    },
  ];

  for (const p of pendingItems) {
    await prisma.pendingInteraction.create({
      data: {
        userId: user.id,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        payload: {
          amount: p.amount,
          type: p.type,
          category: 'uncategorized',
          note: p.note,
          bankSource: p.bank,
          platform: p.platform,
          occurredAt: p.occurredAt.toISOString(),
          smsId: `SMS:${p.bank}:${Date.now()}`,
        },
      },
    });
  }

  console.log(`✅ Seeded:`);
  console.log(`   - 9 Confirmed Transactions (3 Today, 3 Yesterday Monday, 3 in August)`);
  console.log(`   - 3 Pending SMS Drafts (2 Today, 1 Yesterday)`);
  console.log('\n======================================================\n');
}

seedCleanDemo()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
