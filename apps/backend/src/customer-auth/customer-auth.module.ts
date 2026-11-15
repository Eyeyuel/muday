import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from '../database/database.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { ActiveAccountGuard } from './active-account.guard.js';
import { AppCodeService } from './app-code.service.js';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthGuard } from './customer-auth.guard.js';
import { CustomerJwtService } from './customer-jwt.service.js';
import { CustomerSessionService } from './customer-session.service.js';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    DatabaseModule,
    IdentityModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [CustomerAuthController],
  providers: [
    AppCodeService,
    CustomerJwtService,
    CustomerSessionService,
    CustomerAuthGuard,
    ActiveAccountGuard,
  ],
  exports: [
    AppCodeService,
    CustomerJwtService,
    CustomerSessionService,
    CustomerAuthGuard,
    ActiveAccountGuard,
  ],
})
export class CustomerAuthModule {}
