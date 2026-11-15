import type { IdentityChannel, User, UserIdentity } from '../generated/prisma/client.js';

export interface TelegramIdentityProfile {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  displayName?: string | null | undefined;
  username?: string | null | undefined;
  pictureUrl?: string | null | undefined;
}

export interface TelegramIdentityResolution {
  user: User;
  identity: UserIdentity;
  created: boolean;
}

export interface TelegramIdentityBinding {
  telegramUserId: bigint;
  oidcSubject?: string | undefined;
  channel: IdentityChannel;
  profile?: TelegramIdentityProfile | undefined;
  authenticatedAt?: Date | undefined;
  correlationId?: string | undefined;
}

export interface IdentityBackfillConflict {
  userId: string;
  reason: 'identity_owned_by_another_user' | 'identity_fields_inconsistent';
}

export interface IdentityBackfillResult {
  dryRun: boolean;
  examined: number;
  eligible: number;
  wouldCreate: number;
  created: number;
  existing: number;
  conflicts: IdentityBackfillConflict[];
}
