import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApplicationException } from '../common/errors/application.exception.js';
import { ErrorCode } from '../common/errors/error-code.js';
import type { Environment } from '../config/environment.js';
import { ConsentService } from '../consent/consent.service.js';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import type { AuthenticatedMiniAppUser } from './miniapp-auth.types.js';
import { TelegramInitDataService } from './telegram-init-data.service.js';

@Injectable()
export class MiniAppAuthService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(TelegramInitDataService) private readonly initData: TelegramInitDataService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ConsentService) private readonly consent: ConsentService,
  ) {}

  async authenticate(header?: string): Promise<AuthenticatedMiniAppUser> {
    if (!header) return this.unauthorized();
    let telegramId: bigint;
    let mode: AuthenticatedMiniAppUser['mode'];
    let user: User;
    if (header === 'dev') {
      if (
        this.config.get('NODE_ENV', { infer: true }) !== 'development' ||
        !this.config.get('ALLOW_LOCAL_DEV_AUTH', { infer: true })
      ) {
        return this.unauthorized();
      }
      telegramId = this.config.get('LOCAL_DEV_TELEGRAM_ID', { infer: true });
      const asNumber = this.safeTelegramId(telegramId);
      mode = 'development';
      const existing = await this.users.findByTelegramId(asNumber);
      if (existing) {
        user = existing;
      } else {
        user = await this.users.syncVerifiedTelegramProfile(
          asNumber,
          {
            firstName: 'Local',
            lastName: 'Developer',
            username: 'dev_user',
          },
          'TELEGRAM_MINIAPP',
        );
      }
      if (!this.consent.isActive(user)) {
        await this.consent.acceptDirectly(user.id);
        const refreshed = await this.users.findById(user.id);
        if (refreshed) user = refreshed;
      }
    } else if (header.startsWith('tma ')) {
      const validated = this.initData.validate(header.slice(4));
      telegramId = validated.id;
      const asNumber = this.safeTelegramId(telegramId);
      user = await this.users.syncVerifiedTelegramProfile(
        asNumber,
        {
          firstName: validated.firstName,
          lastName: validated.lastName ?? null,
          username: validated.username ?? null,
        },
        'TELEGRAM_MINIAPP',
      );
      mode = 'telegram';
    } else {
      return this.unauthorized();
    }
    if (!user || !this.consent.isActive(user)) return this.unauthorized();
    return {
      userId: user.id,
      telegramId,
      mode,
      locale: user.language === 'EN' ? 'en' : 'am',
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
    };
  }

  private safeTelegramId(telegramId: bigint): number {
    const value = Number(telegramId);
    if (!Number.isSafeInteger(value) || value <= 0) return this.unauthorized();
    return value;
  }

  private unauthorized(): never {
    throw new ApplicationException(
      ErrorCode.MINIAPP_AUTH_INVALID,
      HttpStatus.UNAUTHORIZED,
      'Mini App authentication failed.',
    );
  }
}
