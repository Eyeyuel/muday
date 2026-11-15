import { Module } from '@nestjs/common';

import { ConsentModule } from '../consent/consent.module.js';
import { UsersModule } from '../users/users.module.js';
import { MiniAppAuthGuard } from './miniapp-auth.guard.js';
import { MiniAppAuthService } from './miniapp-auth.service.js';
import { TelegramInitDataService } from './telegram-init-data.service.js';

@Module({
  imports: [UsersModule, ConsentModule],
  providers: [TelegramInitDataService, MiniAppAuthService, MiniAppAuthGuard],
  exports: [MiniAppAuthGuard, MiniAppAuthService, TelegramInitDataService],
})
export class MiniAppAuthModule {}
