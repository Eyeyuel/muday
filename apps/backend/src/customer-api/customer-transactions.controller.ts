import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Optional,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ActiveAccountGuard } from '../customer-auth/active-account.guard.js';
import { CurrentCustomer } from '../customer-auth/current-customer.decorator.js';
import { CustomerAuthGuard } from '../customer-auth/customer-auth.guard.js';
import type { CustomerJwtPayload } from '../customer-auth/customer-session-types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  FinancialEventKind,
  InteractionKind,
  InteractionState,
  Prisma,
  TransactionSource,
  TransactionType,
} from '../generated/prisma/client.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { CategoryRepository } from '../categories/category.repository.js';
import { DashboardRepository } from '../dashboard/dashboard.repository.js';
import { LinkCandidateDto, MatchCandidateQueryDto } from '../dashboard/dashboard.dto.js';
import { SmsQueueService } from '../sms/sms-queue.service.js';
import { TextTransactionService } from '../transactions/text-transaction.service.js';
import type { PendingDraftPayload } from '../interactions/interaction-payload.schema.js';

import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class LogTextTransactionDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class BankSmsItemDto {
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  bankSource?: string;

  @IsString()
  @IsOptional()
  occurredAt?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  smsId?: string;

  @IsString()
  @IsOptional()
  rawText?: string;
}

export class SaveBankSmsBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankSmsItemDto)
  messages!: BankSmsItemDto[];
}

export interface BankSmsDraftPayload {
  amount?: number;
  type?: string;
  category?: string;
  platform?: string;
  bankSource?: string;
  occurredAt?: string;
  note?: string;
  smsId?: string;
  rawText?: string;
}

export class CategorizeDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9 _/-]+$/, { message: 'Category must be lowercase alphanumeric' })
  category!: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

class ConfirmDraftDto {
  @IsBoolean()
  confirm!: boolean;
}

export class UpdateTransactionCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9 _/-]+$/, { message: 'Category must be lowercase alphanumeric' })
  category!: string;
}

export class UpdateTransactionDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9 _/-]+$/, { message: 'Category must be lowercase alphanumeric' })
  category?: string;

  @IsString()
  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: 'income' | 'expense';

  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  platform?: string | null;
}

