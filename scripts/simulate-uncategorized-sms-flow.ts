import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  InteractionKind,
  InteractionState,
  TransactionType,
} from '../apps/backend/src/generated/prisma/client.js';
import { SmsProcessingService } from '../apps/backend/src/sms/sms-processing.service.js';
import { type SmsBatchMessageItem } from '../apps/backend/src/sms/sms-job.js';

function formatCategoryLabel(cat: string): string {
  const clean = cat.replace(/[_-]/g, ' ').trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });

const fakeLogger = {
  log: (msg: string, ctx?: any) => console.log(`   [LOG] ${msg}`, ctx ? JSON.stringify(ctx) : ''),
  error: (msg: string, ctx?: any) =>
    console.error(`   [ERR] ${msg}`, ctx ? JSON.stringify(ctx) : ''),
  warn: (msg: string, ctx?: any) =>
    console.warn(`   [WARN] ${msg}`, ctx ? JSON.stringify(ctx) : ''),
} as any;

async function runUncategorizedSmsFlow() {
  console.log('\n======================================================');
  console.log('📱 SIMULATING 5 UNCATEGORIZED SMS FROM MOBILE APP');
  console.log('======================================================\n');

  // 1. Find the target Telegram / Dev User
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

  // 2. Mobile App captures 5 raw, unorganized SMS messages (no category assigned)
  const unorganizedMobileSmsBatch: SmsBatchMessageItem[] = [
    {
      smsId: `mobile-raw-tb-101-${now}`,
      bankSource: 'Telebirr',
      amount: 430.0,
      type: 'EXPENSE',
      category: 'uncategorized', // Uncategorized from mobile
      note: 'Payment to 0912345678 via Telebirr',
      occurredAt: new Date(now - 30 * 60 * 1000).toISOString(),
      rawText: 'You have paid ETB 430.00 to Merchant 0912345678 on 2026-08-29. Ref: TB-883921',
    },
    {
      smsId: `mobile-raw-cbe-102-${now}`,
      bankSource: 'CBE',
      amount: 1850.0,
      type: 'EXPENSE',
      category: undefined, // No category
      note: 'CBE POS debit at Bole Store',
      occurredAt: new Date(now - 2 * 3600 * 1000).toISOString(),
      rawText: 'Debit Alert: ETB 1,850.00 debited from A/C **4589 for POS purchase at Store #8.',
    },
    {
      smsId: `mobile-raw-boa-103-${now}`,
      bankSource: 'Abyssinia',
      amount: 5000.0,
      type: 'INCOME',
      category: 'uncategorized',
      note: 'BOA Mobile transfer received from Meron T.',
      occurredAt: new Date(now - 4 * 3600 * 1000).toISOString(),
      rawText: 'Credit alert: ETB 5,000.00 deposited to A/C **1204 from Meron Tadesse.',
    },
    {
      smsId: `mobile-raw-awash-104-${now}`,
      bankSource: 'Awash',
      amount: 720.0,
      type: 'EXPENSE',
      category: undefined,
      note: 'Awash Mobile payment',
      occurredAt: new Date(now - 6 * 3600 * 1000).toISOString(),
      rawText: 'Payment of ETB 720.00 completed successfully via Awash mobile banking.',
    },
    {
      smsId: `mobile-raw-dashen-105-${now}`,
      bankSource: 'Dashen',
      amount: 290.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Amole merchant scan payment',
      occurredAt: new Date(now - 8 * 3600 * 1000).toISOString(),
      rawText: 'You paid ETB 290.00 to Cafe Amole Merchant.',
    },
  ];

  console.log(`📱 1. Mobile App: Sending 5 Uncategorized SMS Messages to Backend:`);
  unorganizedMobileSmsBatch.forEach((msg, idx) => {
    console.log(
      `   ${idx + 1}. [${msg.bankSource}] ${msg.type} ETB ${msg.amount} — "${msg.rawText?.slice(0, 60)}..." (Category: ${msg.category || 'NONE'})`,
    );
  });

  // 3. Process the batch through the background worker ingestion pipeline
  console.log(`\n⚙️  2. Backend Queue & Worker Processing Batch...`);
  const processingService = new SmsProcessingService(prisma as any, fakeLogger);
  const result = await processingService.processBatch({
    userId: user.id,
    messages: unorganizedMobileSmsBatch,
    enqueuedAt: new Date().toISOString(),
  });

  console.log(`   ✅ Ingestion Result:`, result);
  console.log(
    `   📥 ${result.drafts} Uncategorized Drafts successfully queued into Mobile Inbox & Pending Interactions!`,
  );

  // 4. Fetch the created pending review items
  const pendingItems = await prisma.pendingInteraction.findMany({
    where: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log(`\n🤖 3. Telegram Bot Evening Review (8:00 PM) Preview for User:`);
  console.log(`------------------------------------------------------`);
  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    const payload = item.payload as any;
    const isIncome = payload.type === 'income';

    console.log(
      `\n📩 Review Item ${i + 1}/${pendingItems.length}: [${payload.bankSource || 'Bank'}] ${isIncome ? '🟢 Income' : '🔻 Expense'} of ETB ${payload.amount}`,
    );
    console.log(`   💬 Raw Note: "${payload.note || 'Bank SMS'}"`);
    console.log(`   🔘 Interactive Telegram Buttons presented to user:`);

    if (isIncome) {
      console.log(
        `      [💼 ${formatCategoryLabel('salary')}]  [📈 ${formatCategoryLabel('business')}]  [🎁 ${formatCategoryLabel('gift')}]`,
      );
      console.log(
        `      [🌍 ${formatCategoryLabel('remittance')}]  [🏷️ ${formatCategoryLabel('other')}]  [❌ Skip]`,
      );
    } else {
      console.log(
        `      [🍔 ${formatCategoryLabel('food')}]  [🚗 ${formatCategoryLabel('transport')}]  [🛒 ${formatCategoryLabel('groceries')}]`,
      );
      console.log(
        `      [💡 ${formatCategoryLabel('utilities')}]  [🛍️ ${formatCategoryLabel('shopping')}]  [☕ ${formatCategoryLabel('cafe')}]  [❌ Skip]`,
      );
    }
  }

  console.log('\n======================================================');
  console.log('🎉 5 UNCATEGORIZED SMS PIPELINE TEST COMPLETED!');
  console.log('======================================================\n');

  await prisma.$disconnect();
}

runUncategorizedSmsFlow().catch((err) => {
  console.error('Flow test failed:', err);
  process.exit(1);
});
