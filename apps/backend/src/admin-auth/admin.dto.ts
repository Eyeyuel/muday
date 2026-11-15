import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { FinancialEventKind, TransactionSource, UserStatus } from '../generated/prisma/client.js';

export class AdminLoginDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(256)
  password!: string;
}

export class AdminAnalyticsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  asOf?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  @IsBoolean()
  refresh?: boolean;
}

export class AdminDateQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  asOf?: string;
}

export class AdminPaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}

export class AdminUserSearchQueryDto extends AdminPaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class AdminUserIdDto {
  @IsUUID()
  userId!: string;
}

export class UpdateUserStatusDto {
  @IsIn([UserStatus.ACTIVE, UserStatus.PAUSED])
  status!: typeof UserStatus.ACTIVE | typeof UserStatus.PAUSED;
}

export class AdminTransactionQueryDto extends AdminPaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsEnum(FinancialEventKind)
  kind?: FinancialEventKind;

  @IsOptional()
  @IsEnum(TransactionSource)
  source?: TransactionSource;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  maxAmount?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsIn(['occurredAt', 'amountEtb', 'category', 'platform'])
  sortBy?: 'occurredAt' | 'amountEtb' | 'category' | 'platform' = 'occurredAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class AdminBankingAnalyticsQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'all'])
  timeRange?: '7d' | '30d' | '90d' | 'all' = '30d';
}
