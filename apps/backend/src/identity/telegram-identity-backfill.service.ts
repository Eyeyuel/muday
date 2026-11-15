import { Inject, Injectable } from '@nestjs/common';

import { IdentityRepository } from './identity.repository.js';
import type { IdentityBackfillConflict, IdentityBackfillResult } from './identity.types.js';

export interface IdentityBackfillOptions {
  dryRun: boolean;
  batchSize?: number | undefined;
  onlyUserIds?: string[] | undefined;
}

@Injectable()
export class TelegramIdentityBackfillService {
  constructor(@Inject(IdentityRepository) private readonly identities: IdentityRepository) {}

  async run(options: IdentityBackfillOptions): Promise<IdentityBackfillResult> {
    const batchSize = options.batchSize ?? 200;
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
      throw new Error('Identity backfill batch size must be between 1 and 1000');
    }

    const result: IdentityBackfillResult = {
      dryRun: options.dryRun,
      examined: 0,
      eligible: 0,
      wouldCreate: 0,
      created: 0,
      existing: 0,
      conflicts: [],
    };
    let cursor: string | undefined;

    while (true) {
      const users = await this.identities.listUsersWithTelegramId(
        cursor,
        batchSize,
        options.onlyUserIds,
      );
      if (users.length === 0) break;
      for (const user of users) {
        result.examined += 1;
        if (user.telegramId === null) continue;
        result.eligible += 1;
        const state = await this.inspect(user.id, user.telegramId);
        if (state === 'existing') {
          result.existing += 1;
          continue;
        }
        if (state) {
          result.conflicts.push(state);
          continue;
        }
        if (options.dryRun) {
          result.wouldCreate += 1;
          continue;
        }
        const applied = await this.createSafely(user);
        if (applied === 'created') result.created += 1;
        else if (applied === 'existing') result.existing += 1;
        else result.conflicts.push(applied);
      }
      cursor = users.at(-1)?.id;
      if (users.length < batchSize) break;
    }
    return result;
  }

  private async inspect(
    userId: string,
    telegramId: bigint,
  ): Promise<'existing' | IdentityBackfillConflict | undefined> {
    const candidates = await this.identities.findTelegramCandidates(telegramId);
    if (candidates.length === 0) return undefined;
    if (candidates.some((identity) => identity.userId !== userId)) {
      return { userId, reason: 'identity_owned_by_another_user' };
    }
    if (
      candidates.length !== 1 ||
      candidates[0]?.providerSubject !== telegramId.toString() ||
      candidates[0]?.telegramUserId !== telegramId
    ) {
      return { userId, reason: 'identity_fields_inconsistent' };
    }
    return 'existing';
  }

  private async createSafely(
    user: Awaited<ReturnType<IdentityRepository['listUsersWithTelegramId']>>[number],
  ): Promise<'created' | 'existing' | IdentityBackfillConflict> {
    try {
      await this.identities.prisma.$transaction(async (database) => {
        const identity = await this.identities.createTelegramIdentity(user, database);
        await database.identityLinkEvent.create({
          data: {
            userId: user.id,
            identityId: identity.id,
            eventType: 'CREATED',
            channel: 'BACKFILL',
            metadata: { source: 'users.telegram_id', version: 1 },
          },
        });
      });
      return 'created';
    } catch (error) {
      if (!this.isUniqueConflict(error) || user.telegramId === null) throw error;
      const state = await this.inspect(user.id, user.telegramId);
      return state ?? { userId: user.id, reason: 'identity_fields_inconsistent' };
    }
  }

  private isUniqueConflict(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
