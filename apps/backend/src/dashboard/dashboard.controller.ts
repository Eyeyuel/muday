import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

import type { Environment } from '../config/environment.js';
import { CategoryRepository } from '../categories/category.repository.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  TRANSACTION_EXTRACTOR,
  type TransactionExtractor,
} from '../extraction/transaction-extractor.interface.js';
import { MiniAppAuthGuard } from '../miniapp-auth/miniapp-auth.guard.js';
import type { MiniAppAuthenticatedRequest } from '../miniapp-auth/miniapp-auth.types.js';
import { ReceiptMediaService } from '../receipt/receipt-media.service.js';
import {
  SPEECH_TO_TEXT_PROVIDER,
  type SpeechToTextProvider,
} from '../stt/speech-to-text.interface.js';
import {
  CreateMiniAppTransactionDto,
  DashboardQueryDto,
  DashboardResponseDto,
  LinkCandidateDto,
  MatchCandidateQueryDto,
  ParseTextDto,
  UpdateMiniAppTransactionDto,
} from './dashboard.dto.js';
import { DashboardService } from './dashboard.service.js';

interface ExpressFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_RECEIPT_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const validateReceiptMagicBytes = (buffer: Buffer, mime: string): boolean => {
  if (buffer.length < 8) return false;
  if (mime.includes('jpeg') || mime.includes('jpg')) {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime.includes('png')) {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mime.includes('webp')) {
    return buffer.toString('utf8', 0, 4) === 'RIFF' && buffer.toString('utf8', 8, 12) === 'WEBP';
  }
  return false;
};

