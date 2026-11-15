import 'reflect-metadata';

import { readFile } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';
import bcrypt from 'bcryptjs';

import { PrismaService } from './database/prisma.service.js';

process.env.APP_ROLE = 'api';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

async function run(): Promise<void> {
  const email = required('ADMIN_EMAIL').toLowerCase();
  const displayName = required('ADMIN_DISPLAY_NAME');
  const role = (process.env.ADMIN_ROLE?.trim() || 'analytics_viewer').toLowerCase();
  const passwordFile = required('ADMIN_PASSWORD_FILE');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('ADMIN_EMAIL is invalid');
  if (role !== 'analytics_viewer' && role !== 'super_admin') {
    throw new Error('ADMIN_ROLE must be analytics_viewer or super_admin');
  }

  const password = (await readFile(passwordFile, { encoding: 'utf8' })).trimEnd();
  if (password.length < 12) throw new Error('Admin password must be at least 12 characters');

  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const prisma = app.get(PrismaService);
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.adminUser.upsert({
      where: { email },
      update: { displayName, passwordHash, role, isActive: true },
      create: { email, displayName, passwordHash, role },
    });
    process.stdout.write(`Admin account created or updated for ${email}.\n`);
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Admin creation failed'}\n`);
  process.exitCode = 1;
});
