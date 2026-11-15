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

async function runLiveTest() {
  console.log('\n======================================================');
  console.log('🧪 TESTING LIVE MOBILE SMART MATCH & LINKAGE ENDPOINTS');
  console.log('======================================================\n');

  // 1. Find target user
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
    console.log(`👤 Created active test user: ${user.id} (@${user.username})`);
  }

  console.log(`👤 Target User: ${user.id} (@${user.username || 'user'})`);

  // 2. Generate a pairing code for this user directly in DB
  const bcrypt = await import('bcryptjs');
  const code = 'SM9999';
  const pepper = process.env.APP_CODE_PEPPER || 'fallback_app_code_pepper_min32chars_long!';
  const hash = await bcrypt.hash(code + pepper, 12);
  const prefix = code.slice(0, 4);

  await prisma.user.update({
    where: { id: user.id },
    data: { appCodeHash: hash, appCodePrefix: prefix },
  });
  console.log(`🔑 Generated pairing code: ${code}`);

  // 3. Exchange code for JWT token via Docker API
  console.log('📡 Calling POST http://localhost:3001/api/v1/auth/code ...');
  const authRes = await fetch('http://localhost:3001/api/v1/auth/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!authRes.ok) {
    console.error(`❌ Auth failed: ${authRes.status} ${await authRes.text()}`);
    process.exit(1);
  }

  const authData = (await authRes.json()) as { accessToken: string };
  const token = authData.accessToken;
  console.log('✅ Obtained Bearer JWT token successfully!');

  // 4. Create a test pending bank SMS draft for 350.00 ETB
  const testDraft = await prisma.pendingInteraction.create({
    data: {
      userId: user.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      payload: {
        kind: 'clarify_financial',
        source: 'sms',
        amount: 350.0,
        currency: 'ETB',
        type: 'expense',
        category: 'uncategorized',
        bankSource: 'Telebirr',
        smsId: 'test-sms-live-01',
        occurredAt: new Date().toISOString(),
        rawText: 'You have paid 350.00 ETB to Restaurant via Telebirr.',
      },
    },
  });
  console.log(
    `📝 Seeded test pending SMS draft (ID: ${testDraft.id}, Amount: 350.00 ETB, Bank: Telebirr)`,
  );

  // 5. Test GET /api/v1/transactions/match-candidates
  console.log('\n📡 Testing GET /api/v1/transactions/match-candidates?amountEtb=350.00 ...');
  const matchRes = await fetch(
    'http://localhost:3001/api/v1/transactions/match-candidates?amountEtb=350.00',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!matchRes.ok) {
    console.error(`❌ match-candidates failed: ${matchRes.status} ${await matchRes.text()}`);
    process.exit(1);
  }

  const candidates = (await matchRes.json()) as any[];
  console.log(`✅ Returned ${candidates.length} candidate(s):`);
  console.log(JSON.stringify(candidates, null, 2));

  const matched = candidates.find((c) => c.id === testDraft.id);
  if (!matched) {
    console.error('❌ Expected candidate was not found in match response!');
    process.exit(1);
  }
  console.log('✅ Candidate correctly matched draft ID and amount!');

  // 6. Test POST /api/v1/transactions/link-candidate
  console.log('\n📡 Testing POST /api/v1/transactions/link-candidate ...');
  const linkRes = await fetch('http://localhost:3001/api/v1/transactions/link-candidate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetId: testDraft.id,
      targetType: 'pending_interaction',
      category: 'food_groceries',
      note: 'Dinner with friends',
      type: 'expense',
    }),
  });

  if (!linkRes.ok) {
    console.error(`❌ link-candidate failed: ${linkRes.status} ${await linkRes.text()}`);
    process.exit(1);
  }

  const linkedResult = await linkRes.json();
  console.log('✅ Candidate linked successfully:');
  console.log(JSON.stringify(linkedResult, null, 2));

  // 7. Verify draft is marked RESOLVED in database
  const updatedDraft = await prisma.pendingInteraction.findUnique({
    where: { id: testDraft.id },
  });
  console.log(`\n🔍 Draft State in DB: ${updatedDraft?.state}`);
  if (updatedDraft?.state !== InteractionState.RESOLVED) {
    console.error('❌ Draft was not marked RESOLVED!');
    process.exit(1);
  }
  console.log('✅ Draft was marked RESOLVED (cleared from unreviewed inbox)!');

  console.log('\n🎉 ALL LIVE MOBILE SMART MATCH ENDPOINTS ARE FULLY WORKING ON DOCKER LOCAL!\n');
  await prisma.$disconnect();
}

runLiveTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
