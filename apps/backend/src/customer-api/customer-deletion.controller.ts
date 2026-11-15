import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentCustomer } from '../customer-auth/current-customer.decorator.js';
import { CustomerAuthGuard } from '../customer-auth/customer-auth.guard.js';
import type { CustomerJwtPayload } from '../customer-auth/customer-session-types.js';
import { DeletionService } from '../deletion/deletion.service.js';

class DeleteAccountDto {
  confirm!: boolean;
}

@ApiTags('Customer Account Deletion')
@Controller('api/v1/me')
@UseGuards(CustomerAuthGuard)
@ApiBearerAuth()
export class CustomerDeletionController {
  constructor(@Inject(DeletionService) private readonly deletionService: DeletionService) {}

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete customer account and financial records' })
  @ApiResponse({
    status: 200,
    description: 'Account permanently deleted and all active sessions revoked',
  })
  async deleteAccount(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() body: DeleteAccountDto,
  ) {
    if (!body || body.confirm !== true) {
      throw new BadRequestException(
        'Explicit confirmation (confirm: true) is required to delete account',
      );
    }

    const result = await this.deletionService.deleteByUserId(customer.sub, true);
    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return result;
  }
}
