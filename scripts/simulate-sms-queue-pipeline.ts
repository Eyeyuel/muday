import { Queue, Worker } from 'bullmq';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  InteractionKind,
  InteractionState,
} from '../apps/backend/src/generated/prisma/client.js';
import { bullMqConnection } from '../apps/backend/src/voice/bullmq-connection.js';
import { SmsProcessingService } from '../apps/backend/src/sms/sms-processing.service.js';
import {
  type SmsBatchJobData,
  type SmsBatchMessageItem,
  SMS_JOB_NAME,
} from '../apps/backend/src/sms/sms-job.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const queueName = 'muday-sms-simulation';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });

const fakeLogger = {
  log: (msg: string, ctx?: any) => console.log(`   [LOG] ${msg}`, ctx ? JSON.stringify(ctx) : ''),
  error: (msg: string, ctx?: any) =>
    console.error(`   [ERR] ${msg}`, ctx ? JSON.stringify(ctx) : ''),
  warn: (msg: string, ctx?: any) =>
    console.warn(`   [WARN] ${msg}`, ctx ? JSON.stringify(ctx) : ''),
} as any;

function generateRealisticSmsDataset(): SmsBatchMessageItem[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const dataset: SmsBatchMessageItem[] = [
    // --- TODAY'S TRANSACTIONS (0 days ago) ---
    {
      smsId: `tx-telebirr-01-${now}`,
      bankSource: 'Telebirr',
      amount: 150.0,
      type: 'EXPENSE',
      category: 'food',
      note: 'Kaldi Coffee Bole',
      occurredAt: new Date(now - 2 * 3600 * 1000).toISOString(),
      rawText: 'You paid ETB 150.00 to Kaldi Coffee. Ref: TB-01928',
    },
    {
      smsId: `tx-cbe-02-${now}`,
      bankSource: 'CBE',
      amount: 2450.0,
      type: 'EXPENSE',
      category: 'groceries',
      note: 'Shoa Supermarket POS',
      occurredAt: new Date(now - 3 * 3600 * 1000).toISOString(),
      rawText: 'Debit of ETB 2,450.00 from A/C **4589 for POS at Shoa Supermarket.',
    },
    {
      smsId: `tx-telebirr-03-${now}`,
      bankSource: 'Telebirr',
      amount: 280.0,
      type: 'EXPENSE',
      category: 'transport',
      note: 'Feres Taxi Ride to Kazanchis',
      occurredAt: new Date(now - 4 * 3600 * 1000).toISOString(),
      rawText: 'Payment of ETB 280.00 to Feres Driver. Ref: FR-9812',
    },
    {
      smsId: `tx-boa-04-${now}`,
      bankSource: 'Abyssinia',
      amount: 8500.0,
      type: 'INCOME',
      category: 'uncategorized',
      note: 'Transfer received on Bank of Abyssinia',
      occurredAt: new Date(now - 5 * 3600 * 1000).toISOString(),
      rawText: 'Credit alert: ETB 8,500.00 deposited to A/C **1204 from Abebe K.',
    },
    {
      smsId: `tx-awash-05-${now}`,
      bankSource: 'Awash',
      amount: 300.0,
      type: 'EXPENSE',
      category: 'utilities',
      note: 'Water bill payment Awash Bank',
      occurredAt: new Date(now - 6 * 3600 * 1000).toISOString(),
      rawText: 'Paid ETB 300.00 for AAWSA water bill via Awash mobile.',
    },
    {
      smsId: `tx-telebirr-06-${now}`,
      bankSource: 'Telebirr',
      amount: 100.0,
      type: 'EXPENSE',
      category: 'telecom',
      note: 'Ethio Telecom Monthly Airtime',
      occurredAt: new Date(now - 7 * 3600 * 1000).toISOString(),
      rawText: 'Recharged ETB 100.00 mobile airtime.',
    },
    {
      smsId: `tx-dashen-07-${now}`,
      bankSource: 'Dashen',
      amount: 1500.0,
      type: 'EXPENSE',
      category: 'transport',
      note: 'Total Gas Station Fuel',
      occurredAt: new Date(now - 8 * 3600 * 1000).toISOString(),
      rawText: 'Amole Payment of ETB 1,500.00 at Total Energies Bole.',
    },

    // --- YESTERDAY'S TRANSACTIONS (1 day ago) ---
    {
      smsId: `tx-cbe-08-${now}`,
      bankSource: 'CBE',
      amount: 35000.0,
      type: 'INCOME',
      category: 'salary',
      note: 'Monthly Salary Credit CBE',
      occurredAt: new Date(now - 1 * dayMs).toISOString(),
      rawText: 'Salary credit of ETB 35,000.00 into A/C **4589.',
    },
    {
      smsId: `tx-cbe-09-${now}`,
      bankSource: 'CBE',
      amount: 15000.0,
      type: 'EXPENSE',
      category: 'housing',
      note: 'House Rent Transfer',
      occurredAt: new Date(now - 1 * dayMs - 2 * 3600 * 1000).toISOString(),
      rawText: 'Transfer of ETB 15,000.00 to Landlord A/C **9910.',
    },
    {
      smsId: `tx-telebirr-10-${now}`,
      bankSource: 'Telebirr',
      amount: 420.0,
      type: 'EXPENSE',
      category: 'food',
      note: 'Tomoca Coffee & Pastry',
      occurredAt: new Date(now - 1 * dayMs - 4 * 3600 * 1000).toISOString(),
      rawText: 'Paid ETB 420.00 to Tomoca Coffee Sarbet.',
    },
    {
      smsId: `tx-boa-11-${now}`,
      bankSource: 'Abyssinia',
      amount: 3800.0,
      type: 'EXPENSE',
      category: 'clothing',
      note: 'Century Mall Clothes Shopping',
      occurredAt: new Date(now - 1 * dayMs - 6 * 3600 * 1000).toISOString(),
      rawText: 'POS debit ETB 3,800.00 at Zara Boutique Century Mall.',
    },
    {
      smsId: `tx-coop-12-${now}`,
      bankSource: 'Coop',
      amount: 1100.0,
      type: 'EXPENSE',
      category: 'food',
      note: 'Coopay organic honey purchase',
      occurredAt: new Date(now - 1 * dayMs - 8 * 3600 * 1000).toISOString(),
      rawText: 'Coopay paid ETB 1,100.00 to Oromia Farmers Union.',
    },

    // --- THIS WEEK'S TRANSACTIONS (2 to 6 days ago) ---
    {
      smsId: `tx-boa-13-${now}`,
      bankSource: 'Abyssinia',
      amount: 22000.0,
      type: 'INCOME',
      category: 'freelance',
      note: 'Freelance Software Project Payment',
      occurredAt: new Date(now - 2 * dayMs).toISOString(),
      rawText: 'Inward wire transfer ETB 22,000.00 from Tech Solutions.',
    },
    {
      smsId: `tx-cbe-14-${now}`,
      bankSource: 'CBE',
      amount: 850.0,
      type: 'EXPENSE',
      category: 'health',
      note: 'Lion Pharmacy Medicine',
      occurredAt: new Date(now - 2 * dayMs - 3 * 3600 * 1000).toISOString(),
      rawText: 'Debit of ETB 850.00 at Lion Pharmacy.',
    },
    {
      smsId: `tx-telebirr-15-${now}`,
      bankSource: 'Telebirr',
      amount: 350.0,
      type: 'EXPENSE',
      category: 'transport',
      note: 'RIDE Transport from Airport',
      occurredAt: new Date(now - 3 * dayMs).toISOString(),
      rawText: 'Paid ETB 350.00 to RIDE Ethiopia.',
    },
    {
      smsId: `tx-awash-16-${now}`,
      bankSource: 'Awash',
      amount: 4100.0,
      type: 'EXPENSE',
      category: 'groceries',
      note: 'Friendship Hypermarket Shopping',
      occurredAt: new Date(now - 3 * dayMs - 4 * 3600 * 1000).toISOString(),
      rawText: 'Awash POS purchase ETB 4,100.00 at Friendship.',
    },
    {
      smsId: `tx-dashen-17-${now}`,
      bankSource: 'Dashen',
      amount: 600.0,
      type: 'EXPENSE',
      category: 'entertainment',
      note: 'Century Cinema Movie Tickets',
      occurredAt: new Date(now - 4 * dayMs).toISOString(),
      rawText: 'Amole payment ETB 600.00 to Century Cinema.',
    },
    {
      smsId: `tx-cbe-18-${now}`,
      bankSource: 'CBE',
      amount: 500.0,
      type: 'EXPENSE',
      category: 'utilities',
      note: 'EEU Prepaid Electricity Card',
      occurredAt: new Date(now - 4 * dayMs - 2 * 3600 * 1000).toISOString(),
      rawText: 'CBE Birr utility payment ETB 500.00 to EEU.',
    },
    {
      smsId: `tx-wegagen-19-${now}`,
      bankSource: 'Wegagen',
      amount: 850.0,
      type: 'EXPENSE',
      category: 'education',
      note: 'Bookstore Books & Stationary',
      occurredAt: new Date(now - 5 * dayMs).toISOString(),
      rawText: 'Wegagen debit ETB 850.00 at Mega Bookstore.',
    },
    {
      smsId: `tx-zemen-20-${now}`,
      bankSource: 'Zemen',
      amount: 9500.0,
      type: 'INCOME',
      category: 'investment_return',
      note: 'Zemen Bank Annual Dividend Payout',
      occurredAt: new Date(now - 5 * dayMs - 5 * 3600 * 1000).toISOString(),
      rawText: 'Dividend payout credit ETB 9,500.00 into Zemen account.',
    },
    {
      smsId: `tx-hibret-21-${now}`,
      bankSource: 'Hibret',
      amount: 1000.0,
      type: 'EXPENSE',
      category: 'church_charity',
      note: 'Church Monthly Tithe / Charity',
      occurredAt: new Date(now - 6 * dayMs).toISOString(),
      rawText: 'Hibret mobile donation ETB 1,000.00 to St. Michael.',
    },

    // --- REST OF THE MONTH (7 to 25 days ago) ---
    {
      smsId: `tx-cbe-22-${now}`,
      bankSource: 'CBE',
      amount: 6500.0,
      type: 'EXPENSE',
      category: 'education',
      note: 'School Tuition Fee Payment',
      occurredAt: new Date(now - 8 * dayMs).toISOString(),
      rawText: 'School tuition fee transfer ETB 6,500.00.',
    },
    {
      smsId: `tx-telebirr-23-${now}`,
      bankSource: 'Telebirr',
      amount: 1500.0,
      type: 'INCOME',
      category: 'gift_received',
      note: 'Birthday Gift from Brother',
      occurredAt: new Date(now - 9 * dayMs).toISOString(),
      rawText: 'Telebirr transfer received ETB 1,500.00 from Dawit.',
    },
    {
      smsId: `tx-awash-24-${now}`,
      bankSource: 'Awash',
      amount: 3400.0,
      type: 'EXPENSE',
      category: 'transport',
      note: 'Toyota Car Service & Oil Change',
      occurredAt: new Date(now - 11 * dayMs).toISOString(),
      rawText: 'Awash debit ETB 3,400.00 at Marathon Motors.',
    },
    {
      smsId: `tx-coop-25-${now}`,
      bankSource: 'Coop',
      amount: 28000.0,
      type: 'INCOME',
      category: 'business',
      note: 'Agricultural Products Sale Income',
      occurredAt: new Date(now - 13 * dayMs).toISOString(),
      rawText: 'Coop Bank deposit ETB 28,000.00 from Grain Market.',
    },
    {
      smsId: `tx-boa-26-${now}`,
      bankSource: 'Abyssinia',
      amount: 2200.0,
      type: 'EXPENSE',
      category: 'health',
      note: 'Dental Clinic Cleaning & Checkup',
      occurredAt: new Date(now - 15 * dayMs).toISOString(),
      rawText: 'BOA POS debit ETB 2,200.00 at Addis Dental.',
    },
    {
      smsId: `tx-dashen-27-${now}`,
      bankSource: 'Dashen',
      amount: 14000.0,
      type: 'INCOME',
      category: 'gift_received',
      note: 'Inward Remittance from USA',
      occurredAt: new Date(now - 18 * dayMs).toISOString(),
      rawText: 'Western Union / Dashen credit ETB 14,000.00 from USA.',
    },
    {
      smsId: `tx-cbe-28-${now}`,
      bankSource: 'CBE',
      amount: 1800.0,
      type: 'EXPENSE',
      category: 'telecom',
      note: 'Ethio Telecom Broadband Internet',
      occurredAt: new Date(now - 20 * dayMs).toISOString(),
      rawText: 'CBE Direct debit ETB 1,800.00 for fiber internet.',
    },
    {
      smsId: `tx-awash-29-${now}`,
      bankSource: 'Awash',
      amount: 18000.0,
      type: 'INCOME',
      category: 'business',
      note: 'Consulting Fee Client Advance',
      occurredAt: new Date(now - 22 * dayMs).toISOString(),
      rawText: 'Awash transfer ETB 18,000.00 consulting project advance.',
    },
    {
      smsId: `tx-telebirr-30-${now}`,
      bankSource: 'Telebirr',
      amount: 650.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Bole Mini Market Groceries',
      occurredAt: new Date(now - 24 * dayMs).toISOString(),
      rawText: 'Paid ETB 650.00 to Mini Market Bole.',
    },

    // --- UNCATEGORIZED DRAFTS (Will populate Mobile Inbox for Review) ---
    {
      smsId: `tx-sim-draft-01-${now}`,
      bankSource: 'Telebirr',
      amount: 320.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Telebirr merchant payment to Romina',
      occurredAt: new Date(now - 1 * 3600 * 1000).toISOString(),
      rawText: 'Paid ETB 320.00 to Romina Restaurant.',
    },
    {
      smsId: `tx-sim-draft-02-${now}`,
      bankSource: 'CBE',
      amount: 4000.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'ATM cash withdrawal CBE Megenagna',
      occurredAt: new Date(now - 4 * 3600 * 1000).toISOString(),
      rawText: 'ATM Cash Withdrawal ETB 4,000.00 at Megenagna Branch.',
    },
    {
      smsId: `tx-sim-draft-03-${now}`,
      bankSource: 'Abyssinia',
      amount: 750.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'BOA transfer to Meron T.',
      occurredAt: new Date(now - 12 * 3600 * 1000).toISOString(),
      rawText: 'Transfer of ETB 750.00 to Meron Tadesse.',
    },
    {
      smsId: `tx-sim-draft-04-${now}`,
      bankSource: 'Awash',
      amount: 1250.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Awash POS payment at Stadium',
      occurredAt: new Date(now - 1 * dayMs).toISOString(),
      rawText: 'POS transaction of ETB 1,250.00 at Stadium Store.',
    },
    {
      smsId: `tx-sim-draft-05-${now}`,
      bankSource: 'Dashen',
      amount: 890.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Amole merchant scan',
      occurredAt: new Date(now - 2 * dayMs).toISOString(),
      rawText: 'Paid ETB 890.00 via Amole QR code.',
    },
    {
      smsId: `tx-sim-draft-06-${now}`,
      bankSource: 'Telebirr',
      amount: 250.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Lunch at Stadium Fast Food',
      occurredAt: new Date(now - 3 * dayMs).toISOString(),
      rawText: 'Telebirr payment ETB 250.00 to Stadium Cafe.',
    },
    {
      smsId: `tx-sim-draft-07-${now}`,
      bankSource: 'Coop',
      amount: 5500.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Coop transfer for farm supplies',
      occurredAt: new Date(now - 4 * dayMs).toISOString(),
      rawText: 'Transfer of ETB 5,500.00 for fertilizers.',
    },
    {
      smsId: `tx-sim-draft-08-${now}`,
      bankSource: 'Wegagen',
      amount: 1750.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Wegagen debit at Piassa',
      occurredAt: new Date(now - 5 * dayMs).toISOString(),
      rawText: 'Wegagen debit ETB 1,750.00 at Piassa Gold Center.',
    },
    {
      smsId: `tx-sim-draft-09-${now}`,
      bankSource: 'Zemen',
      amount: 3200.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Zemen POS payment',
      occurredAt: new Date(now - 6 * dayMs).toISOString(),
      rawText: 'Zemen Mastercard POS debit ETB 3,200.00.',
    },
    {
      smsId: `tx-sim-draft-10-${now}`,
      bankSource: 'Hibret',
      amount: 450.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Hibret mobile topup',
      occurredAt: new Date(now - 7 * dayMs).toISOString(),
      rawText: 'Hibret mobile debit ETB 450.00.',
    },

    // --- ADDITIONAL BULK TRANSACTIONS TO REACH 50+ ITEMS ---
    {
      smsId: `tx-cbe-bulk-31-${now}`,
      bankSource: 'CBE',
      amount: 550.0,
      type: 'EXPENSE',
      category: 'food',
      note: 'Dinner at Kategna Restaurant',
      occurredAt: new Date(now - 10 * dayMs).toISOString(),
      rawText: 'CBE POS ETB 550.00 at Kategna.',
    },
    {
      smsId: `tx-telebirr-bulk-32-${now}`,
      bankSource: 'Telebirr',
      amount: 120.0,
      type: 'EXPENSE',
      category: 'food',
      note: 'Juice Bar Refreshment',
      occurredAt: new Date(now - 11 * dayMs).toISOString(),
      rawText: 'Paid ETB 120.00 to Mango Juice Bar.',
    },
    {
      smsId: `tx-boa-bulk-33-${now}`,
      bankSource: 'Abyssinia',
      amount: 1650.0,
      type: 'EXPENSE',
      category: 'food',
      note: 'Dining at Castelli Italian Restaurant',
      occurredAt: new Date(now - 12 * dayMs).toISOString(),
      rawText: 'BOA debit ETB 1,650.00 at Castelli.',
    },
    {
      smsId: `tx-awash-bulk-34-${now}`,
      bankSource: 'Awash',
      amount: 2100.0,
      type: 'EXPENSE',
      category: 'shopping',
      note: 'Electronics Store Cable & Adapter',
      occurredAt: new Date(now - 14 * dayMs).toISOString(),
      rawText: 'Awash POS ETB 2,100.00 at Bole Electronics.',
    },
    {
      smsId: `tx-dashen-bulk-35-${now}`,
      bankSource: 'Dashen',
      amount: 1950.0,
      type: 'EXPENSE',
      category: 'groceries',
      note: 'Safeway Supermarket Shopping',
      occurredAt: new Date(now - 16 * dayMs).toISOString(),
      rawText: 'Dashen POS ETB 1,950.00 at Safeway.',
    },
    {
      smsId: `tx-cbe-bulk-36-${now}`,
      bankSource: 'CBE',
      amount: 2000.0,
      type: 'EXPENSE',
      category: 'family_support',
      note: 'Monthly Allowance Transfer to Parents',
      occurredAt: new Date(now - 17 * dayMs).toISOString(),
      rawText: 'CBE transfer ETB 2,000.00 to Parents A/C.',
    },
    {
      smsId: `tx-telebirr-bulk-37-${now}`,
      bankSource: 'Telebirr',
      amount: 180.0,
      type: 'EXPENSE',
      category: 'utilities',
      note: 'Monthly Trash Collection Utility',
      occurredAt: new Date(now - 19 * dayMs).toISOString(),
      rawText: 'Paid ETB 180.00 for cleaning services.',
    },
    {
      smsId: `tx-coop-bulk-38-${now}`,
      bankSource: 'Coop',
      amount: 3200.0,
      type: 'EXPENSE',
      category: 'business',
      note: 'Office Supplies & Printing',
      occurredAt: new Date(now - 21 * dayMs).toISOString(),
      rawText: 'Coopay paid ETB 3,200.00 to Paper House.',
    },
    {
      smsId: `tx-boa-bulk-39-${now}`,
      bankSource: 'Abyssinia',
      amount: 3000.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'BOA ATM Cash Withdrawal',
      occurredAt: new Date(now - 23 * dayMs).toISOString(),
      rawText: 'ATM withdrawal ETB 3,000.00 at Bole Medhanialem.',
    },
    {
      smsId: `tx-telebirr-bulk-40-${now}`,
      bankSource: 'Telebirr',
      amount: 890.0,
      type: 'EXPENSE',
      category: 'uncategorized',
      note: 'Telebirr merchant payment',
      occurredAt: new Date(now - 25 * dayMs).toISOString(),
      rawText: 'Paid ETB 890.00 to General Store.',
    },

    // --- 3 DUPLICATES (To demonstrate server-side deduplication) ---
    {
      smsId: `tx-telebirr-01-${now}`, // Exact duplicate of #1
      bankSource: 'Telebirr',
      amount: 150.0,
      note: 'Duplicate SMS',
    },
    {
      smsId: `tx-cbe-02-${now}`, // Exact duplicate of #2
      bankSource: 'CBE',
      amount: 2450.0,
      note: 'Duplicate SMS',
    },
    {
      smsId: `tx-sim-draft-01-${now}`, // Exact duplicate of draft #1
      bankSource: 'Telebirr',
      amount: 320.0,
      note: 'Duplicate Draft SMS',
    },
  ];

  return dataset;
}

