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

async function seedUncategorizedTransactions() {
  console.log('\n======================================================');
  console.log('🌱 SEEDING 5 UNCATEGORIZED / UNORGANIZED TRANSACTIONS');
  console.log('======================================================\n');

  const targetTelegramId = BigInt(process.env.LOCAL_DEV_TELEGRAM_ID ?? '8102690249');
  let user = await prisma.user.findFirst({
    where: { telegramId: targetTelegramId },
  });

  if (!user) {
    user = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
  }

  if (!user) {
    console.error('No active user found in database.');
    process.exit(1);
  }

  console.log(`👤 Target User: ${user.id} (@${user.username || 'user'})\n`);

  const now = Date.now();
  const unorganizedItems = [
    {
      bank: 'Telebirr',
      amount: 680.0,
      type: TransactionType.EXPENSE,
      kind: FinancialEventKind.EXPENSE,
      note: 'Payment to Merchant 0911223344 via Telebirr',
      occurredAt: new Date(now - 1 * 3600 * 1000), // 1 hour ago (Today)
      transcript: 'SMS:Telebirr:tx-unorg-01',
    },
    {
      bank: 'CBE',
      amount: 1450.0,
      type: TransactionType.EXPENSE,
      kind: FinancialEventKind.EXPENSE,
      note: 'CBE POS Payment at Bole Store #42',
      occurredAt: new Date(now - 3 * 3600 * 1000), // 3 hours ago (Today)
      transcript: 'SMS:CBE:tx-unorg-02',
    },
    {
      bank: 'Abyssinia',
      amount: 2500.0,
      type: TransactionType.INCOME,
      kind: FinancialEventKind.INCOME,
      note: 'Direct Mobile Deposit from Abebe K.',
      occurredAt: new Date(now - 24 * 3600 * 1000), // Yesterday
      transcript: 'SMS:Abyssinia:tx-unorg-03',
    },
    {
      bank: 'Awash',
      amount: 920.0,
      type: TransactionType.EXPENSE,
      kind: FinancialEventKind.EXPENSE,
      note: 'Awash Mobile transfer to Meron T.',
      occurredAt: new Date(now - 2 * 24 * 3600 * 1000), // 2 days ago
      transcript: 'SMS:Awash:tx-unorg-04',
    },
    {
      bank: 'Dashen',
      amount: 350.0,
      type: TransactionType.EXPENSE,
      kind: FinancialEventKind.EXPENSE,
      note: 'Amole QR scan payment at Megenagna',
      occurredAt: new Date(now - 3 * 24 * 3600 * 1000), // 3 days ago
      transcript: 'SMS:Dashen:tx-unorg-05',
    },
  ];

  for (let i = 0; i < unorganizedItems.length; i++) {
    const item = unorganizedItems[i];
    const telegramMessageId = BigInt(Date.now() * 1000 + i * 10 + Math.floor(Math.random() * 9));

    // 1. Create in Transaction Ledger as uncategorized
    const group = await prisma.transactionGroup.create({
      data: {
        userId: user.id,
        telegramUpdateId: telegramMessageId,
        telegramMessageId,
        source: TransactionSource.TEXT,
        messageAt: item.occurredAt,
        rawTranscript: item.transcript,
        extractionModel: 'BANK_SMS_PARSER',
        promptVersion: '1.0',
        transactions: {
          create: [
            {
              userId: user.id,
              type: item.type,
              kind: item.kind,
              amountEtb: new Prisma.Decimal(item.amount.toFixed(2)),
              category: 'uncategorized',
              note: item.note,
              platform: item.bank.toLowerCase() === 'abyssinia' ? 'boa' : item.bank.toLowerCase(),
              occurredAt: item.occurredAt,
            },
          ],
        },
      },
      include: { transactions: true },
    });

    // 2. Also create in PendingInteraction (Inbox review)
    await prisma.pendingInteraction.create({
      data: {
        userId: user.id,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        payload: {
          amount: item.amount,
          type: item.type === TransactionType.INCOME ? 'income' : 'expense',
          category: 'uncategorized',
          note: item.note,
          bankSource: item.bank,
          platform: item.bank.toLowerCase() === 'abyssinia' ? 'boa' : item.bank.toLowerCase(),
          occurredAt: item.occurredAt.toISOString(),
          smsId: item.transcript,
        },
      },
    });

    console.log(
      `   ✅ Added [${item.type}] ETB ${item.amount.toFixed(2)} (${item.bank}) — "${item.note}" (Category: uncategorized)`,
    );
  }

  const totalUncategorized = await prisma.transaction.count({
    where: { userId: user.id, category: 'uncategorized' },
  });

  const totalPendingInbox = await prisma.pendingInteraction.count({
    where: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
    },
  });

  console.log(`\n📊 Current Uncategorized in Ledger: ${totalUncategorized}`);
  console.log(`📥 Current Pending Review Drafts:   ${totalPendingInbox}`);
  console.log('\n======================================================');
  console.log('✨ 5 UNORGANIZED TRANSACTIONS SUCCESSFULLY SEEDED!');
  console.log('======================================================\n');

  await prisma.$disconnect();
}

seedUncategorizedTransactions().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
