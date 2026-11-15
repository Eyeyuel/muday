import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module.js';

import { UserRepository } from './user.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [IdentityModule],
  providers: [UserRepository, UsersService],
  exports: [UserRepository, UsersService],
})
export class UsersModule {}
