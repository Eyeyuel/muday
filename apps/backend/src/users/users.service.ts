import { Inject, Injectable } from '@nestjs/common';

import type { IdentityChannel } from '../generated/prisma/client.js';
import { TelegramIdentityResolver } from '../identity/telegram-identity-resolver.service.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(TelegramIdentityResolver) private readonly identities: TelegramIdentityResolver,
  ) {}

  async findOrCreate(telegramId: number) {
    const existing = await this.users.findByTelegramId(telegramId);
    if (existing && (existing.status === 'DELETED' || existing.deletedAt !== null)) {
      const user = await this.users.reactivate(existing.id);
      return { user, created: false };
    }
    const result = await this.identities.resolve({
      telegramUserId: this.telegramId(telegramId),
      channel: 'TELEGRAM_BOT',
    });
    return { user: result.user, created: result.created };
  }

  findByTelegramId(telegramId: number) {
    return this.users.findByTelegramId(telegramId);
  }

  findById(userId: string) {
    return this.users.findById(userId);
  }

  reactivate(userId: string) {
    return this.users.reactivate(userId);
  }

  changeLanguageByUserId(userId: string, locale: 'am' | 'en') {
    return this.users.setLanguage(userId, locale === 'en' ? 'EN' : 'AM');
  }

  async changeLanguage(telegramId: number, locale: 'am' | 'en') {
    const { user } = await this.findOrCreate(telegramId);
    return this.changeLanguageByUserId(user.id, locale);
  }

  async syncVerifiedTelegramProfile(
    telegramId: number,
    metadata: {
      firstName?: string | null | undefined;
      lastName?: string | null | undefined;
      username?: string | null | undefined;
      photoFileId?: string | null | undefined;
    },
    channel: IdentityChannel = 'TELEGRAM_BOT',
  ) {
    const result = await this.identities.resolve({
      telegramUserId: this.telegramId(telegramId),
      channel,
      profile: {
        firstName: metadata.firstName,
        lastName: metadata.lastName,
        username: metadata.username,
      },
    });
    if (metadata.photoFileId === undefined) return result.user;
    return this.users.updateProfileMetadata(result.user.id, { photoFileId: metadata.photoFileId });
  }

  private telegramId(value: number): bigint {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid Telegram user ID');
    return BigInt(value);
  }
}
