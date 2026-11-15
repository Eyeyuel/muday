import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module.js';
import { ConsentGuard } from './consent.guard.js';
import { ConsentRepository } from './consent.repository.js';
import { ConsentService } from './consent.service.js';

@Module({
  imports: [UsersModule],
  providers: [ConsentRepository, ConsentService, ConsentGuard],
  exports: [ConsentService, ConsentGuard],
})
export class ConsentModule {}
