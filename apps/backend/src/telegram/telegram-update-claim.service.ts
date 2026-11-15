import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { SafeUpdateMetadata } from './telegram.types.js';

@Injectable()
export class TelegramUpdateClaimService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async claim(metadata: SafeUpdateMetadata): Promise<boolean> {
    const result = await this.prisma.processedUpdate.createMany({
      data: [
        {
          telegramUpdateId: BigInt(metadata.updateId),
          telegramChatId: metadata.chatId === undefined ? null : BigInt(metadata.chatId),
          telegramMessageId: metadata.messageId === undefined ? null : BigInt(metadata.messageId),
          updateType: metadata.updateType,
          status: 'PROCESSING',
          attemptCount: 1,
        },
      ],
      skipDuplicates: true,
    });
    return result.count === 1;
  }

  async complete(updateId: number): Promise<void> {
    await this.prisma.processedUpdate.update({
      where: { telegramUpdateId: BigInt(updateId) },
      data: { status: 'COMPLETED', completedAt: new Date(), lastErrorCode: null },
    });
  }

  async fail(updateId: number, errorCode = 'INTERNAL_ERROR'): Promise<void> {
    await this.prisma.processedUpdate.update({
      where: { telegramUpdateId: BigInt(updateId) },
      data: { status: 'FAILED', lastErrorCode: errorCode },
    });
  }
}
