import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/backend/src/generated/prisma/client.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });

async function resetDb() {
  console.log('\n======================================================');
  console.log('🧹 CLEARING LOCAL DATABASE');
  console.log('======================================================\n');

  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';
  `;

  for (const { tablename } of tablenames) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    console.log(`✓ Truncated table: ${tablename}`);
  }

  console.log('\n✨ Database is completely clean and reset!\n');
}

resetDb()
  .catch((e) => {
    console.error('Error resetting database:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
