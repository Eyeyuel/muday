import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';

import type { Environment } from '../config/environment.js';
import { ApplicationException } from '../common/errors/application.exception.js';
import { ErrorCode } from '../common/errors/error-code.js';
import { TelegramUpdateProcessorService } from './telegram-update-processor.service.js';
import type { TelegramUpdate } from './telegram.types.js';

@ApiTags('Telegram')
@Controller('webhook/telegram')
export class TelegramWebhookController {
  private readonly secret: string;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(TelegramUpdateProcessorService)
    private readonly processor: TelegramUpdateProcessorService,
  ) {
    this.secret = config.get('TELEGRAM_WEBHOOK_SECRET', { infer: true });
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive an authenticated Telegram update' })
  @ApiHeader({ name: 'X-Telegram-Bot-Api-Secret-Token', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['update_id'],
      properties: { update_id: { type: 'integer' } },
    },
  })
  @ApiOkResponse({ schema: { example: { ok: true, status: 'processed' } } })
  async receive(
    @Headers('x-telegram-bot-api-secret-token') suppliedSecret: string | undefined,
    @Body() body: unknown,
  ): Promise<{ ok: true; status: 'processed' | 'duplicate' }> {
    if (!this.secretsMatch(suppliedSecret)) {
      throw new ApplicationException(
        ErrorCode.TELEGRAM_AUTH_FAILED,
        401,
        'Invalid Telegram webhook secret',
      );
    }
    if (!this.isTelegramUpdate(body)) throw new BadRequestException('Invalid Telegram update');
    return { ok: true, status: await this.processor.process(body) };
  }

  private secretsMatch(supplied: string | undefined): boolean {
    if (!supplied) return false;
    const expectedBuffer = Buffer.from(this.secret);
    const suppliedBuffer = Buffer.from(supplied);
    return (
      expectedBuffer.length === suppliedBuffer.length &&
      timingSafeEqual(expectedBuffer, suppliedBuffer)
    );
  }

  private isTelegramUpdate(value: unknown): value is TelegramUpdate {
    return (
      typeof value === 'object' &&
      value !== null &&
      Number.isSafeInteger((value as { update_id?: unknown }).update_id) &&
      Number((value as { update_id: number }).update_id) >= 0
    );
  }
}
