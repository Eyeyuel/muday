export interface AuthenticatedMiniAppUser {
  userId: string;
  telegramId: bigint;
  mode: 'telegram' | 'development';
  locale: 'am' | 'en';
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}

export interface MiniAppAuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  miniAppUser: AuthenticatedMiniAppUser;
}
