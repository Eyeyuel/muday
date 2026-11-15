import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  Language,
  UserStatus,
  TransactionSource,
  TransactionType,
  FinancialEventKind,
  InteractionKind,
  InteractionState,
  CustomerClientType,
  Prisma,
} from '../apps/backend/src/generated/prisma/client.js';

function createReceiptPngBuffer(): Buffer {
  const width = 320;
  const height = 480;
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 4;
      const isBorder = x < 4 || x > width - 5 || y < 4 || y > height - 5;
      const isHeaderLine = y >= 60 && y <= 62 && x > 20 && x < width - 20;
      const isTotalLine = y >= 380 && y <= 382 && x > 20 && x < width - 20;
      const isDash = (y === 100 || y === 320) && x > 20 && x < width - 20 && x % 10 < 6;

      if (isBorder || isHeaderLine || isTotalLine || isDash) {
        rawData[px] = 50;
        rawData[px + 1] = 50;
        rawData[px + 2] = 50;
        rawData[px + 3] = 255;
      } else {
        rawData[px] = 250;
        rawData[px + 1] = 250;
        rawData[px + 2] = 246;
        rawData[px + 3] = 255;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  function crc32(buf: Buffer): number {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    const typeAndData = Buffer.concat([typeBuf, data]);
    const crcVal = crc32(typeAndData);
    crc.writeUInt32BE(crcVal >>> 0, 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', deflated);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });

/**
 * Constructs an exact Date at a given number of days ago, at a specific hour in EAT (UTC+3).
 */
function createEatDate(daysAgo: number, eatHour: number, minute = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  // EAT is UTC+3 -> UTC hour is (eatHour - 3 + 24) % 24
  const utcHour = (eatHour - 3 + 24) % 24;
  d.setUTCHours(utcHour, minute, 0, 0);
  return d;
}

/**
 * Ensures strict compliance with PostgreSQL check constraints:
 * 1. transactions_kind_direction_check
 * 2. transactions_kind_category_check
 */
function getDirectionAndCategory(
  kind: FinancialEventKind,
  rawCategory: string,
): { type: TransactionType; category: string } {
  switch (kind) {
    case FinancialEventKind.INCOME:
      return { type: TransactionType.INCOME, category: rawCategory };
    case FinancialEventKind.LOAN_RECEIVED:
      return { type: TransactionType.INCOME, category: 'borrowed_money' };
    case FinancialEventKind.REFUND:
      return { type: TransactionType.INCOME, category: 'refund' };
    case FinancialEventKind.REIMBURSEMENT:
      return { type: TransactionType.INCOME, category: 'reimbursement' };
    case FinancialEventKind.LOAN_REPAYMENT:
      return { type: TransactionType.EXPENSE, category: 'debt_repayment' };
    case FinancialEventKind.EXPENSE:
    default: {
      let cat = rawCategory;
      if (rawCategory === 'shopping_clothing') cat = 'clothing_personal_care';
      if (rawCategory === 'uncategorized') cat = 'other';
      return { type: TransactionType.EXPENSE, category: cat };
    }
  }
}

export async function seedExecutiveDashboardMassive() {
  console.log('\n======================================================');
  console.log('🚀 SEEDING MASSIVE MULTI-USER DATASET FOR EXECUTIVE SUITE');
  console.log('======================================================\n');

  // ─────────────────────────────────────────────────────────────
  // 1. ADMIN USER INITIALIZATION
  // ─────────────────────────────────────────────────────────────
  console.log('🔐 1. Checking / Provisioning Admin Accounts...');
  const adminEmail = 'admin@muday.et';
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminPasswordHash, isActive: true, role: 'super_admin' },
    create: {
      email: adminEmail,
      displayName: 'Executive Administrator',
      passwordHash: adminPasswordHash,
      role: 'super_admin',
      isActive: true,
    },
  });
  console.log(`   ✅ Admin verified: ${adminEmail} (password: admin123)`);

  // ─────────────────────────────────────────────────────────────
  // 2. 35 COHORT USERS (Rich mix of Amharic & English, Active & Pending)
  // ─────────────────────────────────────────────────────────────
  console.log('\n👥 2. Initializing 35 Diverse Ethiopian Cohort Users...');

  const userRoster = [
    {
      telegramId: 8102690249n,
      first: 'Eyuel',
      last: 'Gamer',
      user: 'Gamer121212',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000001n,
      first: 'Abebe',
      last: 'Kebede',
      user: 'abebe_k',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000002n,
      first: 'Hiwot',
      last: 'Tadesse',
      user: 'hiwot_t',
      lang: Language.EN,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000003n,
      first: 'Yohannes',
      last: 'Getachew',
      user: 'yohannes_g',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000004n,
      first: 'Sara',
      last: 'Daniel',
      user: 'sara_d',
      lang: Language.EN,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000005n,
      first: 'Dawit',
      last: 'Alemayehu',
      user: 'dawit_a',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000006n,
      first: 'Selamawit',
      last: 'Bekele',
      user: 'selam_b',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000007n,
      first: 'Henok',
      last: 'Girma',
      user: 'henok_g',
      lang: Language.EN,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000008n,
      first: 'Bethelhem',
      last: 'Tesfaye',
      user: 'betty_t',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000009n,
      first: 'Tigist',
      last: 'Worku',
      user: 'tigi_w',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000010n,
      first: 'Ermias',
      last: 'Solomon',
      user: 'ermias_s',
      lang: Language.EN,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000011n,
      first: 'Almaz',
      last: 'Mengistu',
      user: 'almaz_m',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000012n,
      first: 'Biruk',
      last: 'Hailu',
      user: 'biruk_h',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000013n,
      first: 'Kalkidan',
      last: 'Fikru',
      user: 'kal_f',
      lang: Language.EN,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000014n,
      first: 'Natnael',
      last: 'Desta',
      user: 'nati_d',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000015n,
      first: 'Rahel',
      last: 'Berhanu',
      user: 'rahel_b',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000016n,
      first: 'Yared',
      last: 'Assefa',
      user: 'yared_a',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000017n,
      first: 'Martha',
      last: 'Kassahun',
      user: 'martha_k',
      lang: Language.EN,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000018n,
      first: 'Samson',
      last: 'Tefera',
      user: 'samson_t',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000019n,
      first: 'Meron',
      last: 'Negash',
      user: 'meron_n',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000020n,
      first: 'Tariku',
      last: 'Zeleke',
      user: 'tariku_z',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000021n,
      first: 'Genet',
      last: 'Wolde',
      user: 'genet_w',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000022n,
      first: 'Haile',
      last: 'Mehari',
      user: 'haile_m',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000023n,
      first: 'Muluken',
      last: 'Ayalew',
      user: 'mule_a',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000024n,
      first: 'Nebiyu',
      last: 'Shiferaw',
      user: 'neba_s',
      lang: Language.EN,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000025n,
      first: 'Tsion',
      last: 'Molla',
      user: 'tsion_m',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000026n,
      first: 'Binyam',
      last: 'Taye',
      user: 'binyam_t',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000027n,
      first: 'Hanan',
      last: 'Mohammed',
      user: 'hanan_m',
      lang: Language.EN,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000028n,
      first: 'Ephrem',
      last: 'Bogale',
      user: 'ephrem_b',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    {
      telegramId: 1000000029n,
      first: 'Meseret',
      last: 'Lemma',
      user: 'mesi_l',
      lang: Language.AM,
      status: UserStatus.ACTIVE,
    },
    // 5 Pending Consent users for realistic conversion funnel (30 / 35 = 85.7%)
    {
      telegramId: 1000000030n,
      first: 'Solomon',
      last: 'Wolde',
      user: 'sol_w',
      lang: Language.AM,
      status: UserStatus.PENDING_CONSENT,
    },
    {
      telegramId: 1000000031n,
      first: 'Kidist',
      last: 'Abera',
      user: 'kidi_a',
      lang: Language.AM,
      status: UserStatus.PENDING_CONSENT,
    },
    {
      telegramId: 1000000032n,
      first: 'Abinet',
      last: 'Getu',
      user: 'abinet_g',
      lang: Language.EN,
      status: UserStatus.PENDING_CONSENT,
    },
    {
      telegramId: 1000000033n,
      first: 'Lydia',
      last: 'Samuel',
      user: 'lydia_s',
      lang: Language.EN,
      status: UserStatus.PENDING_CONSENT,
    },
    {
      telegramId: 1000000034n,
      first: 'Robel',
      last: 'Kassa',
      user: 'robel_k',
      lang: Language.AM,
      status: UserStatus.PENDING_CONSENT,
    },
  ];

  const seededUsers = [];
  for (const p of userRoster) {
    const isConsent = p.status === UserStatus.ACTIVE;
    const user = await prisma.user.upsert({
      where: { telegramId: p.telegramId },
      update: {
        firstName: p.first,
        lastName: p.last,
        username: p.user,
        language: p.lang,
        status: p.status,
        consentVersion: isConsent ? '1.0' : null,
        consentAt: isConsent ? createEatDate(55, 9, 0) : null,
      },
      create: {
        telegramId: p.telegramId,
        firstName: p.first,
        lastName: p.last,
        username: p.user,
        language: p.lang,
        status: p.status,
        consentVersion: isConsent ? '1.0' : null,
        consentAt: isConsent ? createEatDate(55, 9, 0) : null,
        createdAt: createEatDate(58, 9, 0),
      },
    });
    seededUsers.push(user);
  }

  const activeUsers = seededUsers.filter((u) => u.status === UserStatus.ACTIVE);
  const userIds = seededUsers.map((u) => u.id);
  console.log(
    `   ✅ Seeded ${seededUsers.length} users (${activeUsers.length} ACTIVE, 5 PENDING_CONSENT).`,
  );

  // ─────────────────────────────────────────────────────────────
  // 3. CLEAN UP PRIOR DATA FOR SEEDED COHORT
  // ─────────────────────────────────────────────────────────────
  console.log('\n🧹 3. Purging prior transactions, interactions & sessions for cohort...');
  await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.transactionGroup.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.pendingInteraction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.event.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.customerSession.deleteMany({ where: { userId: { in: userIds } } });

  // ─────────────────────────────────────────────────────────────
  // 4. MASSIVE MOBILE COMPANION SESSIONS (18 Active Devices)
  // ─────────────────────────────────────────────────────────────
  console.log('\n📱 4. Seeding 18 Active Mobile Companion Sessions...');
  const deviceModels = [
    'Samsung Galaxy S24 Ultra',
    'iPhone 15 Pro Max',
    'Google Pixel 8 Pro',
    'iPad Pro 12.9 M2',
    'Xiaomi 14 Ultra',
    'Tecno Camon 30 Pro',
    'Samsung Galaxy A55',
    'iPhone 14 Pro',
    'Infinix Note 40 Pro',
    'iPhone 13',
    'Samsung Galaxy Z Fold 5',
    'OnePlus 12',
  ];

  const sessionData = [];
  for (let i = 0; i < 18; i++) {
    const user = activeUsers[i % activeUsers.length];
    const isIos = i % 3 === 0;
    sessionData.push({
      id: crypto.randomUUID(),
      userId: user.id,
      clientType: isIos ? CustomerClientType.FLUTTER_IOS : CustomerClientType.FLUTTER_ANDROID,
      deviceName: deviceModels[i % deviceModels.length],
      appVersion: '1.2.4',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      createdAt: createEatDate(i % 10, 10, i * 2),
    });
  }
  await prisma.customerSession.createMany({ data: sessionData });
  console.log(`   ✅ Seeded 18 active companion sessions across Android & iOS.`);

  // ─────────────────────────────────────────────────────────────
  // 5. 14 PENDING UNREVIEWED INTERACTIONS & SMS DRAFTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n📥 5. Seeding 14 Unreviewed Pending SMS Drafts...');
  const pendingSMSDefs = [
    {
      bank: 'Telebirr',
      platform: 'telebirr',
      amt: 480.0,
      type: 'expense',
      note: 'Telebirr Merchant 0911223344 payment',
    },
    {
      bank: 'CBE',
      platform: 'cbe',
      amt: 1250.0,
      type: 'expense',
      note: 'CBE POS payment at Shoa Supermarket',
    },
    {
      bank: 'Abyssinia',
      platform: 'boa',
      amt: 3500.0,
      type: 'income',
      note: 'BOA Mobile deposit from Almaz T.',
    },
    {
      bank: 'Awash',
      platform: 'awash',
      amt: 890.0,
      type: 'expense',
      note: 'Awash Mobile transfer to Ephrem B.',
    },
    {
      bank: 'Dashen',
      platform: 'dashen',
      amt: 670.0,
      type: 'expense',
      note: 'Amole QR code purchase at Edna Mall',
    },
    {
      bank: 'Telebirr',
      platform: 'telebirr',
      amt: 2100.0,
      type: 'expense',
      note: 'Telebirr utility bulk bill settlement',
    },
    {
      bank: 'CBE',
      platform: 'cbe',
      amt: 500.0,
      type: 'expense',
      note: 'CBE Debit alert for grocery order',
    },
    {
      bank: 'Telebirr',
      platform: 'telebirr',
      amt: 500.0,
      type: 'expense',
      note: 'Telebirr QR scan payment at cafe',
    },
    {
      bank: 'Abyssinia',
      platform: 'boa',
      amt: 500.0,
      type: 'expense',
      note: 'BOA digital withdrawal at ATM',
    },
    {
      bank: 'Awash',
      platform: 'awash',
      amt: 4500.0,
      type: 'income',
      note: 'Awash direct client payment credit',
    },
    {
      bank: 'Dashen',
      platform: 'dashen',
      amt: 1800.0,
      type: 'expense',
      note: 'Dashen debit for online course fee',
    },
    {
      bank: 'CBE',
      platform: 'cbe',
      amt: 8400.0,
      type: 'expense',
      note: 'CBE Birr transfer for housing service',
    },
    {
      bank: 'Telebirr',
      platform: 'telebirr',
      amt: 320.0,
      type: 'expense',
      note: 'Telebirr airtime bundle recharge',
    },
    {
      bank: 'Abyssinia',
      platform: 'boa',
      amt: 1650.0,
      type: 'expense',
      note: 'BOA POS terminal debit at pharmacy',
    },
  ];

  const pendingData = pendingSMSDefs.map((p, idx) => ({
    id: crypto.randomUUID(),
    userId: activeUsers[idx % activeUsers.length].id,
    kind: InteractionKind.CLARIFY_FINANCIAL,
    state: InteractionState.PENDING,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: createEatDate(idx % 3, 10 + (idx % 10), idx * 4),
    payload: {
      amount: p.amt,
      type: p.type,
      category: 'uncategorized',
      note: p.note,
      bankSource: p.bank,
      platform: p.platform,
      occurredAt: createEatDate(idx % 3, 10 + (idx % 10), idx * 4).toISOString(),
      smsId: `SMS:${p.bank}:${Date.now() + idx}`,
    },
  }));

  await prisma.pendingInteraction.createMany({ data: pendingData });
  console.log(`   ✅ Seeded 14 unreviewed SMS drafts.`);

  // ─────────────────────────────────────────────────────────────
  // 6. 350+ AUDIT & TELEMETRY EVENTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n📊 6. Seeding 350+ Platform Telemetry & Audit Events...');
  const eventsData = [];

  // A. User Signups & Consents
  for (let i = 0; i < seededUsers.length; i++) {
    const u = seededUsers[i];
    eventsData.push({
      id: crypto.randomUUID(),
      userId: u.id,
      eventType: 'signup',
      metadata: { source: 'telegram_bot', channel: 'direct' },
      occurredAt: createEatDate(55, 9, i),
    });
    if (u.status === UserStatus.ACTIVE) {
      eventsData.push({
        id: crypto.randomUUID(),
        userId: u.id,
        eventType: 'consent_completed',
        metadata: { consentVersion: '1.0' },
        occurredAt: createEatDate(55, 9, i + 1),
      });
    }
  }

  // B. Clarifications (45 requested, 40 resolved -> ~88.9% resolution rate)
  for (let i = 0; i < 45; i++) {
    const u = activeUsers[i % activeUsers.length];
    eventsData.push({
      id: crypto.randomUUID(),
      userId: u.id,
      eventType: 'clarification_requested',
      metadata: { reason: 'purpose', model: 'BANK_SMS_PARSER' },
      occurredAt: createEatDate(i % 14, 11, i * 2),
    });
    if (i < 40) {
      eventsData.push({
        id: crypto.randomUUID(),
        userId: u.id,
        eventType: 'clarification_resolved',
        metadata: { assignedCategory: 'food_groceries' },
        occurredAt: createEatDate(i % 14, 11, i * 2 + 1),
      });
    }
  }

  // C. Voice Processing Telemetry (75 voice completed with avg latency ~750ms)
  for (let i = 0; i < 75; i++) {
    const u = activeUsers[i % activeUsers.length];
    eventsData.push({
      id: crypto.randomUUID(),
      userId: u.id,
      eventType: 'voice_processing_completed',
      metadata: {
        sttLatencyMs: 320 + (i % 8) * 20,
        totalLatencyMs: 720 + (i % 10) * 15, // ~740-790ms
        audioDurationSec: 4.8,
        model: 'gemini-2.0-flash',
      },
      occurredAt: createEatDate(i % 14, 12 + (i % 8), i * 3),
    });
  }

  // D. Voice failures (3 failures with varied codes)
  const failCodes = ['STT_LOW_CONFIDENCE', 'AUDIO_TOO_SHORT', 'AUDIO_CLIPPED'];
  for (let i = 0; i < 3; i++) {
    eventsData.push({
      id: crypto.randomUUID(),
      userId: activeUsers[i].id,
      eventType: 'voice_processing_failed',
      metadata: { failureCode: failCodes[i] },
      occurredAt: createEatDate(3 + i, 16, 20),
    });
  }

  // E. Live Audit Trail Logged Transaction Events
  const auditTemplates = [
    {
      title: 'Telebirr Webhook Auto-Settlement Cleared',
      badge: 'Automated Match',
      type: 'transaction_logged',
    },
    {
      title: 'Amharic Voice Note Itemized via Gemini',
      badge: 'Voice NLP',
      type: 'voice_processing_completed',
    },
    { title: 'CBE Birr Statement Bulk Reconciled', badge: 'Bank Sync', type: 'transaction_logged' },
    {
      title: 'Mobile Device Pairing Companion Handshake',
      badge: 'Device Sync',
      type: 'consent_completed',
    },
    {
      title: 'English Voice Memo Synthesized',
      badge: 'Voice NLP',
      type: 'voice_processing_completed',
    },
    {
      title: 'Physical Receipt Camera OCR Extracted',
      badge: 'Receipt OCR',
      type: 'transaction_logged',
    },
    {
      title: 'Bank of Abyssinia POS Batch Synchronized',
      badge: 'Bank Sync',
      type: 'transaction_logged',
    },
    {
      title: 'Awash Bank Instant QR Transfer Verified',
      badge: 'QR Payment',
      type: 'transaction_logged',
    },
  ];

  for (let i = 0; i < auditTemplates.length; i++) {
    const t = auditTemplates[i];
    eventsData.push({
      id: crypto.randomUUID(),
      userId: activeUsers[i % activeUsers.length].id,
      eventType: t.type,
      metadata: { description: t.title, badge: t.badge },
      occurredAt: createEatDate(0, 21 - i, 15),
    });
  }

  await prisma.event.createMany({ data: eventsData });
  console.log(`   ✅ Seeded ${eventsData.length} telemetry, voice and audit events.`);

  // ─────────────────────────────────────────────────────────────
  // 7. MASSIVE FINANCIAL LEDGER (700+ TRANSACTIONS ACROSS 60 DAYS)
  // ─────────────────────────────────────────────────────────────
  console.log('\n💳 7. Generating 700+ Financial Ledger Transactions Across 60 Days...');

  const CATEGORY_BANK_CONFIGS = [
    { cat: 'food_groceries', banks: ['telebirr', 'cbe', 'boa', 'cash'], min: 80, max: 2800 },
    { cat: 'transport', banks: ['cash', 'telebirr', 'cbe'], min: 50, max: 950 },
    { cat: 'housing_rent', banks: ['cbe', 'boa'], min: 8000, max: 28000 },
    { cat: 'utilities', banks: ['telebirr', 'cbe', 'boa'], min: 250, max: 1800 },
    {
      cat: 'clothing_personal_care',
      banks: ['dashen', 'cbe', 'boa', 'telebirr'],
      min: 850,
      max: 9500,
    },
    { cat: 'health', banks: ['boa', 'cbe', 'awash'], min: 450, max: 6200 },
    { cat: 'education', banks: ['dashen', 'cbe', 'awash'], min: 1200, max: 15000 },
    { cat: 'entertainment', banks: ['telebirr', 'cash', 'dashen'], min: 200, max: 3200 },
    { cat: 'airtime_internet', banks: ['telebirr', 'cbe'], min: 100, max: 1500 },
    { cat: 'shopping_household', banks: ['dashen', 'cbe', 'boa'], min: 650, max: 12000 },
    { cat: 'other', banks: ['telebirr', 'cbe', 'cash'], min: 150, max: 800 }, // Uncategorized
  ];

  const INCOME_CONFIGS = [
    { cat: 'salary', banks: ['cbe', 'boa', 'awash'], min: 25000, max: 65000 },
    { cat: 'business', banks: ['cbe', 'telebirr', 'awash', 'dashen'], min: 8000, max: 45000 },
    { cat: 'freelance', banks: ['telebirr', 'awash', 'cbe'], min: 3500, max: 18000 },
  ];

  const groupsToInsert: Array<{
    id: string;
    userId: string;
    telegramUpdateId: bigint;
    telegramMessageId: bigint;
    source: TransactionSource;
    messageAt: Date;
    extractionModel: string;
    promptVersion: string;
    createdAt: Date;
  }> = [];

  const transactionsToInsert: Array<{
    id: string;
    userId: string;
    groupId: string;
    type: TransactionType;
    kind: FinancialEventKind;
    amountEtb: Prisma.Decimal;
    category: string;
    note: string;
    platform: string;
    occurredAt: Date;
    createdAt: Date;
  }> = [];

  let globalSeq = 100000;

  // Generate 10 to 16 transactions for EVERY SINGLE DAY of the last 60 days
  for (let daysAgo = 59; daysAgo >= 0; daysAgo--) {
    // Determine daily transaction density: higher on recent 14 days
    const txCountToday = daysAgo <= 14 ? 14 : 10;

    for (let t = 0; t < txCountToday; t++) {
      globalSeq++;
      const user = activeUsers[(daysAgo * 7 + t) % activeUsers.length];

      // Distribute hours across Ethiopian waking day (07:00 to 22:00 EAT)
      const eatHour = 7 + Math.floor((t / txCountToday) * 15);
      const minute = (t * 13) % 60;
      const occurredAt = createEatDate(daysAgo, eatHour, minute);

      // Determine modality:
      // ~60% Text, ~15% Amharic Voice, ~15% English Voice, ~10% Receipt
      let source: TransactionSource;
      if (t % 7 === 0) {
        source = TransactionSource.RECEIPT;
      } else if (t % 4 === 0) {
        source = TransactionSource.VOICE;
      } else {
        source = TransactionSource.TEXT;
      }

      // Determine financial kind:
      // ~78% Expense, ~15% Income, ~3% Loan Received, ~2% Loan Repayment, ~1% Refund, ~1% Reimbursement
      let kind: FinancialEventKind = FinancialEventKind.EXPENSE;
      let rawCat = 'food_groceries';
      let bank = 'telebirr';
      let amount = 250;

      const kindRoll = (daysAgo * 17 + t * 5) % 100;
      if (kindRoll >= 82 && kindRoll < 94) {
        // Income
        kind = FinancialEventKind.INCOME;
        const incConf = INCOME_CONFIGS[t % INCOME_CONFIGS.length];
        rawCat = incConf.cat;
        bank = incConf.banks[t % incConf.banks.length];
        amount = incConf.min + ((daysAgo * 430 + t * 950) % (incConf.max - incConf.min));
      } else if (kindRoll >= 94 && kindRoll < 96) {
        // Loan Received (ብድር)
        kind = FinancialEventKind.LOAN_RECEIVED;
        rawCat = 'borrowed_money';
        bank = 'awash';
        amount = 3000 + (t % 5) * 2000;
      } else if (kindRoll >= 96 && kindRoll < 98) {
        // Loan Repayment (የብድር ክፍያ)
        kind = FinancialEventKind.LOAN_REPAYMENT;
        rawCat = 'debt_repayment';
        bank = 'dashen';
        amount = 1000 + (t % 4) * 800;
      } else if (kindRoll === 98) {
        // Refund
        kind = FinancialEventKind.REFUND;
        rawCat = 'refund';
        bank = 'telebirr';
        amount = 450 + (t % 3) * 300;
      } else if (kindRoll === 99) {
        // Reimbursement
        kind = FinancialEventKind.REIMBURSEMENT;
        rawCat = 'reimbursement';
        bank = 'cbe';
        amount = 1200 + (t % 3) * 650;
      } else {
        // Everyday Expense
        kind = FinancialEventKind.EXPENSE;
        const expConf = CATEGORY_BANK_CONFIGS[t % CATEGORY_BANK_CONFIGS.length];
        rawCat = expConf.cat;
        bank = expConf.banks[t % expConf.banks.length];
        amount = expConf.min + ((daysAgo * 120 + t * 240) % (expConf.max - expConf.min));
      }

      // Special high-value single transactions on specific days for realistic spikes
      if (daysAgo === 0 && t === 1) {
        amount = 35000; // Salary
        kind = FinancialEventKind.INCOME;
        rawCat = 'salary';
        bank = 'cbe';
      } else if (daysAgo === 1 && t === 2) {
        amount = 18500; // Rent
        kind = FinancialEventKind.EXPENSE;
        rawCat = 'housing_rent';
        bank = 'cbe';
      } else if (daysAgo === 2 && t === 3) {
        amount = 22000; // Laptop sale
        kind = FinancialEventKind.INCOME;
        rawCat = 'business';
        bank = 'boa';
      }

      const { type, category } = getDirectionAndCategory(kind, rawCat);
      const groupId = crypto.randomUUID();
      const txId = crypto.randomUUID();

      let receiptImagePath: string | null = null;
      let rawTranscript: string | null = null;

      if (source === TransactionSource.RECEIPT) {
        const userMediaDir = path.resolve('.local/media/receipts', user.id);
        fs.mkdirSync(userMediaDir, { recursive: true });
        const receiptFilename = `${groupId}.png`;
        const destPath = path.resolve(userMediaDir, receiptFilename);
        fs.writeFileSync(destPath, createReceiptPngBuffer());
        receiptImagePath = `${user.id}/${receiptFilename}`;
        rawTranscript = `TEST SUPERMARKET\nReceipt #ET-${(globalSeq % 9000) + 1000}\nTotal: ${amount.toFixed(2)} ETB\nPayment Platform: ${bank.toUpperCase()}\nItems: ${category.replace(/_/g, ' ')}\nThank you for your business!`;
      } else if (source === TransactionSource.VOICE) {
        rawTranscript =
          user.language === Language.EN
            ? `I paid ${amount.toFixed(2)} birr for ${category.replace(/_/g, ' ')} using ${bank}`
            : `በ ${bank} ${amount.toFixed(2)} ብር ለ ${category.replace(/_/g, ' ')} ከፍያለሁ`;
      } else {
        rawTranscript = `Debited: ETB ${amount.toFixed(2)} from A/C ... to Merchant. Ref: TXN${globalSeq}`;
      }

      groupsToInsert.push({
        id: groupId,
        userId: user.id,
        telegramUpdateId: BigInt(globalSeq),
        telegramMessageId: BigInt(globalSeq),
        source,
        messageAt: occurredAt,
        rawTranscript,
        receiptImagePath,
        extractionModel: 'gemini-2.0-flash',
        promptVersion: 'v1.0.0',
        createdAt: occurredAt,
      });

      transactionsToInsert.push({
        id: txId,
        userId: user.id,
        groupId,
        type,
        kind,
        amountEtb: new Prisma.Decimal(amount.toFixed(2)),
        category,
        note: `Verified ${category.replace(/_/g, ' ')} via ${bank.toUpperCase()}`,
        platform: bank,
        occurredAt,
        createdAt: occurredAt,
      });
    }
  }

  // Fast Batch Insert
  console.log(`   ⚡ Inserting ${groupsToInsert.length} transaction groups...`);
  await prisma.transactionGroup.createMany({ data: groupsToInsert });

  console.log(`   ⚡ Inserting ${transactionsToInsert.length} financial transactions...`);
  await prisma.transaction.createMany({ data: transactionsToInsert });

  console.log(
    `   ✅ Successfully seeded ${transactionsToInsert.length} transactions across 60 days!`,
  );

  // ─────────────────────────────────────────────────────────────
  // 8. FINAL SUMMARY & VERIFICATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n======================================================');
  console.log('🎉 MASSIVE EXECUTIVE DASHBOARD SEEDING COMPLETE!');
  console.log('======================================================');
  console.log(
    `👥 Cohort Users:             ${seededUsers.length} (${activeUsers.length} Active, 5 Pending)`,
  );
  console.log(`📱 Active Companion Devices:  ${sessionData.length} paired`);
  console.log(`📥 Pending Clarifications:    ${pendingData.length} drafts`);
  console.log(
    `📊 Audit Telemetry Events:    ${eventsData.length} events (75 voice, 45 clarifications)`,
  );
  console.log(
    `💳 Confirmed Transactions:    ${transactionsToInsert.length} records across 60 days`,
  );
  console.log(`🏦 Banking Rails Active:      Telebirr, CBE, Abyssinia, Awash, Dashen, Cash`);
  console.log(`🔑 Admin Login Available:     admin@muday.et / admin123`);
  console.log('======================================================\n');
}

if (process.argv[1]?.includes('seed-executive-dashboard')) {
  seedExecutiveDashboardMassive()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