const convertAudioToWav = async (inputPath: string, outputPath: string, ffmpegPath: string) => {
  const binary = ffmpegPath || 'ffmpeg';
  const runFfmpeg = (withFilters: boolean) =>
    new Promise<void>((resolvePromise, reject) => {
      const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-vn'];
      if (withFilters) {
        args.push('-af', 'highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11');
      }
      args.push('-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputPath);

      const proc = spawn(binary, args, { shell: false, stdio: ['ignore', 'ignore', 'ignore'] });
      proc.once('error', (err) => reject(err));
      proc.once('exit', (code) => {
        if (code === 0) resolvePromise();
        else reject(new Error(`ffmpeg conversion failed with code ${code}`));
      });
    });

  try {
    await runFfmpeg(true);
  } catch {
    await runFfmpeg(false);
  }
};

const isWavBuffer = (buffer: Buffer): boolean => {
  return (
    buffer.length >= 12 &&
    buffer.toString('utf8', 0, 4) === 'RIFF' &&
    buffer.toString('utf8', 8, 12) === 'WAVE'
  );
};

@ApiTags('Dashboard')
@ApiSecurity('telegram-miniapp')
@UseGuards(MiniAppAuthGuard)
@Controller('api/dashboard')
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(TRANSACTION_EXTRACTOR) private readonly extractor: TransactionExtractor,
    @Inject(SPEECH_TO_TEXT_PROVIDER) private readonly stt: SpeechToTextProvider,
    @Inject(CategoryRepository) private readonly categoryRepository: CategoryRepository,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReceiptMediaService) private readonly receiptMedia: ReceiptMediaService,
  ) {}

  @Get('categories')
  @ApiOperation({ summary: 'Get categories for the authenticated user and standard categories' })
  async getCategories(@Req() request: Request & MiniAppAuthenticatedRequest) {
    const userCategories = await this.categoryRepository.getUserCategories(
      request.miniAppUser.userId,
    );
    return {
      userCategories,
      defaultExpenseCategories: [
        'food_groceries',
        'transport',
        'utilities',
        'shopping_clothing',
        'health',
        'education',
        'entertainment',
        'other_expense',
      ],
      defaultIncomeCategories: [
        'salary',
        'business',
        'investment',
        'gift',
        'loan_received',
        'other_income',
      ],
    };
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get the authenticated user dashboard for this week or month' })
  @ApiOkResponse({ type: DashboardResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid period' })
  @ApiResponse({
    status: 401,
    description: 'Missing, forged, expired, or ineligible authentication',
  })
  @ApiResponse({ status: 429, description: 'Dashboard request limit exceeded' })
  @ApiResponse({ status: 503, description: 'Dashboard dependency unavailable' })
  async get(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardResponseDto> {
    const filters =
      query.category || query.source || query.search
        ? {
            ...(query.category ? { category: query.category } : {}),
            ...(query.source ? { source: query.source } : {}),
            ...(query.search ? { search: query.search } : {}),
          }
        : undefined;

    const dashboard = await this.dashboard.get(
      request.miniAppUser.userId,
      query.period,
      request.miniAppUser.locale,
      query.limit,
      query.cursor,
      query.startDate,
      query.endDate,
      filters,
    );
    return {
      ...dashboard,
      user: {
        firstName: request.miniAppUser.firstName,
        lastName: request.miniAppUser.lastName,
        username: request.miniAppUser.username,
      },
    };
  }

  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an expense or income transaction from the MiniApp' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid amount or category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @Body() body: CreateMiniAppTransactionDto,
  ) {
    return this.dashboard.createTransaction(request.miniAppUser.userId, body);
  }

  @Patch('transactions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update/edit a transaction from the MiniApp' })
  @ApiResponse({ status: 200, description: 'Transaction updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload or UUID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async update(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() body: UpdateMiniAppTransactionDto,
  ) {
    return this.dashboard.updateTransaction(request.miniAppUser.userId, transactionId, body);
  }

  @Get('match-candidates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Find potential uncategorized bank SMS transactions or drafts matching an amount',
  })
  @ApiResponse({ status: 200, description: 'List of matching candidates' })
  async findMatchCandidates(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @Query() query: MatchCandidateQueryDto,
  ) {
    return this.dashboard.findMatchCandidates(request.miniAppUser.userId, query);
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
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @Body() body: LinkCandidateDto,
  ) {
    return this.dashboard.linkCandidate(request.miniAppUser.userId, body);
  }

  @Post('parse-text')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Parse natural language text or transcribed voice note with AI' })
  async parseText(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @Body() body: ParseTextDto,
  ) {
    if (!body.text || !body.text.trim()) {
      throw new BadRequestException('Text must not be empty');
    }

    try {
      const extracted = await this.extractor.extract({
        text: body.text.trim(),
        locale: request.miniAppUser.locale,
      });

      if (extracted && extracted.transactions && extracted.transactions.length > 0) {
        const firstTx = extracted.transactions[0];
        if (firstTx) {
          return {
            success: true,
            amount: Number(firstTx.amount).toFixed(2),
            type: firstTx.type,
            category: firstTx.category,
            note: firstTx.note || body.text.trim(),
            platform: firstTx.platform || undefined,
            confidence: firstTx.confidence,
          };
        }
      }
    } catch {
      // Graceful fallback
    }

    return {
      success: false,
      amount: '0.00',
      type: 'expense',
      category: 'food_groceries',
      note: body.text.trim(),
      message: 'Could not extract transaction details',
    };
  }

  @Post('voice')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Process recorded voice audio file with AI' })
  async processVoice(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @UploadedFile() file?: ExpressFile,
    @Body('transcript') bodyTranscript?: string,
  ) {
    let transcript = bodyTranscript?.trim() || '';

    if (file && file.buffer) {
      const jobId = `voice-${randomUUID()}`;
      const inputPath = `/tmp/${jobId}.input`;
      const wavPath = `/tmp/${jobId}.wav`;
      const ffmpegPath = this.config.get('FFMPEG_PATH', { infer: true }) || 'ffmpeg';

      try {
        if (isWavBuffer(file.buffer)) {
          await writeFile(wavPath, file.buffer);
        } else {
          await writeFile(inputPath, file.buffer);
          await convertAudioToWav(inputPath, wavPath, ffmpegPath).catch(() => undefined);
        }

        // 1. Try Gemini Multimodal Audio classification directly on the WAV audio
        if (this.extractor.classifyAudio) {
          try {
            const classification = await this.extractor.classifyAudio(
              { wavPath, locale: request.miniAppUser.locale },
              request.miniAppUser.userId,
            );
            if (
              classification &&
              classification.transactions &&
              classification.transactions.length > 0
            ) {
              const ev = classification.transactions[0];
              if (ev && ev.amount) {
                return {
                  success: true,
                  transcript: `${ev.amount} ETB for ${ev.category || 'expense'}`,
                  amount: Number(ev.amount).toFixed(2),
                  type: ev.direction === 'inflow' ? 'income' : 'expense',
                  category: ev.category || 'food_groceries',
                  note: ev.note || 'Voice expense',
                  platform: ev.platform || undefined,
                  confidence: ev.confidence,
                };
              }
            }
          } catch {
            // Gemini audio fallback
          }
        }

        // 2. Try STT transcription
        if (this.stt) {
          try {
            const sttRes = await this.stt.transcribe({
              wavPath,
              locale: request.miniAppUser.locale,
            });
            if (sttRes && sttRes.transcript && sttRes.transcript.trim()) {
              transcript = sttRes.transcript.trim();
            }
          } catch {
            // STT fallback
          }
        }
      } finally {
        await unlink(inputPath).catch(() => undefined);
        await unlink(wavPath).catch(() => undefined);
      }
    }

    if (!transcript) {
      return {
        success: false,
        message: 'No speech detected',
      };
    }

    try {
      const extracted = await this.extractor.extract({
        text: transcript,
        locale: request.miniAppUser.locale,
      });

      if (extracted && extracted.transactions && extracted.transactions.length > 0) {
        const firstTx = extracted.transactions[0];
        if (firstTx) {
          return {
            success: true,
            transcript,
            amount: Number(firstTx.amount).toFixed(2),
            type: firstTx.type,
            category: firstTx.category,
            note: firstTx.note || transcript,
            platform: firstTx.platform || undefined,
            confidence: firstTx.confidence,
          };
        }
      }
    } catch {
      // fallback
    }

    return {
      success: true,
      transcript,
      amount: '0.00',
      type: 'expense',
      category: 'food_groceries',
      note: transcript,
    };
  }

  @Post('receipt')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Scan receipt image and extract transactions using AI Vision' })
  async scanReceipt(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @UploadedFile() file: ExpressFile,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Receipt image file is required');
    }

    const mime = file.mimetype.toLowerCase();
    if (!ALLOWED_RECEIPT_MIMES.includes(mime) || !validateReceiptMagicBytes(file.buffer, mime)) {
      throw new BadRequestException('Invalid or unsupported image file');
    }

    const jobId = `receipt-${randomUUID()}`;
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const tempPath = `/tmp/${jobId}.${ext}`;
    const userMediaDir = resolve('.local/media/receipts', request.miniAppUser.userId);
    const receiptTempId = `temp-${jobId}.${ext}`;
    const userTempPath = resolve(userMediaDir, receiptTempId);

    try {
      await mkdir(userMediaDir, { recursive: true, mode: 0o777 });
      await writeFile(userTempPath, file.buffer);
      await writeFile(tempPath, file.buffer);

      if (this.extractor.extractImage) {
        const extracted = await this.extractor.extractImage({
          imagePath: tempPath,
          mimeType: mime as 'image/jpeg' | 'image/png' | 'image/webp',
          locale: request.miniAppUser.locale,
        });

        if (extracted && extracted.transactions && extracted.transactions.length > 0) {
          const firstTx = extracted.transactions[0];
          if (firstTx) {
            return {
              success: true,
              receiptTempId,
              amount: Number(firstTx.amount).toFixed(2),
              category: firstTx.category,
              merchant:
                firstTx.note ||
                (request.miniAppUser.locale === 'am' ? 'የደረሰኝ ወጪ' : 'Receipt expense'),
              platform: firstTx.platform || undefined,
              confidence: firstTx.confidence,
            };
          }
        }
      }

      return {
        success: false,
        receiptTempId,
        amount: '0.00',
        merchant: '',
        category: 'food_groceries',
        message: 'Could not read receipt total confidently',
      };
    } catch {
      return {
        success: false,
        receiptTempId,
        amount: '0.00',
        merchant: '',
        category: 'food_groceries',
        message: 'Receipt processing encountered an error',
      };
    } finally {
      await unlink(tempPath).catch(() => undefined);
    }
  }

  @Get('transactions/:id/receipt-image')
  @ApiOperation({ summary: 'Stream receipt photo for a transaction belonging to current user' })
  async getReceiptImage(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Res() res: Response,
  ) {
    const tx = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: request.miniAppUser.userId,
      },
      select: {
        group: {
          select: {
            receiptImagePath: true,
          },
        },
      },
    });

    if (!tx || !tx.group?.receiptImagePath) {
      throw new NotFoundException('Receipt image not found for this transaction');
    }

    const fullPath = this.receiptMedia.getReceiptAbsolutePath(tx.group.receiptImagePath);
    if (!existsSync(fullPath)) {
      throw new NotFoundException('Receipt file does not exist on disk');
    }

    const ext = extname(fullPath).toLowerCase();
    const contentType =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    createReadStream(fullPath).pipe(res);
  }

  @Get('receipts/:groupId')
  @ApiOperation({
    summary: 'Stream receipt photo for a transaction group belonging to current user',
  })
  async getGroupReceiptImage(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Res() res: Response,
  ) {
    const group = await this.prisma.transactionGroup.findFirst({
      where: {
        id: groupId,
        userId: request.miniAppUser.userId,
      },
      select: {
        receiptImagePath: true,
      },
    });

    if (!group || !group.receiptImagePath) {
      throw new NotFoundException('Receipt image not found for this group');
    }

    const fullPath = this.receiptMedia.getReceiptAbsolutePath(group.receiptImagePath);
    if (!existsSync(fullPath)) {
      throw new NotFoundException('Receipt file does not exist on disk');
    }

    const ext = extname(fullPath).toLowerCase();
    const contentType =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    createReadStream(fullPath).pipe(res);
  }
}
