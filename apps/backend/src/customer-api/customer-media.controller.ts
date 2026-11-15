import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { extname } from 'node:path';

import { ActiveAccountGuard } from '../customer-auth/active-account.guard.js';
import { CurrentCustomer } from '../customer-auth/current-customer.decorator.js';
import { CustomerAuthGuard } from '../customer-auth/customer-auth.guard.js';
import type { CustomerJwtPayload } from '../customer-auth/customer-session-types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  TRANSACTION_EXTRACTOR,
  type TransactionExtractor,
} from '../extraction/transaction-extractor.interface.js';
import { ReceiptMediaService } from '../receipt/receipt-media.service.js';
import {
  SPEECH_TO_TEXT_PROVIDER,
  type SpeechToTextProvider,
} from '../stt/speech-to-text.interface.js';
import { TextTransactionService } from '../transactions/text-transaction.service.js';

interface ExpressFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_VOICE_MIMES = [
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/webm',
];

const ALLOWED_RECEIPT_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const validateVoiceMagicBytes = (buffer: Buffer, mime: string): boolean => {
  if (buffer.length < 4) return false;
  if (mime.includes('ogg') && buffer.toString('utf8', 0, 4) === 'OggS') return true;
  if (mime.includes('mpeg') || mime.includes('mp3')) {
    if (buffer.toString('utf8', 0, 3) === 'ID3') return true;
    if (buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) return true;
  }
  if (mime.includes('wav') && buffer.toString('utf8', 0, 4) === 'RIFF') return true;
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) {
    if (buffer.length >= 8 && buffer.toString('utf8', 4, 8) === 'ftyp') return true;
    if (buffer[0] === 0xff && (buffer[1]! & 0xf0) === 0xf0) return true;
    return buffer.length > 16;
  }
  if (mime.includes('webm') && buffer[0] === 0x1a && buffer[1] === 0x45) return true;
  return buffer.length > 10;
};

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

@ApiTags('Customer Media Transactions')
@Controller('api/v1/transactions')
@UseGuards(CustomerAuthGuard, ActiveAccountGuard)
@ApiBearerAuth()
export class CustomerMediaController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SPEECH_TO_TEXT_PROVIDER) private readonly stt: SpeechToTextProvider,
    @Inject(TRANSACTION_EXTRACTOR) private readonly extractor: TransactionExtractor,
    @Inject(TextTransactionService) private readonly textService: TextTransactionService,
    @Inject(ReceiptMediaService) private readonly receiptMedia: ReceiptMediaService,
  ) {}

  @Post('voice')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload voice note for transaction extraction' })
  @ApiResponse({ status: 200, description: 'Voice note uploaded and queued for processing' })
  async uploadVoice(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @UploadedFile() file: ExpressFile,
    @Body('durationSeconds') durationSecondsStr?: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Voice file is required');
    }

    if (!ALLOWED_VOICE_MIMES.includes(file.mimetype.toLowerCase())) {
      throw new BadRequestException(`Unsupported audio MIME type: ${file.mimetype}`);
    }

    if (!validateVoiceMagicBytes(file.buffer, file.mimetype.toLowerCase())) {
      throw new BadRequestException('Invalid audio file signature/header');
    }

    const durationSeconds = Number(durationSecondsStr) || 10;
    if (durationSeconds <= 0 || durationSeconds > 120) {
      throw new BadRequestException('Voice duration must be between 1 and 120 seconds');
    }

    const jobId = `voice-job-${randomUUID()}`;
    const tempPath = `/tmp/${jobId}.wav`;

    try {
      await writeFile(tempPath, file.buffer);
      let transcript: string | null = null;
      try {
        const sttResult = await this.stt.transcribe({ wavPath: tempPath, locale: 'en' });
        if (sttResult.transcript && sttResult.transcript.trim().length > 0) {
          transcript = sttResult.transcript.trim();
        }
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error
            ? err.message
            : 'Could not transcribe voice note. Please speak clearly.',
        );
      }

      if (!transcript) {
        throw new BadRequestException(
          'No speech detected in audio recording. Please speak clearly.',
        );
      }

      const txResult = await this.textService.logTextForUser({
        userId: customer.sub,
        text: transcript,
        messageAt: new Date(),
        source: 'voice',
      });

      return {
        jobId,
        status: txResult.success ? 'saved' : 'needs_clarification',
        groupId: txResult.groupId,
        message: txResult.message,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Voice note processing failed',
      );
    } finally {
      await unlink(tempPath).catch(() => undefined);
    }
  }

  @Post('receipt')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload receipt image for transaction extraction' })
  @ApiResponse({ status: 200, description: 'Receipt uploaded and queued for processing' })
  async uploadReceipt(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @UploadedFile() file: ExpressFile,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Receipt image file is required');
    }

    if (!ALLOWED_RECEIPT_MIMES.includes(file.mimetype.toLowerCase())) {
      throw new BadRequestException(`Unsupported image MIME type: ${file.mimetype}`);
    }

    if (!validateReceiptMagicBytes(file.buffer, file.mimetype.toLowerCase())) {
      throw new BadRequestException('Invalid image file signature/header');
    }

    const jobId = `receipt-job-${randomUUID()}`;
    const tempPath = `/tmp/${jobId}.jpg`;

    try {
      await writeFile(tempPath, file.buffer);
      let formattedText: string | null = null;

      if (!this.extractor.extractImage) {
        throw new BadRequestException('Receipt image extraction is currently unavailable');
      }

      try {
        const mediaMime = file.mimetype.toLowerCase() as 'image/jpeg' | 'image/png' | 'image/webp';
        const extracted = await this.extractor.extractImage({
          imagePath: tempPath,
          mimeType: mediaMime,
          locale: 'en',
        });

        if (extracted && extracted.transactions && extracted.transactions.length > 0) {
          formattedText = extracted.transactions
            .map(
              (t) =>
                `${t.amount} ETB for ${t.category}${t.platform ? ` using ${t.platform}` : ''}${t.note ? ` (${t.note})` : ''}`,
            )
            .join(', ');
        }
      } catch {
        // Keep the safe fallback text when receipt extraction is unavailable.
      }

      const txResult = await this.textService.logTextForUser({
        userId: customer.sub,
        text: formattedText ?? '',
        messageAt: new Date(),
        source: 'receipt',
      });

      return {
        jobId,
        status: txResult.success ? 'saved' : 'needs_clarification',
        groupId: txResult.groupId,
        message: txResult.message,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Receipt image processing failed',
      );
    } finally {
      await unlink(tempPath).catch(() => undefined);
    }
  }

  @Get('receipts/:groupId')
  @ApiOperation({ summary: 'Stream receipt photo for a customer transaction group' })
  async getReceiptMedia(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('groupId') groupId: string,
    @Res() res: Response,
  ) {
    const group = await this.prisma.transactionGroup.findFirst({
      where: {
        id: groupId,
        userId: customer.sub,
      },
      select: {
        receiptImagePath: true,
      },
    });

    if (!group || !group.receiptImagePath) {
      throw new NotFoundException('Receipt image not found for this transaction group');
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
