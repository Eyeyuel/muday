import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ActiveAccountGuard } from '../customer-auth/active-account.guard.js';
import { CurrentCustomer } from '../customer-auth/current-customer.decorator.js';
import { CustomerAuthGuard } from '../customer-auth/customer-auth.guard.js';
import type { CustomerJwtPayload } from '../customer-auth/customer-session-types.js';
import { PrismaService } from '../database/prisma.service.js';

import { IsBoolean, IsOptional, IsString } from 'class-validator';

class UpdateNotificationSettingsDto {
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

  @IsString()
  @IsOptional()
  expectedUpdatedAt?: string;
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

@ApiTags('Customer Settings')
@Controller('api/v1/me/settings/notifications')
@UseGuards(CustomerAuthGuard, ActiveAccountGuard)
@ApiBearerAuth()
export class CustomerSettingsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get notification settings for current customer' })
  @ApiResponse({ status: 200, description: 'Returns user notification settings' })
  async getSettings(@CurrentCustomer() customer: CustomerJwtPayload) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: customer.sub } });
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
  @ApiOperation({ summary: 'Update notification settings with optimistic concurrency check' })
  @ApiResponse({ status: 200, description: 'Returns updated notification settings' })
  async updateSettings(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() body: UpdateNotificationSettingsDto,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: customer.sub } });

    if (body.expectedUpdatedAt && user.updatedAt.toISOString() !== body.expectedUpdatedAt) {
      throw new ConflictException({
        statusCode: 409,
        errorCode: 'SETTINGS_CONFLICT',
        message: 'Settings have been updated by another session. Please reload and try again.',
      });
    }

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
      where: { id: customer.sub },
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
