import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class UserRepository {
  constructor(@Inject(PrismaService) readonly prisma: PrismaService) {}

  findByTelegramId(telegramId: number) {
    return this.prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  }

  findById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  setLanguage(userId: string, language: 'AM' | 'EN') {
    return this.prisma.user.update({ where: { id: userId }, data: { language } });
  }

  updateProfileMetadata(
    userId: string,
    metadata: {
      firstName?: string | null | undefined;
      lastName?: string | null | undefined;
      username?: string | null | undefined;
      photoFileId?: string | null | undefined;
    },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(metadata.firstName !== undefined ? { firstName: metadata.firstName } : {}),
        ...(metadata.lastName !== undefined ? { lastName: metadata.lastName } : {}),
        ...(metadata.username !== undefined ? { username: metadata.username } : {}),
        ...(metadata.photoFileId !== undefined ? { photoFileId: metadata.photoFileId } : {}),
      },
    });
  }

  reactivate(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'PENDING_CONSENT',
        deletedAt: null,
        consentAt: null,
        consentVersion: null,
      },
    });
  }
}