@ApiTags('Customer Transactions')
@Controller('api/v1/transactions')
@UseGuards(CustomerAuthGuard, ActiveAccountGuard)
@ApiBearerAuth()
export class CustomerTransactionsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TextTransactionService) private readonly textService: TextTransactionService,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService,
    @Inject(CategoryRepository) private readonly categoryRepository: CategoryRepository,
    @Inject(SmsQueueService) private readonly smsQueueService: SmsQueueService,
    @Optional()
    @Inject(DashboardRepository)
    private readonly dashboardRepository?: DashboardRepository,
  ) {}

  @Post('text')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log an expense or income transaction text note' })
  @ApiResponse({ status: 200, description: 'Transaction processed or clarification requested' })
  async logText(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() body: LogTextTransactionDto,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ) {
    if (!body.text || body.text.trim() === '') {
      throw new BadRequestException('Transaction text must not be empty');
    }

    const key = body.idempotencyKey || headerIdempotencyKey;

    const result = await this.idempotencyService.execute({
      userId: customer.sub,
      operation: 'LOG_TEXT_TRANSACTION',
      key,
      payload: { text: body.text },
      fn: async () => {
        const txResult = await this.textService.logTextForUser({
          userId: customer.sub,
          text: body.text,
          messageAt: new Date(),
        });

        return {
          statusCode: 200,
          body: {
            status: txResult.success ? 'persisted' : 'needs_clarification',
            groupId: txResult.groupId,
            message: txResult.message,
          },
        };
      },
    });

    return result.body;
  }

  @Post('bank-sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save an array of extracted bank SMS directly to user database or drafts queue',
  })
  @ApiResponse({
    status: 200,
    description: 'Bank SMS transactions enqueued for background processing',
  })
  async saveBankSms(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() body: SaveBankSmsBulkDto,
  ) {
    if (!body.messages || body.messages.length === 0) {
      return {
        success: true,
        processed: 0,
        saved: 0,
        drafts: 0,
        duplicates: 0,
        message: 'No messages provided',
      };
    }

    const enqueued = await this.smsQueueService.enqueueBatch(
      customer.sub,
      body.messages.map((m) => ({
        amount: m.amount,
        type: m.type,
        category: m.category,
        bankSource: m.bankSource,
        occurredAt: m.occurredAt,
        note: m.note,
        smsId: m.smsId,
        rawText: m.rawText,
      })),
    );

    return {
      success: true,
      processed: enqueued.count,
      saved: (enqueued as { saved?: number }).saved ?? 0,
      drafts: (enqueued as { drafts?: number }).drafts ?? enqueued.count,
      duplicates: (enqueued as { duplicates?: number }).duplicates ?? 0,
      status: 'queued',
      jobId: enqueued.jobId,
      message: `Enqueued ${enqueued.count} messages for background processing`,
    };
  }

  @Get('bank-sms-drafts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get pending Bank SMS drafts that need categorization' })
  async getBankSmsDrafts(@CurrentCustomer() customer: CustomerJwtPayload) {
    const drafts = await this.prisma.pendingInteraction.findMany({
      where: {
        userId: customer.sub,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    return drafts.map((d) => ({
      id: d.id,
      payload: d.payload,
      createdAt: d.createdAt.toISOString(),
      expiresAt: d.expiresAt.toISOString(),
    }));
  }

  @Post('drafts/:draftId/categorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Categorize a pending transaction draft and save it as a transaction' })
  async categorizeDraft(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('draftId') draftId: string,
    @Body() body: CategorizeDraftDto,
  ) {
    const interaction = await this.prisma.pendingInteraction.findFirst({
      where: {
        id: draftId,
        userId: customer.sub,
        state: InteractionState.PENDING,
      },
    });

    if (!interaction) {
      throw new NotFoundException('Pending draft not found or already resolved');
    }

    const payload = interaction.payload as unknown as BankSmsDraftPayload;
    if (!payload || typeof payload.amount !== 'number') {
      throw new BadRequestException('Draft does not contain enough information to categorize');
    }

    const rawAmount = payload.amount;
    const type =
      (body.type || payload.type || 'EXPENSE').toUpperCase() === 'INCOME'
        ? TransactionType.INCOME
        : TransactionType.EXPENSE;
    const kind =
      type === TransactionType.INCOME ? FinancialEventKind.INCOME : FinancialEventKind.EXPENSE;
    const category = body.category.trim().toLowerCase();
    const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : interaction.createdAt;

    const telegramMessageId = BigInt(Math.floor(Date.now() * 1000 + Math.random() * 1000));
    const telegramUpdateId = BigInt(0);

    const result = await this.prisma.$transaction(async (db) => {
      const claimed = await db.pendingInteraction.updateMany({
        where: { id: draftId, state: InteractionState.PENDING },
        data: { state: InteractionState.RESOLVED, resolvedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new BadRequestException('Draft already resolved');
      }

      const group = await db.transactionGroup.create({
        data: {
          userId: customer.sub,
          telegramUpdateId,
          telegramMessageId,
          source: TransactionSource.TEXT,
          messageAt: occurredAt,
          rawTranscript: payload.smsId
            ? `SMS:${payload.bankSource || 'BANK'}:${payload.smsId}`
            : `BANK_SMS_DRAFT:${payload.bankSource || 'BANK'}`,
          extractionModel: 'BANK_SMS_PARSER',
          promptVersion: '1.0',
        },
      });

      const note =
        body.note || payload.note || (payload.bankSource ? `From ${payload.bankSource} SMS` : null);
      const platform =
        payload.platform || (payload.bankSource ? payload.bankSource.toLowerCase() : null);

      const tx = await db.transaction.create({
        data: {
          groupId: group.id,
          userId: customer.sub,
          type,
          kind,
          amountEtb: new Prisma.Decimal(rawAmount.toFixed(2)),
          category,
          note: note ? note.slice(0, 500) : null,
          platform,
          occurredAt,
        },
      });

      return { group, tx };
    });

    // Upsert the new category to increment its usage
    await this.categoryRepository.upsertAndIncrement(
      customer.sub,
      category,
      result.tx.type.toLowerCase(),
    );

    return {
      success: true,
      id: result.tx.id,
      groupId: result.group.id,
      amount: Number(result.tx.amountEtb).toFixed(2),
      type: result.tx.type.toLowerCase(),
      category: result.tx.category.toLowerCase(),
      platform: result.tx.platform,
      note: result.tx.note,
      occurredAt: result.tx.occurredAt.toISOString(),
      message: 'Draft categorized and transaction saved successfully',
    };
  }

  @Get('bank-sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get extracted Bank SMS transactions history for current customer' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'since', required: false, type: String })
  async getBankSmsHistory(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('page') pageStr?: string,
    @Query('since') sinceStr?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitStr) || 50, 1), 200);
    const parsedOffset = Number(offsetStr);
    const parsedPage = Number(pageStr);
    const skip =
      !isNaN(parsedOffset) && parsedOffset >= 0
        ? parsedOffset
        : !isNaN(parsedPage) && parsedPage > 1
          ? (parsedPage - 1) * limit
          : 0;

    const sinceDate = sinceStr ? new Date(sinceStr) : null;
    const isValidSince = sinceDate && !isNaN(sinceDate.getTime());

    const whereClause: Prisma.TransactionWhereInput = {
      userId: customer.sub,
      group: {
        undoneAt: null,
        extractionModel: 'BANK_SMS_PARSER',
      },
      ...(isValidSince ? { occurredAt: { gte: sinceDate } } : {}),
    };

    const transactions = await this.prisma.transaction.findMany({
      where: whereClause,
      orderBy: { occurredAt: 'desc' },
      skip,
      take: limit,
      include: {
        group: true,
      },
    });

    return transactions.map((t) => {
      let smsId = t.id;
      let bankSource = 'telebirr';
      if (t.group.rawTranscript) {
        const parts = t.group.rawTranscript.split(':');
        const src = parts[1];
        if (src) {
          bankSource = src.toLowerCase();
        }
        if (parts.length >= 3) {
          smsId = parts.slice(2).join(':');
        }
      }

      return {
        id: t.id,
        smsId,
        type: t.type.toLowerCase(),
        amount: Number(t.amountEtb).toFixed(2),
        currency: 'ETB',
        category: t.category.toLowerCase(),
        platform: t.platform ?? bankSource,
        bankSource,
        note: t.note,
        occurredAt: t.occurredAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
      };
    });
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get transaction history for current customer' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'since', required: false, type: String })
  async getHistory(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('page') pageStr?: string,
    @Query('since') sinceStr?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitStr) || 20, 1), 100);
    const parsedOffset = Number(offsetStr);
    const parsedPage = Number(pageStr);
    const skip =
      !isNaN(parsedOffset) && parsedOffset >= 0
        ? parsedOffset
        : !isNaN(parsedPage) && parsedPage > 1
          ? (parsedPage - 1) * limit
          : 0;

    const sinceDate = sinceStr ? new Date(sinceStr) : null;
    const isValidSince = sinceDate && !isNaN(sinceDate.getTime());

    const whereClause: Prisma.TransactionWhereInput = {
      userId: customer.sub,
      group: { undoneAt: null },
      ...(isValidSince ? { occurredAt: { gte: sinceDate } } : {}),
    };

    const [transactions, pendingDrafts] = await Promise.all([
      this.prisma.transaction.findMany({
        where: whereClause,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
        include: {
          group: true,
        },
      }),
      this.prisma.pendingInteraction.findMany({
        where: {
          userId: customer.sub,
          kind: InteractionKind.CLARIFY_FINANCIAL,
          state: InteractionState.PENDING,
          ...(isValidSince ? { createdAt: { gte: sinceDate } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const txItems = transactions.map((t) => {
      let smsId: string | undefined = undefined;
      let bankSource: string | undefined = undefined;
      if (t.group?.rawTranscript) {
        const parts = t.group.rawTranscript.split(':');
        if (parts.length >= 2) {
          bankSource = parts[1]?.toLowerCase();
        }
        if (parts.length >= 3) {
          smsId = parts.slice(2).join(':');
        }
      }

      return {
        id: t.id,
        smsId: smsId || t.id,
        type: t.type.toLowerCase(),
        amount: Number(t.amountEtb).toFixed(2),
        currency: 'ETB',
        category: t.category.toLowerCase(),
        platform: t.platform ?? bankSource ?? undefined,
        bankSource,
        note: t.note,
        occurredAt: t.occurredAt.toISOString(),
        createdAt: t.occurredAt.toISOString(),
      };
    });

    const pendingItems = pendingDrafts.map((p) => {
      const payload = (p.payload as unknown as PendingDraftPayload | null) ?? {};
      const amountVal =
        payload.amount ?? payload.event?.amount ?? payload.readyTransactions?.[0]?.amount ?? '0';
      const occurredAt = payload.occurredAt
        ? new Date(payload.occurredAt)
        : payload.messageAt
          ? new Date(payload.messageAt)
          : p.createdAt;
      const isIncome = payload.type === 'income';

      return {
        id: p.id,
        smsId: (payload.smsId as string) || p.id,
        type: isIncome ? 'income' : 'expense',
        amount: Number(amountVal).toFixed(2),
        currency: 'ETB',
        category: 'uncategorized',
        platform:
          payload.platform ||
          payload.bankSource?.toLowerCase() ||
          payload.bank?.toLowerCase() ||
          undefined,
        bankSource: payload.bankSource || payload.bank || undefined,
        note: payload.note || payload.rawSms || payload.rawText || payload.event?.note || null,
        occurredAt: occurredAt.toISOString(),
        createdAt: p.createdAt.toISOString(),
      };
    });

    const allItems = [...txItems, ...pendingItems];
    allItems.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    return allItems.slice(0, limit);
  }

  @Post('undo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undo the latest logged transaction group for current customer' })
  async undoLatest(@CurrentCustomer() customer: CustomerJwtPayload) {
    return this.textService.undoLastTransactionForUser(customer.sub);
  }

  @Get('jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Poll status of a background voice/receipt job or transaction draft' })
  async getJobStatus(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('jobId') jobId: string,
  ) {
    const interaction = await this.prisma.pendingInteraction.findFirst({
      where: { id: jobId, userId: customer.sub },
    });

    if (interaction) {
      const stateMap: Record<string, string> = {
        PENDING: 'needs_confirmation',
        RESOLVED: 'saved',
        CANCELLED: 'cancelled',
        EXPIRED: 'expired',
      };
      return {
        jobId,
        state: stateMap[interaction.state] ?? 'processing',
        draftId: interaction.id,
        updatedAt: interaction.createdAt.toISOString(),
      };
    }

    const latestGroup = await this.prisma.transactionGroup.findFirst({
      where: { id: jobId, userId: customer.sub },
      include: { transactions: true },
    });

    if (latestGroup) {
      return {
        jobId,
        state: 'saved',
        groupId: latestGroup.id,
        transactions: latestGroup.transactions.map((t) => ({
          id: t.id,
          type: t.type.toLowerCase(),
          amount: Number(t.amountEtb).toFixed(2),
          currency: 'ETB',
          category: t.category.toLowerCase(),
          platform: t.platform ?? undefined,
          note: t.note,
          createdAt: t.occurredAt.toISOString(),
        })),
        updatedAt: latestGroup.createdAt.toISOString(),
      };
    }

    throw new NotFoundException('Job or transaction draft not found');
  }

  @Post('drafts/:draftId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a pending transaction draft or receipt' })
  async confirmDraft(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('draftId') draftId: string,
    @Body() body: ConfirmDraftDto,
  ) {
    if (!body.confirm) {
      throw new BadRequestException('confirm: true is required');
    }

    const interaction = await this.prisma.pendingInteraction.findFirst({
      where: { id: draftId, userId: customer.sub, state: 'PENDING' },
    });

    if (!interaction) {
      throw new NotFoundException('Pending interaction draft not found or already resolved');
    }

    const claimed = await this.prisma.pendingInteraction.updateMany({
      where: { id: draftId, userId: customer.sub, state: 'PENDING' },
      data: { state: 'RESOLVED', resolvedAt: new Date() },
    });

    if (claimed.count !== 1) {
      throw new BadRequestException('Draft already resolved');
    }

    return {
      success: true,
      status: 'saved',
      message: 'Transaction draft confirmed and saved successfully',
    };
  }

  @Post('drafts/:draftId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending transaction draft' })
  async cancelDraft(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('draftId') draftId: string,
  ) {
    const claimed = await this.prisma.pendingInteraction.updateMany({
      where: { id: draftId, userId: customer.sub, state: 'PENDING' },
      data: { state: 'CANCELLED', resolvedAt: new Date() },
    });

    if (claimed.count !== 1) {
      throw new BadRequestException('Draft not pending or already resolved');
    }

    return {
      success: true,
      status: 'cancelled',
      message: 'Transaction draft cancelled',
    };
  }

  @Patch(':id/category')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the category of a transaction' })
  async updateCategory(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() body: UpdateTransactionCategoryDto,
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId: customer.sub },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const newCategory = body.category.trim().toLowerCase();

    if (transaction.category === newCategory) {
      return { success: true, message: 'Category unchanged' };
    }

    await this.prisma.$transaction(async (db) => {
      await db.transaction.update({
        where: { id: transactionId },
        data: { category: newCategory },
      });

      // Upsert the new category to increment its usage and keep track of user categories
      await this.categoryRepository.upsertAndIncrement(
        customer.sub,
        newCategory,
        transaction.type.toLowerCase(),
      );
    });

    return {
      success: true,
      message: 'Category updated successfully',
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a transaction (category, type, note)' })
  async updateTransaction(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() body: UpdateTransactionDto,
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId: customer.sub },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const updates: Prisma.TransactionUpdateInput = {};
    if (body.category !== undefined) {
      updates.category = body.category.trim().toLowerCase();
    }
    if (body.type !== undefined) {
      updates.type =
        body.type.toUpperCase() === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE;
    }
    if (body.note !== undefined) {
      updates.note = body.note ? body.note.slice(0, 500) : null;
    }
    if (body.platform !== undefined) {
      updates.platform = body.platform ? body.platform.trim().toLowerCase().slice(0, 50) : null;
    }

    if (Object.keys(updates).length === 0) {
      return { success: true, message: 'Nothing to update' };
    }

    await this.prisma.$transaction(async (db) => {
      await db.transaction.update({
        where: { id: transactionId },
        data: updates,
      });

      // Upsert the new category to increment its usage if it changed
      if (updates.category) {
        await this.categoryRepository.upsertAndIncrement(
          customer.sub,
          updates.category as string,
          ((updates.type as string) || transaction.type).toLowerCase(),
        );
      }
    });

    return {
      success: true,
      message: 'Transaction updated successfully',
    };
  }

  @Get('match-candidates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Find potential uncategorized bank SMS transactions or drafts matching an amount',
  })
  @ApiResponse({ status: 200, description: 'List of matching candidates' })
  async findMatchCandidates(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Query() query: MatchCandidateQueryDto,
  ) {
    if (!this.dashboardRepository) return [];
    return this.dashboardRepository.findMatchCandidates(customer.sub, query);
  }

  @Post('link-candidate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Link and enrich an uncategorized bank transaction or draft with a category & note',
  })
  @ApiResponse({
    status: 200,
    description: 'Candidate transaction linked and updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Candidate not found' })
  async linkCandidate(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() body: LinkCandidateDto,
  ) {
    if (!this.dashboardRepository) {
      throw new NotFoundException('Candidate not found');
    }
    const linked = await this.dashboardRepository.linkCandidate(customer.sub, body);
    if (!linked) {
      throw new NotFoundException('Candidate not found');
    }
    return linked;
  }
}
