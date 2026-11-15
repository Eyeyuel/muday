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

async function seedLargeDataset() {
  console.log('\n======================================================');
  console.log('🚀 SEEDING RICH MULTI-TIMELINE DATASET (50+ TRANSACTIONS)');
  console.log('======================================================\n');

  let user = await prisma.user.findFirst({
    where: { status: 'ACTIVE' },
  });

  if (!user) {
    console.error('❌ No active user found. Please /start the bot first.');
    process.exit(1);
  }

  console.log(`👤 Active User: ${user.id} (@${user.username || user.firstName || 'user'})\n`);

  // Clear existing items for a clean demo
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.transactionGroup.deleteMany({ where: { userId: user.id } });
  await prisma.pendingInteraction.deleteMany({ where: { userId: user.id } });

  const now = new Date();
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const dataset = [
    // ── 1. TODAY (Sept 1, 2026) — 8 Transactions ──
    {
      platform: 'telebirr',
      amount: 120.0,
      type: TransactionType.EXPENSE,
      category: 'food_groceries',
      note: 'Morning Macchiato & Croissant at Tomoca',
      occurredAt: new Date(now.getTime() - 1 * HOUR_MS),
    },
    {
      platform: 'cash',
      amount: 80.0,
      type: TransactionType.EXPENSE,
      category: 'transport',
      note: 'Minibus taxi from Megenagna to Bole',
      occurredAt: new Date(now.getTime() - 2 * HOUR_MS),
    },
    {
      platform: 'cbe',
      amount: 35000.0,
      type: TransactionType.INCOME,
      category: 'salary',
      note: 'September Salary from FinTech Ltd',
      occurredAt: new Date(now.getTime() - 3 * HOUR_MS),
    },
    {
      platform: 'telebirr',
      amount: 300.0,
      type: TransactionType.EXPENSE,
      category: 'telecom',
      note: 'Ethio Telecom 30GB Monthly Package',
      occurredAt: new Date(now.getTime() - 4 * HOUR_MS),
    },
    {
      platform: 'boa',
      amount: 450.0,
      type: TransactionType.EXPENSE,
      category: 'food_groceries',
      note: 'Lunch at Kuriftu with colleagues',
      occurredAt: new Date(now.getTime() - 5 * HOUR_MS),
    },
    {
      platform: 'awash',
      amount: 2800.0,
      type: TransactionType.INCOME,
      category: 'freelance',
      note: 'Logo design payment from client',
      occurredAt: new Date(now.getTime() - 6 * HOUR_MS),
    },
    {
      platform: 'cash',
      amount: 250.0,
      type: TransactionType.EXPENSE,
      category: 'health',
      note: 'Paracetamol & Vitamins at Lion Pharmacy',
      occurredAt: new Date(now.getTime() - 7 * HOUR_MS),
    },
    {
      platform: 'dashen',
      amount: 1500.0,
      type: TransactionType.EXPENSE,
      category: 'shopping_clothing',
      note: 'New dress shirt at Edna Mall',
      occurredAt: new Date(now.getTime() - 8 * HOUR_MS),
    },

    // ── 2. YESTERDAY (Monday Aug 31 — This Week) — 8 Transactions ──
    {
      platform: 'cbe',
      amount: 3200.0,
      type: TransactionType.EXPENSE,
      category: 'food_groceries',
      note: 'Weekly Grocery shopping at Fresh Corner',
      occurredAt: new Date(now.getTime() - 24 * HOUR_MS),
    },
    {
      platform: 'boa',
      amount: 1100.0,
      type: TransactionType.EXPENSE,
      category: 'utilities',
      note: 'Electric power & water utility bills',
      occurredAt: new Date(now.getTime() - 26 * HOUR_MS),
    },
    {
      platform: 'telebirr',
      amount: 600.0,
      type: TransactionType.EXPENSE,
      category: 'transport',
      note: 'Ride taxi to airport',
      occurredAt: new Date(now.getTime() - 28 * HOUR_MS),
    },
    {
      platform: 'telebirr',
      amount: 7500.0,
      type: TransactionType.INCOME,
      category: 'freelance',
      note: 'Mobile App consulting deposit',
      occurredAt: new Date(now.getTime() - 30 * HOUR_MS),
    },
    {
      platform: 'awash',
      amount: 850.0,
      type: TransactionType.EXPENSE,
      category: 'food_groceries',
      note: 'Dinner with family at Castelli',
      occurredAt: new Date(now.getTime() - 32 * HOUR_MS),
    },
    {
      platform: 'cash',
      amount: 150.0,
      type: TransactionType.EXPENSE,
      category: 'entertainment',
      note: 'Cinema ticket at Century Cinema',
      occurredAt: new Date(now.getTime() - 34 * HOUR_MS),
    },
    {
      platform: 'dashen',
      amount: 2200.0,
      type: TransactionType.EXPENSE,
      category: 'health',
      note: 'Dental checkup at Samaritan Clinic',
      occurredAt: new Date(now.getTime() - 36 * HOUR_MS),
    },
    {
      platform: 'cbe',
      amount: 12000.0,
      type: TransactionType.INCOME,
      category: 'business',
      note: 'Wholesale coffee beans sale',
      occurredAt: new Date(now.getTime() - 38 * HOUR_MS),
    },

    // ── 3. PAST WEEK (Aug 25 - Aug 30) — 14 Transactions ──
    {
      platform: 'cbe',
      amount: 12000.0,
      type: TransactionType.EXPENSE,
      category: 'housing_rent',
      note: 'Monthly Apartment Rent payment',
      occurredAt: new Date(now.getTime() - 3 * DAY_MS),
    },
    {
      platform: 'telebirr',
      amount: 450.0,
      type: TransactionType.EXPENSE,
      category: 'food_groceries',
      note: 'Burgers & Fries at Sishu',
      occurredAt: new Date(now.getTime() - 3 * DAY_MS - 2 * HOUR_MS),
    },
    {
      platform: 'boa',
      amount: 3400.0,
      type: TransactionType.EXPENSE,
      category: 'shopping_clothing',
      note: 'Running shoes at Nike store',
      occurredAt: new Date(now.getTime() - 4 * DAY_MS),
    },
    {
      platform: 'awash',
      amount: 5000.0,
      type: TransactionType.INCOME,
      category: 'gift_received',
      note: 'Birthday gift transfer from Uncle',
      occurredAt: new Date(now.getTime() - 4 * DAY_MS - 4 * HOUR_MS),
    },
    {
      platform: 'cash',
      amount: 400.0,
      type: TransactionType.EXPENSE,
      category: 'transport',
      note: 'Feres Taxi rides across city',
      occurredAt: new Date(now.getTime() - 5 * DAY_MS),
    },
    {
      platform: 'dashen',
      amount: 1800.0,
      type: TransactionType.EXPENSE,
      category: 'education',
      note: 'Udemy Web Development Course',
      occurredAt: new Date(now.getTime() - 5 * DAY_MS - 6 * HOUR_MS),
    },
    {
      platform: 'cbe',
      amount: 950.0,
      type: TransactionType.EXPENSE,
      category: 'utilities',
      note: 'Internet Fibre Subscription (Ethio Telecom)',
      occurredAt: new Date(now.getTime() - 6 * DAY_MS),
    },
    {
      platform: 'telebirr',
      amount: 2500.0,
      type: TransactionType.INCOME,
      category: 'freelance',
      note: 'Article writing milestone',
      occurredAt: new Date(now.getTime() - 6 * DAY_MS - 3 * HOUR_MS),
    },
    {
      platform: 'boa',
      amount: 720.0,
      type: TransactionType.EXPENSE,
      category: 'food_groceries',
      note: 'Lunch buffet at Jupiter Hotel',
      occurredAt: new Date(now.getTime() - 7 * DAY_MS),
    },
    {
      platform: 'cash',
      amount: 300.0,
      type: TransactionType.EXPENSE,
      category: 'food_groceries',
      note: 'Fresh fruits and vegetables market',
      occurredAt: new Date(now.getTime() - 7 * DAY_MS - 5 * HOUR_MS),
    },

    // ── 4. AUGUST & JULY (All-Time History) — 16 Transactions ──
    {
      platform: 'cbe',
      amount: 25000.0,
      type: TransactionType.INCOME,
      category: 'salary',
      note: 'August Salary deposit',
      occurredAt: new Date(now.getTime() - 12 * DAY_MS),
    },
    {
      platform: 'cbe',
      amount: 12000.0,
      type: TransactionType.EXPENSE,
      category: 'housing_rent',
      note: 'August Rent Payment',
      occurredAt: new Date(now.getTime() - 14 * DAY_MS),
    },
    {
      platform: 'boa',
      amount: 6500.0,
      type: TransactionType.EXPENSE,
      category: 'shopping_clothing',
      note: 'Office desk & ergonomic chair',
      occurredAt: new Date(now.getTime() - 18 * DAY_MS),
    },
    {
      platform: 'telebirr',
      amount: 18000.0,
      type: TransactionType.INCOME,
      category: 'business',
      note: 'Consulting contract completion',
      occurredAt: new Date(now.getTime() - 20 * DAY_MS),
    },
    {
      platform: 'awash',
      amount: 4300.0,
      type: TransactionType.EXPENSE,
      category: 'education',
      note: 'English proficiency test fee',
      occurredAt: new Date(now.getTime() - 25 * DAY_MS),
    },
    {
      platform: 'dashen',
      amount: 12500.0,
      type: TransactionType.EXPENSE,
      category: 'shopping_clothing',
      note: 'New smartphone purchase',
      occurredAt: new Date(now.getTime() - 30 * DAY_MS),
    },
    {
      platform: 'telebirr',
      amount: 850.0,
      type: TransactionType.EXPENSE,
      category: 'food_groceries',
      note: 'Weekend barbecue at Habesha 2000',
      occurredAt: new Date(now.getTime() - 35 * DAY_MS),
    },
    {
      platform: 'cbe',
      amount: 45000.0,
      type: TransactionType.INCOME,
      category: 'business',
      note: 'Sold used car to buyer',
      occurredAt: new Date(now.getTime() - 45 * DAY_MS),
    },
    {
      platform: 'boa',
      amount: 5000.0,
      type: TransactionType.EXPENSE,
      category: 'health',
      note: 'Comprehensive medical checkup',
      occurredAt: new Date(now.getTime() - 50 * DAY_MS),
    },
    {
      platform: 'cash',
      amount: 1200.0,
      type: TransactionType.EXPENSE,
      category: 'transport',
      note: 'Long distance bus to Hawassa',
      occurredAt: new Date(now.getTime() - 55 * DAY_MS),
    },
    {
      platform: 'telebirr',
      amount: 3200.0,
      type: TransactionType.EXPENSE,
      category: 'entertainment',
      note: 'Resort stay in Hawassa',
      occurredAt: new Date(now.getTime() - 56 * DAY_MS),
    },
  ];

  let seq = Date.now();
  for (const item of dataset) {
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

  // ── 5. PENDING / UNREVIEWED DRAFTS (5 Items) ──
  const pendingItems = [
    {
      bank: 'Telebirr',
      platform: 'telebirr',
      amount: 540.0,
      type: 'expense',
      note: 'Payment to Merchant 0922334455 via Telebirr',
      occurredAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 mins ago
    },
    {
      bank: 'CBE',
      platform: 'cbe',
      amount: 1850.0,
      type: 'expense',
      note: 'POS Terminal Payment at Bole Medhanialem #108',
      occurredAt: new Date(now.getTime() - 2 * HOUR_MS),
    },
    {
      bank: 'Abyssinia',
      platform: 'boa',
      amount: 4200.0,
      type: 'income',
      note: 'Direct Mobile Deposit from Almaz T.',
      occurredAt: new Date(now.getTime() - 5 * HOUR_MS),
    },
    {
      bank: 'Awash',
      platform: 'awash',
      amount: 980.0,
      type: 'expense',
      note: 'Mobile transfer to Ephrem B.',
      occurredAt: new Date(now.getTime() - 25 * HOUR_MS),
    },
    {
      bank: 'Dashen',
      platform: 'dashen',
      amount: 670.0,
      type: 'expense',
      note: 'Amole QR scan payment at Piassa',
      occurredAt: new Date(now.getTime() - 28 * HOUR_MS),
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

  console.log(`✅ Successfully seeded:`);
  console.log(`   • ${dataset.length} Confirmed Transactions`);
  console.log(`   • ${pendingItems.length} Pending Review SMS Drafts`);
  console.log(`   • Total Items: ${dataset.length + pendingItems.length}`);
  console.log('\n======================================================\n');
}

seedLargeDataset()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
