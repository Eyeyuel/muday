import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import {
  FinancialEventKind,
  PrismaClient,
  TransactionSource,
  TransactionType,
  UserStatus,
} from '../apps/backend/src/generated/prisma/client.js';
import type { PrismaService } from '../apps/backend/src/database/prisma.service.js';
import { AdminAiToolsService } from '../apps/backend/src/admin-ai/admin-ai-tools.service.js';
import { AdminAiSessionRepository } from '../apps/backend/src/admin-ai/admin-ai-session.repository.js';
import { AdminAiService } from '../apps/backend/src/admin-ai/admin-ai.service.js';
import type { Environment } from '../apps/backend/src/config/environment.js';

async function main() {
  console.log('🤖 Starting Muday Admin AI Live Demonstration...\n');

  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 2 }),
  });

  // Seed sample transactions if database is empty so AI has real transactions to analyze
  const existingCount = await prisma.transaction.count();
  if (existingCount === 0) {
    console.log('📦 Seeding sample Ethiopian transaction dataset for live demo...');

    let demoUser = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
    if (!demoUser) {
      demoUser = await prisma.user.create({
        data: {
          telegramId: 8102690249n,
          firstName: 'Eyuel',
          lastName: 'Gamer',
          username: 'eyuel_gamer',
          status: UserStatus.ACTIVE,
          consentVersion: 'v1.0',
          consentAt: new Date('2026-08-01T08:00:00Z'),
          language: 'AM',
        },
      });
    }

    const group = await prisma.transactionGroup.create({
      data: {
        userId: demoUser.id,
        telegramUpdateId: 88901n,
        telegramMessageId: 501n,
        source: TransactionSource.VOICE,
        messageAt: new Date('2026-08-20T10:00:00Z'),
        rawTranscript: 'I spent 4,500 birr on groceries via telebirr and 1,800 on taxi with CBE',
        extractionModel: 'gemini-3.6-flash',
        promptVersion: 'v1',
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          groupId: group.id,
          userId: demoUser.id,
          type: TransactionType.EXPENSE,
          kind: FinancialEventKind.EXPENSE,
          amountEtb: 4500.0,
          category: 'FOOD_GROCERIES',
          platform: 'telebirr',
          occurredAt: new Date('2026-08-20T10:00:00Z'),
          note: 'Bole Fresh Corner Supermarket',
        },
        {
          groupId: group.id,
          userId: demoUser.id,
          type: TransactionType.EXPENSE,
          kind: FinancialEventKind.EXPENSE,
          amountEtb: 2200.0,
          category: 'FOOD_GROCERIES',
          platform: 'telebirr',
          occurredAt: new Date('2026-08-22T14:00:00Z'),
          note: 'Traditional Butcher Shop',
        },
        {
          groupId: group.id,
          userId: demoUser.id,
          type: TransactionType.EXPENSE,
          kind: FinancialEventKind.EXPENSE,
          amountEtb: 1800.0,
          category: 'TRANSPORT',
          platform: 'cbe',
          occurredAt: new Date('2026-08-23T09:00:00Z'),
          note: 'Ride Taxi Airport Trip',
        },
        {
          groupId: group.id,
          userId: demoUser.id,
          type: TransactionType.EXPENSE,
          kind: FinancialEventKind.EXPENSE,
          amountEtb: 3500.0,
          category: 'UTILITIES',
          platform: 'telebirr',
          occurredAt: new Date('2026-08-25T16:00:00Z'),
          note: 'Ethio Telecom Home Broadband & Electric Bill',
        },
        {
          groupId: group.id,
          userId: demoUser.id,
          type: TransactionType.EXPENSE,
          kind: FinancialEventKind.EXPENSE,
          amountEtb: 6000.0,
          category: 'SHOPPING',
          platform: 'cbe',
          occurredAt: new Date('2026-08-26T18:00:00Z'),
          note: 'Edna Mall Electronics Store',
        },
      ],
    });
    console.log(
      '✅ 5 realistic sample transactions seeded (Telebirr 10,200 ETB, CBE 7,800 ETB).\n',
    );
  }

  const configService = new ConfigService<Environment, true>({
    DATABASE_URL: connectionString,
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    GEMINI_BASE_URL:
      process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
    GEMINI_MODEL: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    GEMINI_TIMEOUT_MS: 60000,
  } as any);

  const toolsService = new AdminAiToolsService(prisma as unknown as PrismaService);
  const sessionRepo = new AdminAiSessionRepository();
  const aiService = new AdminAiService(configService, toolsService, sessionRepo);

  const adminId = 'live-test-admin-1';
  let sessionId: string | undefined = undefined;

  const questions = [
    'What are the top spending categories in Muday and what is the market share between Telebirr and CBE?',
    'Who is our top spending user and what were their biggest purchases?',
  ];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]!;
    console.log(`\n======================================================================`);
    console.log(`💬 Admin Question ${i + 1}: "${question}"`);
    console.log(`======================================================================`);

    const start = Date.now();
    const result = await aiService.chat(adminId, {
      message: question,
      sessionId,
    });
    const elapsedMs = Date.now() - start;

    sessionId = result.sessionId;

    console.log(`\n⏱️ Response Time: ${elapsedMs}ms`);
    console.log(`🛠️ Tools Executed by Gemini:`);
    if (result.toolsExecuted.length === 0) {
      console.log('   (No tools called - direct text response)');
    } else {
      result.toolsExecuted.forEach((tool, idx) => {
        console.log(`   ${idx + 1}. [${tool.toolName}] with args: ${JSON.stringify(tool.args)}`);
      });
    }

    if (result.visualData) {
      console.log(`\n📊 Generated Visual Data Payload:`);
      if (result.visualData.kpis) {
        console.log('   📈 KPI Cards:');
        result.visualData.kpis.forEach((kpi) => console.log(`      • ${kpi.label}: ${kpi.value}`));
      }
      if (result.visualData.table) {
        console.log(`   📋 Table: "${result.visualData.table.title ?? 'Data Table'}"`);
        console.log(`      Headers: [ ${result.visualData.table.headers.join(' | ')} ]`);
        result.visualData.table.rows.forEach((row) => {
          console.log(`      Row: [ ${row.join(' | ')} ]`);
        });
      }
      if (result.visualData.chart) {
        console.log(
          `   📉 Chart (${result.visualData.chart.chartType.toUpperCase()}): "${result.visualData.chart.title ?? 'Chart'}"`,
        );
        result.visualData.chart.data.forEach((d) => {
          console.log(`      • ${d.label}: ${d.value} ETB`);
        });
      }
    }

    console.log(`\n💡 Gemini AI Natural Language Analysis:`);
    console.log(`----------------------------------------------------------------------`);
    console.log(result.reply);
    console.log(`----------------------------------------------------------------------`);
  }

  await prisma.$disconnect();
  console.log('\n🎉 Live AI Assistant Demonstration Finished Successfully!');
}

main().catch((err) => {
  console.error('❌ Live test error:', err);
  process.exit(1);
});