async function runSimulation() {
  console.log('\n======================================================');
  console.log('🚀 MUDAY BULK SMS QUEUE & WORKER PIPELINE SIMULATION (50+ SMS)');
  console.log('======================================================\n');

  // 1. Setup / Find the Telegram user configured in .env (LOCAL_DEV_TELEGRAM_ID)
  const targetTelegramId = BigInt(process.env.LOCAL_DEV_TELEGRAM_ID ?? '8102690249');
  let testUser = await prisma.user.findFirst({
    where: { telegramId: targetTelegramId },
  });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        telegramId: targetTelegramId,
        username: 'telegram_user',
        firstName: 'Telegram',
        lastName: 'User',
        language: 'EN',
        status: 'ACTIVE',
        consentVersion: '2026-08-receipt-v1',
        consentAt: new Date(),
      },
    });
  }
  console.log(`👤 Active Target User: ${testUser.id} (@${testUser.username || 'user'})\n`);

  // 2. Generate 50+ realistic bank SMS dataset
  const dataset = generateRealisticSmsDataset();
  console.log(`📱 1. Mobile App: Scanned & parsed ${dataset.length} Bank SMS Messages:`);
  console.log(
    `   • Telebirr messages: ${dataset.filter((m) => m.bankSource === 'Telebirr').length}`,
  );
  console.log(`   • CBE messages:      ${dataset.filter((m) => m.bankSource === 'CBE').length}`);
  console.log(
    `   • Abyssinia messages:${dataset.filter((m) => m.bankSource === 'Abyssinia').length}`,
  );
  console.log(`   • Awash messages:    ${dataset.filter((m) => m.bankSource === 'Awash').length}`);
  console.log(`   • Dashen messages:   ${dataset.filter((m) => m.bankSource === 'Dashen').length}`);
  console.log(`   • Coop messages:     ${dataset.filter((m) => m.bankSource === 'Coop').length}`);
  console.log(
    `   • Wegagen/Zemen/Hib: ${dataset.filter((m) => ['Wegagen', 'Zemen', 'Hibret'].includes(m.bankSource || '')).length}`,
  );
  console.log(`   • Duplicate checks:  3 deliberate duplicates included\n`);

  // 3. Step 1: Enqueue batch onto BullMQ Queue
  const queue = new Queue<SmsBatchJobData>(queueName, {
    connection: bullMqConnection(redisUrl),
  });

  const startTime = Date.now();
  const job = await queue.add(
    SMS_JOB_NAME,
    {
      userId: testUser.id,
      messages: dataset,
      enqueuedAt: new Date().toISOString(),
    },
    { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
  );
  const enqueueDuration = Date.now() - startTime;

  console.log(`⚡ 2. HTTP Ingestion API Response (Fast & Non-blocking):`);
  console.log(`   • HTTP Status: 200 OK (Enqueued in ${enqueueDuration} ms)`);
  console.log(`   • Response Payload:`, {
    success: true,
    status: 'queued',
    processed: dataset.length,
    jobId: job.id,
  });
  console.log(`   ✅ Mobile app is unblocked immediately!\n`);

  // 4. Step 2: Background Worker Processing
  console.log(`⚙️  3. Background Worker: Consuming job #${job.id} from Redis BullMQ queue...`);
  const processingService = new SmsProcessingService(prisma as any, fakeLogger);

  const worker = new Worker<SmsBatchJobData>(
    queueName,
    async (job) => {
      console.log(
        `\n   🛠️  Worker actively processing ${job.data.messages.length} messages for User ${job.data.userId}...`,
      );
      const result = await processingService.processBatch(job.data);
      return result;
    },
    { connection: bullMqConnection(redisUrl), concurrency: 1 },
  );

  await new Promise<void>((resolve) => {
    worker.on('completed', (completedJob, returnvalue) => {
      console.log(`\n   ✨ Job #${completedJob.id} COMPLETED successfully!`);
      console.log(`   📊 Ingestion Statistics:`, returnvalue);
      resolve();
    });
  });

  // 5. Step 3: Verify the State in PostgreSQL
  console.log(`\n📊 4. Database Records Verification Summary:`);

  const totalLedgerTxs = await prisma.transaction.count({ where: { userId: testUser.id } });
  const totalPendingDrafts = await prisma.pendingInteraction.count({
    where: {
      userId: testUser.id,
      kind: InteractionKind.CLARIFY_FINANCIAL,
      state: InteractionState.PENDING,
    },
  });

  console.log(`   🏛️  Total Ledger Transactions in Main Database: ${totalLedgerTxs}`);
  console.log(`   📥 Total Pending Drafts in Mobile Inbox:       ${totalPendingDrafts}\n`);

  // Sample recent ledger transactions
  const recentTxs = await prisma.transaction.findMany({
    where: { userId: testUser.id },
    orderBy: { occurredAt: 'desc' },
    take: 5,
  });

  console.log(`   ✨ 5 Most Recent Ledger Transactions:`);
  for (const tx of recentTxs) {
    console.log(
      `      • [${tx.type.toUpperCase()}] ${tx.amountEtb} ETB | Category: ${tx.category} | Note: "${tx.note}" | Date: ${tx.occurredAt.toISOString().slice(0, 10)}`,
    );
  }

  // Cleanup
  await worker.close();
  await queue.close();
  await prisma.$disconnect();

  console.log('\n======================================================');
  console.log(`🎉 50+ SMS SIMULATION COMPLETE! All records ready in database.`);
  console.log('======================================================\n');
}

runSimulation().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
