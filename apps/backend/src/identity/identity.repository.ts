import { Inject, Injectable } from '@nestjs/common';

import { Prisma, type User } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

export type IdentityDatabase = Prisma.TransactionClient | PrismaService;

@Injectable()
export class IdentityRepository {
  constructor(@Inject(PrismaService) readonly prisma: PrismaService) {}

  findTelegramCandidates(telegramUserId: bigint, database: IdentityDatabase = this.prisma) {
    const providerSubject = telegramUserId.toString();
    return database.userIdentity.findMany({
      where: {
        provider: 'TELEGRAM',
        OR: [{ providerSubject }, { telegramUserId }],
      },
    });
  }

  findLegacyTelegramUser(telegramUserId: bigint, database: IdentityDatabase = this.prisma) {
    return database.user.findUnique({ where: { telegramId: telegramUserId } });
  }

  createTelegramIdentity(
    user: Pick<
      User,
      'id' | 'telegramId' | 'firstName' | 'lastName' | 'username' | 'createdAt' | 'updatedAt'
    >,
    database: IdentityDatabase,
  ) {
    if (user.telegramId === null) throw new Error('Telegram identity requires telegramId');
    const profileDisplayName = [user.firstName, user.lastName]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(' ')
      .trim();
    return database.userIdentity.create({
      data: {
        userId: user.id,
        provider: 'TELEGRAM',
        providerSubject: user.telegramId.toString(),
        telegramUserId: user.telegramId,
        ...(profileDisplayName ? { profileDisplayName } : {}),
        ...(user.username ? { profileUsername: user.username } : {}),
        verifiedAt: user.createdAt,
        lastAuthenticatedAt: user.updatedAt,
      },
    });
  }

  listUsersWithTelegramId(cursor: string | undefined, take: number, onlyUserIds?: string[]) {
    return this.prisma.user.findMany({
      where: {
        telegramId: { not: null },
        ...(onlyUserIds ? { id: { in: onlyUserIds } } : {}),
      },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        lastName: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
