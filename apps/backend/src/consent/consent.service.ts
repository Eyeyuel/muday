import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { ConsentRepository } from './consent.repository.js';

@Injectable()
export class ConsentService {
  readonly version: string;

  constructor(
    @Inject(ConsentRepository) private readonly consent: ConsentRepository,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.version = config.get('CONSENT_VERSION', { infer: true });
  }

  createInteraction(userId: string, sourceUpdateId: number) {
    return this.consent.createInteraction(userId, this.version, sourceUpdateId);
  }

  acceptByUserId(interactionId: string, userId: string) {
    return this.consent.acceptByUserId(interactionId, userId, this.version);
  }

  accept(interactionId: string, telegramId: number) {
    return this.consent.accept(interactionId, telegramId, this.version);
  }

  acceptDirectly(userId: string) {
    return this.consent.acceptDirectly(userId, this.version);
  }

  isActive(user: { status: string; consentVersion: string | null; consentAt: Date | null } | null) {
    return Boolean(
      user?.status === 'ACTIVE' && user.consentVersion === this.version && user.consentAt,
    );
  }
}
