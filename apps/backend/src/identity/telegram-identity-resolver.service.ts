import { Inject, Injectable } from '@nestjs/common';

import { AllowedEventType, analyticsEventData } from '../analytics/analytics-event.js';
import { Prisma, type User } from '../generated/prisma/client.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import { IdentityError } from './identity.errors.js';
import { IdentityRepository } from './identity.repository.js';
import type {
  TelegramIdentityBinding,
  TelegramIdentityProfile,
  TelegramIdentityResolution,
} from './identity.types.js';

const MAX_RESOLVE_ATTEMPTS = 12;

@Injectable()
export class TelegramIdentityResolver {
  constructor(
    @Inject(IdentityRepository) private readonly identities: IdentityRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  async resolve(binding: TelegramIdentityBinding): Promise<TelegramIdentityResolution> {
    this.validate(binding);
    for (let attempt = 1; attempt <= MAX_RESOLVE_ATTEMPTS; attempt += 1) {
      try {
        return await this.identities.prisma.$transaction(
          (database) => this.resolveInTransaction(binding, database),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof IdentityError) {
          await this.recordConflict(binding, error.code);
          throw error;
        }
        if (!this.isRetryable(error) || attempt === MAX_RESOLVE_ATTEMPTS) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 20 + Math.floor(Math.random() * 40)),
        );
      }
    }
    throw new IdentityError('identity_conflict', 'Telegram identity resolution did not converge');
  }

  private async resolveInTransaction(
    binding: TelegramIdentityBinding,
    database: Prisma.TransactionClient,
  ): Promise<TelegramIdentityResolution> {
    const candidates = await this.identities.findTelegramCandidates(
      binding.telegramUserId,
      database,
    );
    const legacyUser = await this.identities.findLegacyTelegramUser(
      binding.telegramUserId,
      database,
    );
    if (candidates.length > 1) this.conflict('Multiple Telegram identity rows matched');

    const identity = candidates[0];
    if (identity) {
      if (
        identity.providerSubject !== binding.telegramUserId.toString() ||
        identity.telegramUserId !== binding.telegramUserId ||
        (identity.oidcSubject !== null &&
          binding.oidcSubject !== undefined &&
          identity.oidcSubject !== binding.oidcSubject)
      ) {
        this.conflict('Telegram identity fields disagree');
      }
      if (legacyUser && legacyUser.id !== identity.userId) {
        this.conflict('Telegram identity and compatibility user disagree');
      }
      const user = await database.user.findUnique({ where: { id: identity.userId } });
      if (!user) throw new IdentityError('identity_not_found', 'Identity owner does not exist');
      if (user.telegramId !== binding.telegramUserId) {
        this.conflict('Identity owner compatibility value disagrees');
      }
      this.assertUsable(user);
      const updatedUser = await this.updateVerifiedProfile(user, binding.profile, database);
      const updatedIdentity = await database.userIdentity.update({
        where: { id: identity.id },
        data: {
          verifiedAt: binding.authenticatedAt ?? new Date(),
          lastAuthenticatedAt: binding.authenticatedAt ?? new Date(),
          ...(binding.oidcSubject !== undefined && identity.oidcSubject === null
            ? { oidcSubject: binding.oidcSubject }
            : {}),
          ...this.identityProfile(binding.profile),
        },
      });
      return { user: updatedUser, identity: updatedIdentity, created: false };
    }

    if (legacyUser) {
      this.assertUsable(legacyUser);
      this.logger.warn('Telegram identity dual-read mismatch detected', {
        mismatchType: 'identity_missing_for_compatibility_user',
        userId: legacyUser.id,
        channel: binding.channel,
      });
      const updatedUser = await this.updateVerifiedProfile(legacyUser, binding.profile, database);
      const createdIdentity = await this.identities.createTelegramIdentity(updatedUser, database);
      const updatedIdentity = await database.userIdentity.update({
        where: { id: createdIdentity.id },
        data: {
          lastAuthenticatedAt: binding.authenticatedAt ?? new Date(),
          ...(binding.oidcSubject !== undefined ? { oidcSubject: binding.oidcSubject } : {}),
          ...this.identityProfile(binding.profile),
        },
      });
      await database.identityLinkEvent.create({
        data: {
          userId: updatedUser.id,
          identityId: updatedIdentity.id,
          eventType: 'CREATED',
          channel: binding.channel,
          ...(binding.correlationId ? { correlationId: binding.correlationId } : {}),
          metadata: { source: 'compatibility_resolution', version: 1 },
        },
      });
      return { user: updatedUser, identity: updatedIdentity, created: false };
    }

    const user = await database.user.create({
      data: { telegramId: binding.telegramUserId, ...this.userProfile(binding.profile) },
    });
    const createdIdentity = await this.identities.createTelegramIdentity(user, database);
    const updatedIdentity = await database.userIdentity.update({
      where: { id: createdIdentity.id },
      data: {
        verifiedAt: binding.authenticatedAt ?? new Date(),
        lastAuthenticatedAt: binding.authenticatedAt ?? new Date(),
        ...(binding.oidcSubject !== undefined ? { oidcSubject: binding.oidcSubject } : {}),
        ...this.identityProfile(binding.profile),
      },
    });
    await Promise.all([
      database.event.create({
        data: { userId: user.id, ...analyticsEventData(AllowedEventType.SIGNUP) },
      }),
      database.identityLinkEvent.create({
        data: {
          userId: user.id,
          identityId: updatedIdentity.id,
          eventType: 'CREATED',
          channel: binding.channel,
          ...(binding.correlationId ? { correlationId: binding.correlationId } : {}),
          metadata: { source: 'verified_telegram_resolution', version: 1 },
        },
      }),
    ]);
    return { user, identity: updatedIdentity, created: true };
  }

  private async updateVerifiedProfile(
    user: User,
    profile: TelegramIdentityProfile | undefined,
    database: Prisma.TransactionClient,
  ): Promise<User> {
    const data = this.userProfile(profile);
    if (Object.keys(data).length === 0) return user;
    return database.user.update({ where: { id: user.id }, data });
  }

  private userProfile(profile?: TelegramIdentityProfile) {
    if (!profile) return {};
    return {
      ...(profile.firstName !== undefined ? { firstName: this.clean(profile.firstName, 120) } : {}),
      ...(profile.lastName !== undefined ? { lastName: this.clean(profile.lastName, 120) } : {}),
      ...(profile.username !== undefined ? { username: this.clean(profile.username, 120) } : {}),
    };
  }

  private identityProfile(profile?: TelegramIdentityProfile) {
    if (!profile) return {};
    const explicitDisplayName = this.clean(profile.displayName, 160);
    const derivedDisplayName = [profile.firstName, profile.lastName]
      .map((part) => this.clean(part, 120))
      .filter((part): part is string => part !== null)
      .join(' ')
      .trim();
    return {
      ...(profile.displayName !== undefined || derivedDisplayName
        ? { profileDisplayName: explicitDisplayName ?? (derivedDisplayName || null) }
        : {}),
      ...(profile.username !== undefined
        ? { profileUsername: this.clean(profile.username, 120) }
        : {}),
      ...(profile.pictureUrl !== undefined
        ? { profilePictureUrl: this.clean(profile.pictureUrl, 2048) }
        : {}),
    };
  }

  private clean(value: string | null | undefined, max: number): string | null {
    if (value === null || value === undefined) return null;
    const cleaned = value.trim();
    return cleaned ? cleaned.slice(0, max) : null;
  }

  private validate(binding: TelegramIdentityBinding): void {
    if (binding.telegramUserId <= 0n || binding.telegramUserId > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new IdentityError('identity_invalid', 'Invalid Telegram identity subject');
    }
    if (binding.oidcSubject !== undefined && !binding.oidcSubject.trim()) {
      throw new IdentityError('identity_invalid', 'Invalid Telegram OIDC subject');
    }
  }

  private assertUsable(user: User): void {
    if (user.status === 'DELETED' || user.deletedAt !== null) {
      throw new IdentityError('identity_not_found', 'Deleted account cannot be resolved');
    }
  }

  private conflict(message: string): never {
    throw new IdentityError('identity_conflict', message);
  }

  private isRetryable(error: unknown): boolean {
    const prismaCode =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'P2002' || error.code === 'P2034');
    const cause =
      error instanceof Error && 'cause' in error
        ? error.cause instanceof Error
          ? error.cause.message
          : typeof error.cause === 'string'
            ? error.cause
            : ''
        : '';
    const text = error instanceof Error ? `${error.message} ${cause}` : '';
    const adapterConflict = /TransactionWriteConflict|write conflict|deadlock/i.test(text);
    return Boolean(prismaCode || adapterConflict);
  }

  private async recordConflict(binding: TelegramIdentityBinding, code: string): Promise<void> {
    this.logger.warn('Telegram identity resolution rejected', { code, channel: binding.channel });
    if (code !== 'identity_conflict') return;
    await this.identities.prisma.identityLinkEvent
      .create({
        data: {
          eventType: 'CONFLICT',
          channel: binding.channel,
          ...(binding.correlationId ? { correlationId: binding.correlationId } : {}),
          metadata: { code, version: 1 },
        },
      })
      .catch(() => undefined);
  }
}
