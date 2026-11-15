import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import { I18nService, type Locale } from '../i18n/i18n.service.js';
import type { TelegramInlineButton } from '../telegram/transport/telegram-transport.interface.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { UsersService } from '../users/users.service.js';
import { DeletionQueueService } from './deletion-queue.service.js';
import type { DeletionAction } from './deletion.types.js';

@Injectable()
export class DeletionService {
  private readonly policyVersion: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(DeletionQueueService) private readonly queues: DeletionQueueService,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.policyVersion = config.get('DELETION_POLICY_VERSION', { infer: true });
  }

  async request(telegramId: number, chatId: number): Promise<boolean> {
    const user = await this.users.findByTelegramId(telegramId);
    const locale = this.locale(user?.language);
    if (!user) {
      await this.send(chatId, 'deletion.no_data', locale);
      return false;
    }
    if (user.status === 'DELETING') {
      await this.finalize(user, chatId);
      await this.send(chatId, 'deletion.completed', locale).catch(() => undefined);
      return true;
    }
    const interaction = await this.createInteraction(user.id, 'CONFIRM_DELETE_STEP_1');
    await this.transport.sendMessage(chatId, this.i18n.translate('deletion.prompt_1', locale), {
      inlineKeyboard: this.stepOneButtons(interaction.id, locale),
    });
    return false;
  }

  async handle(
    interactionId: string,
    action: DeletionAction,
    telegramId: number,
    chatId: number,
    updateId: number,
  ): Promise<boolean> {
    const user = await this.users.findByTelegramId(telegramId);
    const locale = this.locale(user?.language);
    if (!user) {
      await this.prisma.processedUpdate.deleteMany({
        where: { telegramUpdateId: BigInt(updateId) },
      });
      await this.send(chatId, 'deletion.already_completed', locale);
      return true;
    }
    const interaction = await this.prisma.pendingInteraction.findFirst({
      where: { id: interactionId, userId: user.id, state: 'PENDING' },
    });
    if (!interaction || interaction.expiresAt <= new Date()) {
      if (interaction) {
        await this.prisma.pendingInteraction.update({
          where: { id: interaction.id },
          data: { state: 'EXPIRED', resolvedAt: new Date() },
        });
      }
      await this.send(chatId, 'deletion.expired_or_used', locale);
      return false;
    }
    if (action === 'cancel') {
      await this.resolveInteraction(interaction.id, 'CANCELLED');
      await this.send(chatId, 'deletion.cancelled', locale);
      return false;
    }
    if (action === 'continue' && interaction.kind === 'CONFIRM_DELETE_STEP_1') {
      const next = await this.prisma.$transaction(async (database) => {
        await database.pendingInteraction.update({
          where: { id: interaction.id },
          data: { state: 'RESOLVED', resolvedAt: new Date() },
        });
        return database.pendingInteraction.create({
          data: {
            userId: user.id,
            kind: 'CONFIRM_DELETE_STEP_2',
            payload: {},
            expiresAt: new Date(Date.now() + 10 * 60_000),
          },
        });
      });
      await this.transport.sendMessage(chatId, this.i18n.translate('deletion.prompt_2', locale), {
        inlineKeyboard: this.stepTwoButtons(next.id, locale),
      });
      return false;
    }
    if (action !== 'permanent' || interaction.kind !== 'CONFIRM_DELETE_STEP_2') {
      await this.send(chatId, 'deletion.expired_or_used', locale);
      return false;
    }

    const claimed =
      user.status === 'DELETING'
        ? { count: 1 }
        : await this.prisma.user.updateMany({
            where: { id: user.id, status: { in: ['ACTIVE', 'PENDING_CONSENT'] } },
            data: { status: 'DELETING' },
          });
    if (claimed.count !== 1) {
      await this.send(chatId, 'deletion.in_progress', locale);
      return false;
    }

    // Revoke all active customer sessions immediately upon deletion start
    await this.prisma.customerSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'USER_DELETING' },
    });

    await this.finalize(user, chatId, updateId);
    await this.send(chatId, 'deletion.completed', locale).catch(() => undefined);
    return true;
  }

  async deleteByUserId(
    userId: string,
    confirm: boolean,
  ): Promise<{ success: boolean; message: string }> {
    if (!confirm) {
      return {
        success: false,
        message: 'Explicit confirmation (confirm: true) is required to delete account',
      };
    }

    const user = await this.users.findById(userId);
    if (!user) {
      return { success: false, message: 'User account not found or already deleted' };
    }

    if (user.status === 'DELETED' || user.deletedAt) {
      return { success: false, message: 'User account is already deleted' };
    }

    const claimed =
      user.status === 'DELETING'
        ? { count: 1 }
        : await this.prisma.user.updateMany({
            where: { id: user.id, status: { in: ['ACTIVE', 'PENDING_CONSENT'] } },
            data: { status: 'DELETING' },
          });

    if (claimed.count !== 1 && user.status !== 'DELETING') {
      return { success: false, message: 'Deletion in progress' };
    }

    await this.prisma.customerSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'USER_DELETED' },
    });

    await this.queues.removeForUser(user.id).catch(() => undefined);
    await rm(resolve('.local/media/receipts', user.id), { recursive: true, force: true }).catch(
      () => undefined,
    );
    await this.prisma.$transaction(async (database) => {
      await database.deletionAudit.create({
        data: {
          deletionPolicyVersion: this.policyVersion,
          consentVersionWithdrawn: user.consentVersion,
          result: 'soft_deleted',
        },
      });
      await database.pendingInteraction.updateMany({
        where: { userId: user.id, state: 'PENDING' },
        data: { state: 'CANCELLED', resolvedAt: new Date() },
      });
      await database.user.update({
        where: { id: user.id },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          appCodeHash: null,
          appCodePrefix: null,
        },
      });
    });

    return {
      success: true,
      message: 'Account successfully deactivated and soft deleted',
    };
  }

  private async finalize(
    user: { id: string; consentVersion: string | null },
    chatId: number,
    updateId?: number,
  ): Promise<void> {
    void chatId;
    void updateId;
    await this.queues.removeForUser(user.id).catch(() => undefined);
    await rm(resolve('.local/media/receipts', user.id), { recursive: true, force: true }).catch(
      () => undefined,
    );
    await this.prisma.$transaction(async (database) => {
      await database.deletionAudit.create({
        data: {
          deletionPolicyVersion: this.policyVersion,
          consentVersionWithdrawn: user.consentVersion,
          result: 'soft_deleted',
        },
      });
      await database.pendingInteraction.updateMany({
        where: { userId: user.id, state: 'PENDING' },
        data: { state: 'CANCELLED', resolvedAt: new Date() },
      });
      await database.user.update({
        where: { id: user.id },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          appCodeHash: null,
          appCodePrefix: null,
        },
      });
    });
  }

  private async createInteraction(
    userId: string,
    kind: 'CONFIRM_DELETE_STEP_1' | 'CONFIRM_DELETE_STEP_2',
  ) {
    return this.prisma.$transaction(async (database) => {
      await database.pendingInteraction.updateMany({
        where: { userId, state: 'PENDING' },
        data: { state: 'CANCELLED', resolvedAt: new Date() },
      });
      return database.pendingInteraction.create({
        data: { userId, kind, payload: {}, expiresAt: new Date(Date.now() + 10 * 60_000) },
      });
    });
  }

  private resolveInteraction(id: string, state: 'CANCELLED' | 'RESOLVED') {
    return this.prisma.pendingInteraction.update({
      where: { id },
      data: { state, resolvedAt: new Date() },
    });
  }

  private locale(language?: string): Locale {
    return language === 'EN' ? 'en' : 'am';
  }

  private stepOneButtons(id: string, locale: Locale): TelegramInlineButton[][] {
    return [
      [
        {
          text: this.i18n.translate('button.continue_deletion', locale),
          callbackData: `delete:${id}:continue`,
        },
        { text: this.i18n.translate('button.cancel', locale), callbackData: `delete:${id}:cancel` },
      ],
    ];
  }

  private stepTwoButtons(id: string, locale: Locale): TelegramInlineButton[][] {
    return [
      [
        {
          text: this.i18n.translate('button.permanently_delete', locale),
          callbackData: `delete:${id}:permanent`,
        },
        { text: this.i18n.translate('button.cancel', locale), callbackData: `delete:${id}:cancel` },
      ],
    ];
  }

  private send(chatId: number, key: Parameters<I18nService['translate']>[0], locale: Locale) {
    return this.transport.sendMessage(chatId, this.i18n.translate(key, locale));
  }
}
