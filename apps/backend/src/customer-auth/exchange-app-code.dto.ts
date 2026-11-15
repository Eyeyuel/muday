import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class ExchangeAppCodeDto {
  @ApiProperty({
    description: '6-character alphanumeric code from the Telegram bot',
    example: 'aB3kX9',
  })
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 characters' })
  @Matches(/^[A-Za-z0-9]{6}$/, {
    message: 'Code must be alphanumeric (letters and numbers only)',
  })
  code!: string;

  @ApiPropertyOptional({
    description: 'Optional device label',
    example: 'My Pixel 9',
  })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'App version string', example: '1.0.0' })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiPropertyOptional({ enum: ['FLUTTER_ANDROID', 'FLUTTER_IOS', 'WEB'] })
  @IsOptional()
  @IsIn(['FLUTTER_ANDROID', 'FLUTTER_IOS', 'WEB'])
  clientType?: 'FLUTTER_ANDROID' | 'FLUTTER_IOS' | 'WEB';
}
