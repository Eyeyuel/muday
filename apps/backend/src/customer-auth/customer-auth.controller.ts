import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

import type { Environment } from '../config/environment.js';
import { AppCodeService } from './app-code.service.js';
import { CurrentCustomer } from './current-customer.decorator.js';
import { CustomerAuthGuard } from './customer-auth.guard.js';
import { CustomerSessionService } from './customer-session.service.js';
import type { CustomerJwtPayload, RefreshSessionDto } from './customer-session-types.js';
import { ExchangeAppCodeDto } from './exchange-app-code.dto.js';

@ApiTags('Customer Authentication')
@Controller('api/v1/auth')
export class CustomerAuthController {
  private readonly enabled: boolean;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(AppCodeService) private readonly appCodeService: AppCodeService,
    @Inject(CustomerSessionService) private readonly sessionService: CustomerSessionService,
  ) {
    this.enabled = config.get('CUSTOMER_AUTH_ENABLED', { infer: true });
  }

  private ensureEnabled(): void {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Customer authentication is currently disabled');
    }
  }

  @Post('code')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange bot-issued pairing code for session tokens' })
  @ApiBody({ type: ExchangeAppCodeDto })
  @ApiResponse({
    status: 200,
    description: 'Returns access token, refresh token, and user profile',
  })
  @ApiResponse({ status: 400, description: 'Invalid code format' })
  @ApiResponse({ status: 401, description: 'Invalid or expired code' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async exchangeAppCode(@Body() body: ExchangeAppCodeDto, @Req() req: Request) {
    this.ensureEnabled();
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const userId = await this.appCodeService.verifyAndGetUserId(body.code, ip);
    return this.sessionService.createSession({
      userId,
      identityId: null,
      ...(body.clientType ? { clientType: body.clientType } : {}),
      ...(body.deviceName ? { deviceName: body.deviceName } : {}),
      ...(body.appVersion ? { appVersion: body.appVersion } : {}),
    });
  }

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate customer refresh token and get a new access token' })
  @ApiResponse({ status: 200, description: 'Returns rotated refresh token and new access token' })
  refreshToken(@Body() body: RefreshSessionDto) {
    this.ensureEnabled();
    return this.sessionService.refreshSession(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(CustomerAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke current customer session' })
  async logout(@CurrentCustomer() customer: CustomerJwtPayload) {
    const sid = customer.sid || customer.sessionId || '';
    await this.sessionService.revokeCurrentSession(sid);
    return { success: true, message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(CustomerAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions for current user' })
  async logoutAll(@CurrentCustomer() customer: CustomerJwtPayload) {
    await this.sessionService.revokeAllUserSessions(customer.sub);
    return { success: true, message: 'All sessions revoked successfully' };
  }

  @Get('sessions')
  @UseGuards(CustomerAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all active sessions for current user' })
  listSessions(@CurrentCustomer() customer: CustomerJwtPayload) {
    const sid = customer.sid || customer.sessionId;
    return this.sessionService.listUserSessions(customer.sub, sid);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(CustomerAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session by ID' })
  async revokeSession(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Param('sessionId') sessionId: string,
  ) {
    await this.sessionService.revokeSessionById(customer.sub, sessionId);
    return { success: true, message: 'Session revoked successfully' };
  }
}
