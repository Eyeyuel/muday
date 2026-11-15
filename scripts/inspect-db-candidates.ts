import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/backend/src/generated/prisma/client.js';
import { DashboardRepository } from '../apps/backend/src/dashboard/dashboard.repository.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function check() {
  const user = await prisma.user.findFirst({ where: { telegramId: 8102690249n } });
  if (!user) {
    console.log('user not found');
    return;
  }

  const pis = await prisma.pendingInteraction.findMany({
    where: { userId: user.id, state: 'PENDING' },
  });
  console.log('PENDING INTERACTIONS IN DB:', pis.length);
  for (const p of pis) {
    console.log(' - ID:', p.id, 'KIND:', p.kind, 'EXPIRES:', p.expiresAt);
  }

  const txs = await prisma.transaction.findMany({
    where: { userId: user.id, category: 'uncategorized' },
  });
  console.log('\nUNCATEGORIZED TRANSACTIONS IN DB:', txs.length);
  for (const t of txs) {
    console.log(' - TX ID:', t.id, 'AMOUNT:', t.amountEtb.toString(), 'CAT:', t.category);
  }

  const repo = new DashboardRepository(prisma as any);
  const candidates = await repo.findMatchCandidates(user.id, {
    amountEtb: '500.00',
    type: 'expense',
  });
  console.log('\nCANDIDATES FOUND BY REPO FOR 500 ETB:', candidates.length);
  for (const c of candidates) {
    console.log(' -> Candidate:', c.id, c.bankSource, c.amountEtb, c.targetType);
  }
}

check().finally(() => prisma.$disconnect());
