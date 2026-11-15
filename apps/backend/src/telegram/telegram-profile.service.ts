import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from './transport/telegram-transport.interface.js';

export interface ProfilePhotoResult {
  buffer: Buffer;
  contentType: string;
}

interface CachedPhoto {
  data: ProfilePhotoResult | null;
  expiresAt: number;
}

@Injectable()
export class TelegramProfileService {
  private readonly token: string;
  private readonly cache = new Map<number, CachedPhoto>();
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours
  private readonly negativeTtlMs = 30 * 1000; // 30 seconds for empty/no photo

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {
    this.token = config.get('TELEGRAM_BOT_TOKEN', { infer: true });
  }

  async getProfilePhoto(telegramId: number): Promise<ProfilePhotoResult | null> {
    const cached = this.cache.get(telegramId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    try {
      const photos = await this.transport.getUserProfilePhotos(telegramId);
      if (
        !photos ||
        photos.totalCount === 0 ||
        !photos.photos[0] ||
        photos.photos[0].length === 0
      ) {
        this.cache.set(telegramId, { data: null, expiresAt: now + this.negativeTtlMs });
        return null;
      }

      // Telegram orders variants from smallest to largest; use the best available resolution.
      const photoVariant = photos.photos[0].at(-1);
      if (!photoVariant) {
        this.cache.set(telegramId, { data: null, expiresAt: now + this.negativeTtlMs });
        return null;
      }

      const fileInfo = await this.transport.getFile(photoVariant.fileId);
      if (!fileInfo.filePath || !this.token) {
        this.cache.set(telegramId, { data: null, expiresAt: now + this.negativeTtlMs });
        return null;
      }

      const telegramFileUrl = `https://api.telegram.org/file/bot${this.token}/${fileInfo.filePath}`;
      const response = await fetch(telegramFileUrl);
      if (!response.ok) {
        this.logger.warn('Failed to fetch Telegram profile photo file', {
          telegramId,
          status: response.status,
        });
        this.cache.set(telegramId, { data: null, expiresAt: now + this.negativeTtlMs });
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      const photoResult: ProfilePhotoResult = { buffer, contentType };
      this.cache.set(telegramId, { data: photoResult, expiresAt: now + this.ttlMs });
      return photoResult;
    } catch (err) {
      this.logger.warn('Exception during profile photo retrieval', {
        telegramId,
        exceptionType: err instanceof Error ? err.name : typeof err,
      });
      this.cache.set(telegramId, { data: null, expiresAt: now + this.negativeTtlMs });
      return null;
    }
  }
}
