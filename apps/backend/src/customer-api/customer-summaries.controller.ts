import { Controller, Get, HttpCode, HttpStatus, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ActiveAccountGuard } from '../customer-auth/active-account.guard.js';
import { CurrentCustomer } from '../customer-auth/current-customer.decorator.js';
import { CustomerAuthGuard } from '../customer-auth/customer-auth.guard.js';
import type { CustomerJwtPayload } from '../customer-auth/customer-session-types.js';
import { SummaryService } from '../summaries/summary.service.js';

@ApiTags('Customer Summaries')
@Controller('api/v1/summaries')
@UseGuards(CustomerAuthGuard, ActiveAccountGuard)
@ApiBearerAuth()
export class CustomerSummariesController {
  constructor(@Inject(SummaryService) private readonly summaryService: SummaryService) {}

  @Get('today')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get today financial summary metrics' })
  @ApiResponse({
    status: 200,
    description: 'Returns daily totals, net balance, and transaction count',
  })
  async getTodaySummary(@CurrentCustomer() customer: CustomerJwtPayload) {
    const summary = await this.summaryService.get(customer.sub, 'today');
    return {
      period: 'today',
      totalIncomeCents: Number(summary.incomeCents),
      totalExpenseCents: Number(summary.expenseCents),
      netBalanceCents: Number(summary.netCents),
      transactionCount: summary.transactionCount,
    };
  }

  @Get('week')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current week financial summary metrics' })
  async getWeekSummary(@CurrentCustomer() customer: CustomerJwtPayload) {
    const summary = await this.summaryService.get(customer.sub, 'week');
    return {
      period: 'week',
      totalIncomeCents: Number(summary.incomeCents),
      totalExpenseCents: Number(summary.expenseCents),
      netBalanceCents: Number(summary.netCents),
      transactionCount: summary.transactionCount,
    };
  }

  @Get('month')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current month financial summary metrics' })
  async getMonthSummary(@CurrentCustomer() customer: CustomerJwtPayload) {
    const summary = await this.summaryService.get(customer.sub, 'month');
    return {
      period: 'month',
      totalIncomeCents: Number(summary.incomeCents),
      totalExpenseCents: Number(summary.expenseCents),
      netBalanceCents: Number(summary.netCents),
      transactionCount: summary.transactionCount,
    };
  }
}
