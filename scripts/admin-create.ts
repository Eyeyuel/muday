import readline from 'node:readline';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { PrismaClient } from '../apps/backend/src/generated/prisma/client.js';

dotenv.config({ path: '.env' });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://mezgeb:mezgeb_local_password@localhost:5432/mezgeb?schema=public';

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('\n--- Create Muday Admin Account ---\n');
  const emailInput = await ask('Admin Email: ');
  const email = emailInput.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Invalid email address.');
    process.exit(1);
  }

  const displayNameInput = await ask('Display Name (e.g. Abebe): ');
  const displayName = displayNameInput.trim();
  if (!displayName) {
    console.error('Display Name is required.');
    process.exit(1);
  }

  const roleInput = (await ask('Role (analytics_viewer/super_admin) [analytics_viewer]: '))
    .trim()
    .toLowerCase();
  const role = roleInput || 'analytics_viewer';
  if (role !== 'analytics_viewer' && role !== 'super_admin') {
    console.error('Role must be analytics_viewer or super_admin.');
    process.exit(1);
  }

  const password = await ask('Password: ');
  if (!password || password.length < 6) {
    console.error('Password must be at least 6 characters long.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      await prisma.adminUser.update({
        where: { email },
        data: { displayName, passwordHash, role, isActive: true },
      });
      console.log(`\n✅ Admin account for ${email} updated successfully!`);
    } else {
      await prisma.adminUser.create({
        data: {
          email,
          displayName,
          passwordHash,
          role,
        },
      });
      console.log(`\n✅ Admin account for ${email} created successfully!`);
    }
  } catch (err) {
    console.error('Failed to save admin user to database:', err);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
