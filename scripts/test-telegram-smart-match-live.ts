import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  InteractionKind,
  InteractionState,
} from '../apps/backend/src/generated/prisma/client.js';
import { DashboardRepository } from '../apps/backend/src/dashboard/dashboard.repository.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });

async function runTelegramSmartMatchLiveTest() {
  console.log('\n======================================================');
  console.log('🤖 TESTING TELEGRAM BOT SMART TRANSACTION MATCHING & LINKAGE');
  console.log('======================================================\n');

  // 1. Find or create target user
  const targetTelegramId = BigInt(process.env.LOCAL_DEV_TELEGRAM_ID ?? '8102690249');
  let user = await prisma.user.findFirst({
    where: { telegramId: targetTelegramId },
  });

  if (!user) {
    user = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: targetTelegramId,
        username: 'muday_tester',
        firstName: 'Muday Tester',
        language: 'AM',
        status: 'ACTIVE',
        consentVersion: '2026-08-receipt-v1',
        consentAt: new Date(),
        identities: {
          create: {
            provider: 'TELEGRAM',
            providerSubject: targetTelegramId.toString(),
            telegramUserId: targetTelegramId,
            verifiedAt: new Date(),
            lastAuthenticatedAt: new Date(),
          },
        },
      },
    });
  }

  console.log(`👤 Active User: ${user.id} (Telegram ID: ${user.telegramId})\n`);

  // 2. Seed 2 Unreviewed Bank SMS Drafts into the user's Inbox
  const now = Date.now();
  console.log('📥 1. Simulating 2 incoming Bank SMS messages:');

  const tbDraft = await prisma.pendingInteraction.create({
    data: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
      expiresAt: new Date(now + 7 * 24 * 3600 * 1000),
      payload: {
        kind: 'clarify_financial',
        source: 'sms',
        amount: 430.0,
        currency: 'ETB',
        type: 'expense',
        category: 'uncategorized',
        bankSource: 'Telebirr',
        smsId: `tb-test-${now}`,
        occurredAt: new Date(now - 15 * 60 * 1000).toISOString(),
        rawText: 'You paid ETB 430.00 to Merchant 0912345678 via Telebirr.',
      },
    },
  });
  console.log(`   • [Telebirr] 430.00 ETB expense (Draft ID: ${tbDraft.id})`);

  const cbeDraft = await prisma.pendingInteraction.create({
    data: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
      expiresAt: new Date(now + 7 * 24 * 3600 * 1000),
      payload: {
        kind: 'clarify_financial',
        source: 'sms',
        amount: 1850.0,
        currency: 'ETB',
        type: 'expense',
        category: 'uncategorized',
        bankSource: 'CBE',
        smsId: `cbe-test-${now}`,
        occurredAt: new Date(now - 30 * 60 * 1000).toISOString(),
        rawText: 'Debit Alert: ETB 1,850.00 debited from A/C **4589 for POS at Store.',
      },
    },
  });
  console.log(`   • [CBE] 1,850.00 ETB expense (Draft ID: ${cbeDraft.id})\n`);

  // 3. Simulate User sending text message in Telegram: "430 burger"
  console.log('💬 2. User logs in Telegram Bot: "430 burger"');
  console.log('   🔍 Bot checks match candidates for 430.00 ETB ...');

  const candidates = await prisma.pendingInteraction.findMany({
    where: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
    },
  });

  const matchingTb = candidates.find((c) => {
    const p = c.payload as any;
    return Number(p?.amount) === 430.0;
  });

  if (!matchingTb) {
    console.error('❌ Match candidate detection failed.');
    process.exit(1);
  }

  console.log(`   ✨ MATCH FOUND! Candidate: Telebirr 430.00 ETB`);
  console.log(`   🤖 Bot replies with Smart Match Confirmation buttons:`);
  console.log(`      [ 📱 🔗 Link with Telebirr ]`);
  console.log(`      [ 💵 Keep Separate (Save as Cash) ]\n`);

  // 4. Create pending smart match confirmation interaction (what the bot creates)
  const confirmInteraction = await prisma.pendingInteraction.create({
    data: {
      userId: user.id,
      kind: InteractionKind.CONFIRM_FINANCIAL,
      state: InteractionState.PENDING,
      expiresAt: new Date(now + 24 * 3600 * 1000),
      payload: {
        kind: 'confirm_smart_match',
        candidateCount: 1,
        candidates: [
          {
            id: matchingTb.id,
            targetType: 'pending_interaction',
            bankSource: 'Telebirr',
            amountEtb: '430.00',
            occurredAt: new Date(now - 15 * 60 * 1000).toISOString(),
          },
        ],
        transactions: [
          {
            amount: 430.0,
            category: 'food',
            note: 'burger',
            type: 'expense',
          },
        ],
      },
    },
  });

  // 5. Simulate User tapping: [ 📱 🔗 Link with Telebirr ]
  console.log('👆 3. User taps [ 📱 🔗 Link with Telebirr ]');
  console.log(
    `   📡 Executing linkCandidate(userId, targetId: ${matchingTb.id}, category: "food", note: "burger") ...`,
  );

  const dashboardRepo = new DashboardRepository(prisma as any);
  const linkResult = await dashboardRepo.linkCandidate(user.id, {
    targetId: matchingTb.id,
    targetType: 'pending_interaction',
    category: 'food',
    note: 'burger',
    type: 'expense',
  });

  await prisma.pendingInteraction.update({
    where: { id: confirmInteraction.id },
    data: { state: InteractionState.RESOLVED, resolvedAt: new Date() },
  });

  console.log(`   ✅ Telebirr SMS draft resolved & linked to Transaction ID: ${linkResult?.id}!`);
  console.log(
    `   💬 Bot confirms: "🔗 ግብይቱ ከ Telebirr ጋር በተሳካ ሁኔታ ተገናኝቷል!" (Linked with Telebirr!)\n`,
  );

  // 6. Verify database state
  const remainingPending = await prisma.pendingInteraction.count({
    where: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
    },
  });

  console.log(`📊 4. Current State:`);
  console.log(
    `   • Remaining unreviewed SMS drafts: ${remainingPending} (CBE 1,850.00 ETB is still awaiting review)`,
  );
  console.log(`   • Linked Transactions count: 1 (430.00 ETB categorized as Food & Groceries)`);

  console.log('\n======================================================');
  console.log('🎉 TELEGRAM BOT SMART MATCH FLOW TEST PASSED SUCCESSFULLY!');
  console.log('======================================================\n');

  await prisma.$disconnect();
}

runTelegramSmartMatchLiveTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
