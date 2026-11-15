import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class CategoryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Get all existing category labels for a user, ordered by usage frequency */
  async getUserCategories(userId: string): Promise<{ label: string; type: string }[]> {
    return this.prisma.userCategory.findMany({
      where: { userId },
      select: { label: true, type: true },
      orderBy: [{ usedCount: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /** Upsert a category — create if new, increment usedCount if existing */
  async upsertAndIncrement(
    userId: string,
    label: string,
    type: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    await db.userCategory.upsert({
      where: { userId_label: { userId, label } },
      create: { userId, label, type, usedCount: 1 },
      update: { usedCount: { increment: 1 } },
    });
  }

  /** Rename a category label for ALL of a user's transactions */
  async renameCategory(userId: string, oldLabel: string, newLabel: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.transaction.updateMany({
        where: { userId, category: oldLabel },
        data: { category: newLabel },
      }),
      this.prisma.userCategory.update({
        where: { userId_label: { userId, label: oldLabel } },
        data: { label: newLabel },
      }),
    ]);
  }
}
