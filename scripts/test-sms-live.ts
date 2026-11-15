import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import { Bot, InlineKeyboard } from 'grammy';
import {
  PrismaClient,
  InteractionKind,
  InteractionState,
} from '../apps/backend/src/generated/prisma/client.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: 'apps/backend/.env' });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

const DEFAULT_EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'groceries',
  'utilities',
  'shopping',
  'cafe',
];
const DEFAULT_INCOME_CATEGORIES = ['salary', 'business', 'gift', 'remittance', 'other_income'];

const CATEGORY_EMOJIS: Record<string, string> = {
  food: '🍔',
  transport: '🚗',
  groceries: '🛒',
  utilities: '💡',
  shopping: '🛍️',
  cafe: '☕',
  salary: '💼',
  business: '📈',
  gift: '🎁',
  remittance: '🌍',
  other_income: '💵',
};

function formatCategoryLabel(cat: string): string {
  const emoji = CATEGORY_EMOJIS[cat.toLowerCase()] || '🏷️';
  const clean = cat.replace(/[_-]/g, ' ').trim();
  const name = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  return `${emoji} ${name}`;
}

async function main() {
  console.log('\n======================================================');
  console.log('  Muday SMS Review & Categorization Live Tester');
  console.log('======================================================\n');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const rawArgs = process.argv.slice(2).map((a) => a.trim().toLowerCase());
  const isIncomeMode = rawArgs.includes('income');
  const isMixedMode = rawArgs.includes('mixed');

  // Find user
  const targetUserArg = process.argv
    .slice(2)
    .find((a) => !['income', 'expense', 'mixed'].includes(a.toLowerCase()));
  let user: any = null;

  if (targetUserArg) {
    const isNumeric = /^\d+$/.test(targetUserArg);
    if (isNumeric) {
      user = await prisma.user.findFirst({
        where: { telegramId: BigInt(targetUserArg), status: 'ACTIVE', deletedAt: null },
      });
    } else {
      const cleanUsername = targetUserArg.replace(/^@/, '');
      user = await prisma.user.findFirst({
        where: { username: cleanUsername, status: 'ACTIVE', deletedAt: null },
      });
    }
  }

  if (!user) {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    if (users.length === 0) {
      console.error(
        '❌ No active user found in database. Start the bot on Telegram first (/start).',
      );
      await prisma.$disconnect();
      process.exit(1);
    }

    user = users.find((u) => u.username) || users[0];
  }

  console.log(`👤 Testing with user: @${user.username || 'unknown'} (${user.firstName || ''})`);
  console.log(`📱 Telegram ID: ${user.telegramId}`);
  console.log(`🌐 Language: ${user.language}`);
  console.log(
    `🔄 Mode: ${isMixedMode ? 'Mixed (1 Income + 1 Expense)' : isIncomeMode ? 'Income only' : 'Expense only'}\n`,
  );

  const now = new Date();
  let draft1: any;
  let draft2: any;

  if (isIncomeMode) {
    // 2 Income drafts
    draft1 = await prisma.pendingInteraction.create({
      data: {
        userId: user.id,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
        payload: {
          amount: 15000.0,
          type: 'income',
          bankSource: 'CBE',
          occurredAt: now.toISOString(),
          smsId: `live-income-cbe-${Date.now()}`,
          rawText:
            'Dear Customer, your account was credited with ETB 15,000.00 on 28-Aug-2026. Ref: SALARY-AUG.',
        },
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    draft2 = await prisma.pendingInteraction.create({
      data: {
        userId: user.id,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
        payload: {
          amount: 2500.0,
          type: 'income',
          bankSource: 'Telebirr',
          occurredAt: now.toISOString(),
          smsId: `live-income-telebirr-${Date.now()}`,
          rawText:
            'You have received ETB 2,500.00 via Telebirr from Aster Mengistu on 28-Aug-2026.',
        },
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    console.log(`✅ Created 2 sample INCOME SMS drafts:`);
    console.log(`   - Draft 1: CBE 15,000.00 ETB (Income) (ID: ${draft1.id})`);
    console.log(`   - Draft 2: Telebirr 2,500.00 ETB (Income) (ID: ${draft2.id})\n`);
  } else if (isMixedMode) {
    // 1 Income + 1 Expense
    draft1 = await prisma.pendingInteraction.create({
      data: {
        userId: user.id,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
        payload: {
          amount: 8000.0,
          type: 'income',
          bankSource: 'Awash',
          occurredAt: now.toISOString(),
          smsId: `live-mixed-income-${Date.now()}`,
          rawText: 'Your account credited with ETB 8,000.00 on 28-Aug-2026. Ref: TXN1199.',
        },
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    draft2 = await prisma.pendingInteraction.create({
      data: {
        userId: user.id,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
        payload: {
          amount: 450.0,
          type: 'expense',
          bankSource: 'CBE',
          occurredAt: now.toISOString(),
          smsId: `live-mixed-expense-${Date.now()}`,
          rawText: 'Dear Customer, your account was debited with ETB 450.00 on 28-Aug-2026.',
        },
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    console.log(`✅ Created 2 sample MIXED SMS drafts:`);
    console.log(`   - Draft 1: Awash 8,000.00 ETB (Income) (ID: ${draft1.id})`);
    console.log(`   - Draft 2: CBE 450.00 ETB (Expense) (ID: ${draft2.id})\n`);
  } else {
    // 2 Expense drafts
    draft1 = await prisma.pendingInteraction.create({
      data: {
        userId: user.id,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
        payload: {
          amount: 350.0,
          type: 'expense',
          bankSource: 'CBE',
          occurredAt: now.toISOString(),
          smsId: `live-cbe-${Date.now()}`,
          rawText: 'Dear Customer, your account was debited with ETB 350.00 on 28-Aug-2026.',
        },
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    draft2 = await prisma.pendingInteraction.create({
      data: {
        userId: user.id,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
        payload: {
          amount: 120.5,
          type: 'expense',
          bankSource: 'Telebirr',
          occurredAt: now.toISOString(),
          smsId: `live-telebirr-${Date.now()}`,
          rawText: 'You have transferred ETB 120.50 via Telebirr to Cafe Buna on 28-Aug-2026.',
        },
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    console.log(`✅ Created 2 sample EXPENSE SMS drafts:`);
    console.log(`   - Draft 1: CBE 350.00 ETB (Expense) (ID: ${draft1.id})`);
    console.log(`   - Draft 2: Telebirr 120.50 ETB (Expense) (ID: ${draft2.id})\n`);
  }

  if (!botToken) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not found. Created drafts in database.');
    await prisma.$disconnect();
    return;
  }

  // Determine categories for draft 1
  const draft1Type = (draft1.payload as any).type || 'expense';
  const isDraft1Income = draft1Type.toLowerCase() === 'income';

  const userCats = await prisma.userCategory.findMany({
    where: { userId: user.id, type: isDraft1Income ? 'income' : 'expense' },
    orderBy: { usedCount: 'desc' },
    take: 4,
  });

  const categorySet = new Set<string>();
  userCats.forEach((c) => categorySet.add(c.label.toLowerCase()));
  const defaults = isDraft1Income ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  defaults.forEach((c) => categorySet.add(c));
  const combined = Array.from(categorySet).slice(0, 6);

  const keyboard = new InlineKeyboard();
  for (let i = 0; i < combined.length; i += 2) {
    const cat1 = combined[i]!;
    keyboard.text(formatCategoryLabel(cat1), `sms_cat:${draft1.id}:${cat1}`);
    if (i + 1 < combined.length) {
      const cat2 = combined[i + 1]!;
      keyboard.text(formatCategoryLabel(cat2), `sms_cat:${draft1.id}:${cat2}`);
    }
    keyboard.row();
  }
  keyboard.text(
    user.language === 'AM' ? '❌ ሰርዝ / ዝለል' : '❌ Skip / Dismiss',
    `sms_dismiss:${draft1.id}`,
  );

  const isAmharic = user.language === 'AM';
  const typeLabel = isDraft1Income ? (isAmharic ? 'ገቢ' : 'Income') : isAmharic ? 'ወጪ' : 'Expense';
  const bank = (draft1.payload as any).bankSource || 'Bank';
  const amount = Number((draft1.payload as any).amount).toFixed(2);

  const text = isAmharic
    ? `📥 ${bank} የባንክ መልዕክት (1 ከ 2)\n\n💰 መጠን: ${amount} ETB (${typeLabel})\n🏦 ባንክ: ${bank}\n\n🏷️ ይህ ${typeLabel} ለምን ነበር? ከታች ምድብ ይምረጡ:`
    : `📥 ${bank} Bank SMS (1 of 2)\n\n💰 Amount: ${amount} ETB (${typeLabel})\n🏦 Bank: ${bank}\n\n🏷️ What was this ${typeLabel.toLowerCase()} for? Tap a category below:`;

  const bot = new Bot(botToken);
  console.log(`🚀 Sending review notification to Telegram chat ${user.telegramId}...`);
  await bot.api.sendMessage(Number(user.telegramId), text, { reply_markup: keyboard });

  console.log('✨ Sent successfully! Check your Telegram chat with the bot:');
  if (isDraft1Income) {
    console.log(
      '   1. You will see the Income prompt (e.g. Salary, Business, Gift, Remittance buttons).',
    );
    console.log(
      '   2. Click a category -> the bot will save it as Income and serve the next prompt.',
    );
  } else {
    console.log('   1. You will see the Expense prompt (e.g. Food, Transport, Groceries buttons).');
    console.log(
      '   2. Click a category -> the bot will save it as Expense and serve the next prompt.',
    );
  }
  console.log('   3. When all are answered -> the bot sends "All caught up!".\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
