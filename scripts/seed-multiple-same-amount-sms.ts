import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  InteractionKind,
  InteractionState,
} from '../apps/backend/src/generated/prisma/client.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      telegramId: BigInt(8102690249),
    },
  });

  if (!user) {
    console.error('❌ User @Gamer121212 not found.');
    process.exit(1);
  }

  console.log(`👤 Found user: ${user.id} (@Gamer121212)`);

  const now = new Date();
  const t1 = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
  const t2 = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const t3 = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago

  const candidates = [
    {
      bank: 'Telebirr',
      amount: '500.00',
      time: t1,
      rawSms: 'You have transferred ETB 500.00 to Merchant 0911223344 on 2026-08-31',
    },
    {
      bank: 'CBE',
      amount: '500.00',
      time: t2,
      rawSms: 'Debit Alert: ETB 500.00 debited from A/C **4589 for POS purchase',
    },
    {
      bank: 'Abyssinia',
      amount: '500.00',
      time: t3,
      rawSms: 'BOA Alert: ETB 500.00 debited for digital payment',
    },
  ];

  for (const c of candidates) {
    await prisma.pendingInteraction.create({
      data: {
        userId: user.id,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
        sourceUpdateId: 99999,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        payload: {
          kind: 'clarify_financial',
          sourceUpdateId: 99999,
          sourceMessageId: 99999,
          messageAt: c.time.toISOString(),
          model: 'rule_based',
          promptVersion: '1.0',
          source: 'text',
          rawSms: c.rawSms,
          bankSource: c.bank,
          clarificationCount: 1,
          ignoredTransferCount: 0,
          event: {
            amount: c.amount,
            currency: 'ETB',
            note: `${c.bank} payment`,
            confidence: 0.9,
            clarificationReason: 'purpose',
          },
          readyTransactions: [
            {
              kind: 'expense',
              direction: 'outflow',
              type: 'expense',
              amount: c.amount,
              currency: 'ETB',
              category: 'uncategorized',
              note: `${c.bank} payment`,
              confidence: 0.9,
            },
          ],
        },
      },
    });
    console.log(`   ➕ Created 500.00 ETB unreviewed SMS draft for [${c.bank}]`);
  }

  console.log(
    '\n✅ Successfully seeded 3 unreviewed 500.00 ETB transactions (Telebirr, CBE, Abyssinia)!',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
