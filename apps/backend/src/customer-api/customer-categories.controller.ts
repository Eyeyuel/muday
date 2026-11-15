import { Controller, Get, HttpCode, HttpStatus, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CategoryRepository } from '../categories/category.repository.js';
import { CurrentCustomer } from '../customer-auth/current-customer.decorator.js';
import { CustomerAuthGuard } from '../customer-auth/customer-auth.guard.js';
import type { CustomerJwtPayload } from '../customer-auth/customer-session-types.js';

@ApiTags('Customer Categories')
@Controller('api/v1/categories')
@UseGuards(CustomerAuthGuard)
@ApiBearerAuth()
export class CustomerCategoriesController {
  constructor(
    @Inject(CategoryRepository) private readonly categoryRepository: CategoryRepository,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all categories for the authenticated user' })
  async listCategories(@CurrentCustomer() customer: CustomerJwtPayload) {
    return this.categoryRepository.getUserCategories(customer.sub);
  }
}
