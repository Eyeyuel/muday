import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { MiniAppAuthGuard } from '../miniapp-auth/miniapp-auth.guard.js';
import type { MiniAppAuthenticatedRequest } from '../miniapp-auth/miniapp-auth.types.js';
import { PrismaService } from '../database/prisma.service.js';

export class UpdateMiniAppSettingsDto {
  @IsBoolean()
  @IsOptional()
  morningReminderEnabled?: boolean;

  @IsString()
  @IsOptional()
  morningReminderTime?: string;

  @IsBoolean()
  @IsOptional()
  nightStatusEnabled?: boolean;

  @IsString()
  @IsOptional()
  nightStatusTime?: string;

  @IsBoolean()
  @IsOptional()
  weeklySummaryEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  monthlySummaryEnabled?: boolean;
}

const parseHourFromTimeString = (timeStr: string): number => {
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(timeStr.trim());
  if (!match || !match[1]) {
    throw new BadRequestException('Time must be in HH:MM or H format (e.g. 08:00 or 21:00)');
  }
  const hour = parseInt(match[1], 10);
  if (isNaN(hour) || hour < 0 || hour > 23) {
    throw new BadRequestException('Hour must be between 0 and 23');
  }
  return hour;
};

const formatHourToString = (date: Date): string => {
  const hour = date.getUTCHours();
  return `${hour.toString().padStart(2, '0')}:00`;
};

@ApiTags('MiniApp Settings')
@ApiSecurity('telegram-miniapp')
@UseGuards(MiniAppAuthGuard)
@Controller('api/settings')
export class MiniAppSettingsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get notification and reminder settings for the authenticated MiniApp user',
  })
  @ApiResponse({ status: 200, description: 'Returns current settings' })
  async getSettings(@Req() request: Request & MiniAppAuthenticatedRequest) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: request.miniAppUser.userId },
    });

    return {
      morningReminderEnabled: user.morningEnabled,
      morningReminderTime: formatHourToString(user.morningTime),
      nightStatusEnabled: user.nightEnabled,
      nightStatusTime: formatHourToString(user.nightTime),
      weeklySummaryEnabled: true,
      monthlySummaryEnabled: true,
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification and reminder settings for the MiniApp user' })
  @ApiResponse({ status: 200, description: 'Returns updated settings' })
  async updateSettings(
    @Req() request: Request & MiniAppAuthenticatedRequest,
    @Body() body: UpdateMiniAppSettingsDto,
  ) {
    const dataToUpdate: Record<string, unknown> = {};

    if (typeof body.morningReminderEnabled === 'boolean') {
      dataToUpdate.morningEnabled = body.morningReminderEnabled;
    }
    if (typeof body.nightStatusEnabled === 'boolean') {
      dataToUpdate.nightEnabled = body.nightStatusEnabled;
    }
    if (body.morningReminderTime) {
      const hour = parseHourFromTimeString(body.morningReminderTime);
      dataToUpdate.morningTime = new Date(Date.UTC(1970, 0, 1, hour));
    }
    if (body.nightStatusTime) {
      const hour = parseHourFromTimeString(body.nightStatusTime);
      dataToUpdate.nightTime = new Date(Date.UTC(1970, 0, 1, hour));
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: request.miniAppUser.userId },
      data: dataToUpdate,
    });

    return {
      morningReminderEnabled: updatedUser.morningEnabled,
      morningReminderTime: formatHourToString(updatedUser.morningTime),
      nightStatusEnabled: updatedUser.nightEnabled,
      nightStatusTime: formatHourToString(updatedUser.nightTime),
      weeklySummaryEnabled: true,
      monthlySummaryEnabled: true,
      updatedAt: updatedUser.updatedAt.toISOString(),
    };
  }
}
