import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AdminAuthGuard } from '../admin-auth/admin-auth.guard.js';
import { MiniAppAuthGuard } from '../miniapp-auth/miniapp-auth.guard.js';
import type { MiniAppAuthenticatedRequest } from '../miniapp-auth/miniapp-auth.types.js';
import { UsersService } from '../users/users.service.js';
import { TelegramProfileService } from './telegram-profile.service.js';

@Controller('api/telegram-profile')
export class TelegramProfileController {
  constructor(
    @Inject(TelegramProfileService) private readonly profileService: TelegramProfileService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  @Get('photo')
  @UseGuards(MiniAppAuthGuard)
  async getOwnPhoto(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.sendPhoto(request.miniAppUser.telegramId, response);
  }

  @Get('admin/users/:userId/photo')
  @UseGuards(AdminAuthGuard)
  async getAdminUserPhoto(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user?.telegramId) throw new NotFoundException('Profile photo not available');
    await this.sendPhoto(user.telegramId, response);
  }

  private async sendPhoto(telegramIdValue: bigint, response: Response): Promise<void> {
    const telegramId = Number(telegramIdValue);
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0)
      throw new NotFoundException('Profile photo not available');

    const photo = await this.profileService.getProfilePhoto(telegramId);
    if (!photo) {
      throw new NotFoundException('Profile photo not available');
    }

    response.setHeader('Content-Type', photo.contentType);
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(photo.buffer);
  }
}
