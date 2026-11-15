import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';

import type { Environment } from '../src/config/environment.js';
import { TelegramProfileController } from '../src/telegram/telegram-profile.controller.js';
import { TelegramProfileService } from '../src/telegram/telegram-profile.service.js';
import type { TelegramTransport } from '../src/telegram/transport/telegram-transport.interface.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import type { UsersService } from '../src/users/users.service.js';
import type { Response } from 'express';

describe('TelegramProfileService', () => {
  it('returns null when user has no profile photo', async () => {
    const config = {
      get: vi.fn().mockReturnValue('mock-bot-token'),
    } as unknown as ConfigService<Environment, true>;

    const getUserProfilePhotos = vi.fn().mockResolvedValue({ totalCount: 0, photos: [] });
    const transport: TelegramTransport = {
      setUpdateHandler: vi.fn(),
      sendMessage: vi.fn(),
      editMessageText: vi.fn(),
      answerCallbackQuery: vi.fn(),
      getFile: vi.fn(),
      getUserProfilePhotos,
      start: vi.fn(),
      stop: vi.fn(),
    };

    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    } as unknown as StructuredLogger;

    const service = new TelegramProfileService(config, transport, logger);
    const result = await service.getProfilePhoto(123456);

    expect(result).toBeNull();
    expect(getUserProfilePhotos).toHaveBeenCalledWith(123456);
  });

  it('uses the highest-resolution Telegram photo variant', async () => {
    const config = { get: vi.fn().mockReturnValue('mock-bot-token') } as unknown as ConfigService<
      Environment,
      true
    >;
    const getFile = vi.fn().mockResolvedValue({ filePath: 'photos/avatar.jpg' });
    const transport = {
      setUpdateHandler: vi.fn(),
      sendMessage: vi.fn(),
      answerCallbackQuery: vi.fn(),
      getFile,
      getUserProfilePhotos: vi.fn().mockResolvedValue({
        totalCount: 1,
        photos: [[{ fileId: 'small' }, { fileId: 'large' }]],
      }),
      start: vi.fn(),
      stop: vi.fn(),
    } as unknown as TelegramTransport;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }),
    );
    const service = new TelegramProfileService(config, transport, {
      warn: vi.fn(),
    } as unknown as StructuredLogger);

    await expect(service.getProfilePhoto(123456)).resolves.toMatchObject({
      contentType: 'image/jpeg',
    });
    expect(getFile).toHaveBeenCalledWith('large');
  });
});

describe('TelegramProfileController', () => {
  it('serves the authenticated Mini App user photo with private caching', async () => {
    const getProfilePhoto = vi.fn().mockResolvedValue({
      buffer: Buffer.from('photo'),
      contentType: 'image/jpeg',
    });
    const profileService = {
      getProfilePhoto,
    } as unknown as TelegramProfileService;
    const controller = new TelegramProfileController(profileService, {} as UsersService);
    const setHeader = vi.fn();
    const send = vi.fn();
    const response = { setHeader, send } as unknown as Response;

    await controller.getOwnPhoto({ miniAppUser: { telegramId: 123456n } } as never, response);

    expect(getProfilePhoto).toHaveBeenCalledWith(123456);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=3600');
    expect(send).toHaveBeenCalledWith(Buffer.from('photo'));
  });

  it('resolves an admin photo by internal user id instead of a client-supplied Telegram id', async () => {
    const getProfilePhoto = vi.fn().mockResolvedValue({
      buffer: Buffer.from('photo'),
      contentType: 'image/jpeg',
    });
    const profileService = {
      getProfilePhoto,
    } as unknown as TelegramProfileService;
    const findById = vi.fn().mockResolvedValue({ telegramId: 987654n });
    const users = {
      findById,
    } as unknown as UsersService;
    const controller = new TelegramProfileController(profileService, users);
    const response = { setHeader: vi.fn(), send: vi.fn() } as unknown as Response;

    await controller.getAdminUserPhoto('internal-user-id', response);

    expect(findById).toHaveBeenCalledWith('internal-user-id');
    expect(getProfilePhoto).toHaveBeenCalledWith(987654);
  });
});
