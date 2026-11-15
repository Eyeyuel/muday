export interface CustomerJwtPayload {
  sub: string; // Muday userId
  sid: string; // Muday sessionId
  sessionId?: string; // Compatibility alias
  identityId?: string | null;
  role: 'customer';
  iss: 'muday-api';
  aud: 'muday-customer';
  iat: number;
  exp: number;
}

export interface CustomerSessionResult {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    language: string;
    status: string;
    createdAt?: string;
  };
}

export interface RefreshSessionDto {
  refreshToken: string;
}

export interface SessionInfo {
  sessionId: string;
  clientType: string;
  deviceName?: string | null;
  appVersion?: string | null;
  lastUsedAt: string;
  createdAt: string;
  isCurrentSession?: boolean;
}
