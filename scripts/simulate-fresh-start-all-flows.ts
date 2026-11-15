import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  InteractionKind,
  InteractionState,
  TransactionType,
  TransactionSource,
  FinancialEventKind,
  Prisma,
} from '../apps/backend/src/generated/prisma/client.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });

async function main() {
  console.log('======================================================');
  console.log('🧹 1. FRESH START: CLEANING DATABASE DATA');
  console.log('======================================================');

  const user = await prisma.user.findFirst({
    where: {
      telegramId: BigInt(8102690249),
    },
  });

  if (!user) {
    console.error('❌ User @Gamer121212 not found. Please message the bot first.');
    process.exit(1);
  }

  console.log(`👤 Active User: ${user.id} (@Gamer121212, telegramId: ${user.telegramId})\n`);

  // Delete transactions, groups, pending interactions, events for clean slate
  const deletedPending = await prisma.pendingInteraction.deleteMany({
    where: { userId: user.id },
  });
  console.log(`   🗑️ Cleared ${deletedPending.count} pending interactions`);

  const deletedTx = await prisma.transaction.deleteMany({
    where: { userId: user.id },
  });
  console.log(`   🗑️ Cleared ${deletedTx.count} transactions`);

  const deletedGroups = await prisma.transactionGroup.deleteMany({
    where: { userId: user.id },
  });
  console.log(`   🗑️ Cleared ${deletedGroups.count} transaction groups`);

  const deletedEvents = await prisma.event.deleteMany({
    where: { userId: user.id },
  });
  console.log(`   🗑️ Cleared ${deletedEvents.count} analytics events\n`);

  console.log('======================================================');
  console.log('🌱 2. SEEDING REALISTIC SMS & TRANSACTION FLOWS');
  console.log('======================================================\n');

  const now = new Date();

  // --- 1. DIRECTLY CATEGORIZED HISTORICAL TRANSACTIONS (Visible in History) ---
  console.log('📦 A. Auto-Categorized Transactions (Directly in History):');

  // Salary Income
  const salaryGroup = await prisma.transactionGroup.create({
    data: {
      userId: user.id,
      telegramUpdateId: 0n,
      telegramMessageId: BigInt(Date.now() * 1000 + 1),
      source: TransactionSource.TEXT,
      messageAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      rawTranscript: 'SMS:CBE:tx_sal_001',
      extractionModel: 'BANK_SMS_PARSER',
      promptVersion: '1.0',
      transactions: {
        create: [
          {
            userId: user.id,
            type: TransactionType.INCOME,
            kind: FinancialEventKind.INCOME,
            amountEtb: new Prisma.Decimal('25000.00'),
            category: 'salary',
            note: 'Monthly salary credited to A/C **4589',
            occurredAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  });
  console.log('   ✅ [CBE] INCOME ETB 25,000.00 (Salary) -> Saved to Transaction History');

  // Electricity Utilities Bill
  const utilityGroup = await prisma.transactionGroup.create({
    data: {
      userId: user.id,
      telegramUpdateId: 0n,
      telegramMessageId: BigInt(Date.now() * 1000 + 2),
      source: TransactionSource.TEXT,
      messageAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      rawTranscript: 'SMS:Telebirr:tx_util_002',
      extractionModel: 'BANK_SMS_PARSER',
      promptVersion: '1.0',
      transactions: {
        create: [
          {
            userId: user.id,
            type: TransactionType.EXPENSE,
            kind: FinancialEventKind.EXPENSE,
            amountEtb: new Prisma.Decimal('380.50'),
            category: 'utilities',
            note: 'Paid EEU Electric Bill via Telebirr',
            occurredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  });
  console.log('   ✅ [Telebirr] EXPENSE ETB 380.50 (Utilities) -> Saved to Transaction History\n');

  // --- 2. UNREVIEWED SMS DRAFTS (Held in Drafts Inbox & Smart Match) ---
  console.log('📥 B. Unreviewed SMS Drafts (In Drafts Inbox & Ready for Smart Match):');

  // Draft 1: 430.00 ETB Telebirr (Single Match Test)
  await prisma.pendingInteraction.create({
    data: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
      sourceUpdateId: 88801n,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      payload: {
        kind: 'clarify_financial',
        sourceUpdateId: 88801,
        sourceMessageId: 88801,
        messageAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        model: 'BANK_SMS_PARSER',
        promptVersion: '1.0',
        source: 'text',
        rawSms: 'You have paid ETB 430.00 to Merchant 0912345678 on 2026-08-31',
        bankSource: 'Telebirr',
        amount: 430,
        type: 'expense',
        category: 'uncategorized',
        note: 'Payment to 0912345678 via Telebirr',
        clarificationCount: 1,
        ignoredTransferCount: 0,
        event: {
          amount: '430.00',
          currency: 'ETB',
          note: 'Payment to 0912345678 via Telebirr',
          confidence: 0.9,
          clarificationReason: 'purpose',
        },
        readyTransactions: [
          {
            kind: 'expense',
            direction: 'outflow',
            type: 'expense',
            amount: '430.00',
            currency: 'ETB',
            category: 'uncategorized',
            note: 'Payment to 0912345678 via Telebirr',
            confidence: 0.9,
          },
        ],
      },
    },
  });
  console.log('   🟡 Draft 1: [Telebirr] 430.00 ETB (Single Match: text "430 burger")');

  // Draft 2: 250.00 ETB CBE (Multi-Match Test)
  await prisma.pendingInteraction.create({
    data: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
      sourceUpdateId: 88802n,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      payload: {
        kind: 'clarify_financial',
        sourceUpdateId: 88802,
        sourceMessageId: 88802,
        messageAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago (Morning)
        model: 'BANK_SMS_PARSER',
        promptVersion: '1.0',
        source: 'text',
        rawSms: 'Debit Alert: ETB 250.00 debited from A/C **4589 for POS purchase',
        bankSource: 'CBE',
        amount: 250,
        type: 'expense',
        category: 'uncategorized',
        note: 'CBE POS debit',
        clarificationCount: 1,
        ignoredTransferCount: 0,
        event: {
          amount: '250.00',
          currency: 'ETB',
          note: 'CBE POS debit',
          confidence: 0.9,
          clarificationReason: 'purpose',
        },
        readyTransactions: [
          {
            kind: 'expense',
            direction: 'outflow',
            type: 'expense',
            amount: '250.00',
            currency: 'ETB',
            category: 'uncategorized',
            note: 'CBE POS debit',
            confidence: 0.9,
          },
        ],
      },
    },
  });
  console.log('   🟡 Draft 2: [CBE] 250.00 ETB (Morning draft for Multi Match)');

  // Draft 3: 250.00 ETB Telebirr (Multi-Match Test)
  await prisma.pendingInteraction.create({
    data: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
      sourceUpdateId: 88803n,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      payload: {
        kind: 'clarify_financial',
        sourceUpdateId: 88803,
        sourceMessageId: 88803,
        messageAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago (Afternoon)
        model: 'BANK_SMS_PARSER',
        promptVersion: '1.0',
        source: 'text',
        rawSms: 'You transferred ETB 250.00 to Merchant on 2026-08-31',
        bankSource: 'Telebirr',
        amount: 250,
        type: 'expense',
        category: 'uncategorized',
        note: 'Telebirr QR payment',
        clarificationCount: 1,
        ignoredTransferCount: 0,
        event: {
          amount: '250.00',
          currency: 'ETB',
          note: 'Telebirr QR payment',
          confidence: 0.9,
          clarificationReason: 'purpose',
        },
        readyTransactions: [
          {
            kind: 'expense',
            direction: 'outflow',
            type: 'expense',
            amount: '250.00',
            currency: 'ETB',
            category: 'uncategorized',
            note: 'Telebirr QR payment',
            confidence: 0.9,
          },
        ],
      },
    },
  });
  console.log(
    '   🟡 Draft 3: [Telebirr] 250.00 ETB (Afternoon draft for Multi Match: text "250 lunch")',
  );

  // Draft 4: 1,850.00 ETB Abyssinia (Unreviewed Draft)
  await prisma.pendingInteraction.create({
    data: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
      sourceUpdateId: 88804n,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      payload: {
        kind: 'clarify_financial',
        sourceUpdateId: 88804,
        sourceMessageId: 88804,
        messageAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        model: 'BANK_SMS_PARSER',
        promptVersion: '1.0',
        source: 'text',
        rawSms: 'BOA Alert: ETB 1,850.00 debited for digital transfer',
        bankSource: 'Abyssinia',
        amount: 1850,
        type: 'expense',
        category: 'uncategorized',
        note: 'BOA Mobile transfer',
        clarificationCount: 1,
        ignoredTransferCount: 0,
        event: {
          amount: '1850.00',
          currency: 'ETB',
          note: 'BOA Mobile transfer',
          confidence: 0.9,
          clarificationReason: 'purpose',
        },
        readyTransactions: [
          {
            kind: 'expense',
            direction: 'outflow',
            type: 'expense',
            amount: '1850.00',
            currency: 'ETB',
            category: 'uncategorized',
            note: 'BOA Mobile transfer',
            confidence: 0.9,
          },
        ],
      },
    },
  });
  console.log('   🟡 Draft 4: [Abyssinia] 1,850.00 ETB (Single Match: text "1850 shoes")');

  console.log('\n======================================================');
  console.log('🎉 FRESH DATABASE INITIALIZATION COMPLETED!');
  console.log('======================================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
