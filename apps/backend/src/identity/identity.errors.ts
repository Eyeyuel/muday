export type IdentityErrorCode = 'identity_conflict' | 'identity_invalid' | 'identity_not_found';

export class IdentityError extends Error {
  constructor(
    readonly code: IdentityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'IdentityError';
  }
}
