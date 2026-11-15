import { Inject, Injectable } from '@nestjs/common';

import { UsersService } from '../users/users.service.js';
import { ConsentService } from './consent.service.js';

@Injectable()
export class ConsentGuard {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ConsentService) private readonly consent: ConsentService,
  ) {}

  async canAccessByUserId(userId: string): Promise<boolean> {
    return this.consent.isActive(await this.users.findById(userId));
  }

  async canAccess(telegramId: number): Promise<boolean> {
    return this.consent.isActive(await this.users.findByTelegramId(telegramId));
  }
}
