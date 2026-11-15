import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ConsentService } from '../consent/consent.service.js';
import { CurrentCustomer } from '../customer-auth/current-customer.decorator.js';
import { CustomerAuthGuard } from '../customer-auth/customer-auth.guard.js';
import type { CustomerJwtPayload } from '../customer-auth/customer-session-types.js';
import { PrismaService } from '../database/prisma.service.js';
import { UsersService } from '../users/users.service.js';

import { IsIn, IsOptional, IsString } from 'class-validator';

class UpdateLanguageDto {
  @IsIn(['am', 'en'])
  language!: 'am' | 'en';
}

class AcceptConsentDto {
  @IsString()
  @IsOptional()
  interactionId?: string;

  @IsString()
  @IsOptional()
  version?: string;
}

@ApiTags('Customer Profile & Settings')
@Controller('api/v1/me')
@UseGuards(CustomerAuthGuard)
@ApiBearerAuth()
export class MeController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ConsentService) private readonly consentService: ConsentService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current customer profile' })
  @ApiResponse({ status: 200, description: 'Returns authenticated user profile' })
  async getProfile(@CurrentCustomer() customer: CustomerJwtPayload) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: customer.sub } });
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      language: user.language,
      status: user.status,
      consentVersion: user.consentVersion,
      consentAt: user.consentAt ? user.consentAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  @Patch('language')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update customer interface language preference' })
  async updateLanguage(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() body: UpdateLanguageDto,
  ) {
    if (!body.language || !['am', 'en'].includes(body.language)) {
      throw new BadRequestException('Language must be am or en');
    }
    await this.usersService.changeLanguageByUserId(customer.sub, body.language);
    return { success: true, language: body.language.toUpperCase() };
  }

  @Get('identities')
  @ApiOperation({ summary: 'Get safe user identities' })
  @ApiResponse({ status: 200, description: 'Returns list of verified identities' })
  async getIdentities(@CurrentCustomer() customer: CustomerJwtPayload) {
    const identities = await this.prisma.userIdentity.findMany({
      where: { userId: customer.sub },
      orderBy: { createdAt: 'asc' },
    });
    return identities.map((id) => ({
      id: id.id,
      provider: id.provider,
      providerSubject: id.providerSubject,
      profileDisplayName: id.profileDisplayName,
      profileUsername: id.profileUsername,
      verifiedAt: id.verifiedAt.toISOString(),
    }));
  }

  @Get('consent')
  @ApiOperation({ summary: 'Get current consent policy status and user acceptance' })
  @ApiResponse({ status: 200, description: 'Returns consent version and user status' })
  async getConsentStatus(@CurrentCustomer() customer: CustomerJwtPayload) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: customer.sub } });
    const userConsented = this.consentService.isActive(user);

    return {
      version: this.consentService.version,
      status: user.status,
      userConsented,
      consentAt: user.consentAt ? user.consentAt.toISOString() : null,
    };
  }

  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record terms and privacy policy consent for user' })
  async acceptConsent(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() body: AcceptConsentDto,
  ) {
    let result: string;
    if (body.interactionId && body.interactionId.trim() !== '') {
      result = await this.consentService.acceptByUserId(body.interactionId, customer.sub);
    } else {
      result = await this.consentService.acceptDirectly(customer.sub);
    }

    if (result === 'invalid' || result === 'outdated' || result === 'expired') {
      throw new BadRequestException(`Consent acceptance failed: ${result}`);
    }

    return { success: true, result };
  }
}
