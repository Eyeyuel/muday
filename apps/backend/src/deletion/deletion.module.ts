import { Module } from '@nestjs/common';

import { TelegramTransportModule } from '../telegram/transport/telegram-transport.module.js';
import { UsersModule } from '../users/users.module.js';
import { DeletionQueueService } from './deletion-queue.service.js';
import { DeletionService } from './deletion.service.js';

@Module({
  imports: [UsersModule, TelegramTransportModule],
  providers: [DeletionQueueService, DeletionService],
  exports: [DeletionService],
})
export class DeletionModule {}
