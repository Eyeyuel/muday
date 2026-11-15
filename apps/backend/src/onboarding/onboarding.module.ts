import { Module } from '@nestjs/common';

import { ConsentModule } from '../consent/consent.module.js';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module.js';
import { TelegramTransportModule } from '../telegram/transport/telegram-transport.module.js';
import { UsersModule } from '../users/users.module.js';
import { LanguageService } from './language.service.js';
import { NavigationMenuService } from './navigation-menu.service.js';
import { OnboardingService } from './onboarding.service.js';

@Module({
  imports: [UsersModule, ConsentModule, TelegramTransportModule, CustomerAuthModule],
  providers: [OnboardingService, LanguageService, NavigationMenuService],
  exports: [OnboardingService, LanguageService, NavigationMenuService],
})
export class OnboardingModule {}
