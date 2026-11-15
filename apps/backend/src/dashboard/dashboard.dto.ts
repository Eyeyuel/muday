import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class DashboardQueryDto {
  @ApiProperty({ enum: ['today', 'week', 'month', 'all', 'custom'], example: 'month' })
  @IsIn(['today', 'week', 'month', 'all', 'custom'])
  period!: 'today' | 'week' | 'month' | 'all' | 'custom';

  @ApiPropertyOptional({ type: String, example: '2026-08-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ type: String, example: '2026-08-14' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ type: String, example: 'food_groceries' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ['text', 'voice', 'receipt'], example: 'text' })
  @IsOptional()
  @IsIn(['text', 'voice', 'receipt'])
  source?: 'text' | 'voice' | 'receipt';

  @ApiPropertyOptional({ type: String, example: 'lunch' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Number, example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ type: String, example: '2026-08-04T10:00:00.000Z' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class DashboardMoneyDto {
  @ApiProperty({ type: String, example: '15000.00' }) incomeEtb!: string;
  @ApiProperty({ type: String, example: '550.00' }) expenseEtb!: string;
  @ApiProperty({ type: String, example: '14450.00' }) netEtb!: string;
  @ApiProperty({ type: String, example: '15000.00' }) earnedIncomeEtb!: string;
  @ApiProperty({ type: String, example: '550.00' }) ordinaryExpenseEtb!: string;
  @ApiProperty({ type: String, example: '14450.00' }) earnedNetEtb!: string;
  @ApiProperty({ type: String, example: '20300.00' }) cashInflowEtb!: string;
  @ApiProperty({ type: String, example: '1550.00' }) cashOutflowEtb!: string;
  @ApiProperty({ type: String, example: '18750.00' }) cashFlowNetEtb!: string;
}

export class DashboardSpecialMovementDto {
  @ApiProperty({ enum: ['loan_received', 'loan_repayment', 'refund', 'reimbursement'] })
  kind!: 'loan_received' | 'loan_repayment' | 'refund' | 'reimbursement';
  @ApiProperty({ type: String, example: '5000.00' }) amountEtb!: string;
}

export class DashboardRangeDto {
  @ApiProperty({ type: String, example: '2026-08-03T21:00:00.000Z' }) start!: string;
  @ApiProperty({ type: String, example: '2026-08-10T21:00:00.000Z' }) end!: string;
}

export class DashboardCategoryDto {
  @ApiProperty({ type: String, example: 'food' }) category!: string;
  @ApiProperty({ type: String, example: '250.00' }) amountEtb!: string;
  @ApiProperty({ type: Number, example: 45.45 }) percentage!: number;
}

export class DashboardTransactionDto {
  @ApiProperty({ type: String, example: 'b6f2b5a1-4321-4f1a-b333-123456789abc' }) id!: string;
  @ApiProperty({
    enum: ['income', 'expense', 'loan_received', 'loan_repayment', 'refund', 'reimbursement'],
  })
  kind!: 'income' | 'expense' | 'loan_received' | 'loan_repayment' | 'refund' | 'reimbursement';
  @ApiProperty({ enum: ['income', 'expense'] }) type!: 'income' | 'expense';
  @ApiProperty({ type: String, example: '250.00' }) amountEtb!: string;
  @ApiProperty({ type: String, example: 'food' }) category!: string;
  @ApiProperty({ type: String, example: 'lunch', nullable: true }) note!: string | null;
  @ApiProperty({ enum: ['text', 'voice', 'receipt'], example: 'text' }) source!:
    'text' | 'voice' | 'receipt';
  @ApiPropertyOptional({ type: String, example: 'telebirr', nullable: true })
  platform?: string | null;
  @ApiPropertyOptional({ type: String, example: 'Paid 300 ETB for lunch', nullable: true })
  rawTranscript?: string | null;
  @ApiPropertyOptional({ type: String, example: 'user-123/group-456.jpg', nullable: true })
  receiptImagePath?: string | null;
  @ApiProperty({ type: String, example: '2026-08-04T10:00:00.000Z' }) occurredAt!: string;
}

export class DashboardUserDto {
  @ApiProperty({ type: String, nullable: true, example: 'Abebe' }) firstName!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'Tesfaye' }) lastName!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'abebe' }) username!: string | null;
}

export class DashboardResponseDto {
  @ApiProperty({ enum: ['am', 'en'] }) locale!: 'am' | 'en';
  @ApiProperty({ type: DashboardUserDto }) user!: DashboardUserDto;
  @ApiProperty({ enum: ['today', 'week', 'month', 'all', 'custom'] }) period!:
    'today' | 'week' | 'month' | 'all' | 'custom';
  @ApiProperty({ type: DashboardRangeDto }) range!: DashboardRangeDto;
  @ApiProperty({ type: DashboardMoneyDto }) summary!: DashboardMoneyDto;
  @ApiProperty({ type: Number, example: 25 }) totalCount!: number;
  @ApiProperty({ type: Number, example: 3 }) uncategorizedCount!: number;
  @ApiProperty({ type: Object, example: { telebirr: 10, cbe: 5 } }) bankCounts!: Record<
    string,
    number
  >;
  @ApiProperty({ type: [DashboardCategoryDto] }) expenseCategories!: DashboardCategoryDto[];
  @ApiProperty({ type: [DashboardSpecialMovementDto] })
  specialMovements!: DashboardSpecialMovementDto[];
  @ApiProperty({ type: [DashboardTransactionDto] }) recentTransactions!: DashboardTransactionDto[];
  @ApiProperty({ type: String, nullable: true, example: '2026-08-04T10:00:00.000Z' })
  nextCursor!: string | null;
  @ApiProperty({ type: Boolean, example: false }) hasMore!: boolean;
}

export class CreateMiniAppTransactionDto {
  @ApiProperty({ enum: ['expense', 'income'], example: 'expense' })
  @IsIn(['expense', 'income'])
  type!: 'expense' | 'income';

  @ApiProperty({ type: String, example: '250.00' })
  @IsString()
  amountEtb!: string;

  @ApiProperty({ type: String, example: 'food_groceries' })
  @IsString()
  category!: string;

  @ApiPropertyOptional({ type: String, example: 'Lunch with friends' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: String, example: 'telebirr' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ enum: ['text', 'voice', 'receipt'], example: 'text' })
  @IsOptional()
  @IsIn(['text', 'voice', 'receipt'])
  source?: 'text' | 'voice' | 'receipt';

  @ApiPropertyOptional({ type: String, example: 'temp-receipt-123.png' })
  @IsOptional()
  @IsString()
  receiptTempId?: string;
}

export class ParseTextDto {
  @ApiProperty({ type: String, example: '250 birr for lunch' })
  @IsString()
  text!: string;
}

export class UpdateMiniAppTransactionDto {
  @ApiPropertyOptional({ example: '250.00', description: 'Updated amount in ETB' })
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, {
    message: 'amountEtb must be a valid positive decimal',
  })
  amountEtb?: string;

  @ApiPropertyOptional({ enum: ['expense', 'income'], example: 'expense' })
  @IsOptional()
  @IsIn(['expense', 'income'])
  type?: 'expense' | 'income';

  @ApiPropertyOptional({ example: 'food_groceries' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 'Lunch with team' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ example: 'telebirr' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string | null;
}

export class MatchCandidateQueryDto {
  @ApiProperty({ example: '250.00', description: 'Amount to search for candidate matches' })
  @IsString()
  amountEtb!: string;

  @ApiPropertyOptional({ enum: ['expense', 'income'], example: 'expense' })
  @IsOptional()
  @IsIn(['expense', 'income'])
  type?: 'expense' | 'income';

  @ApiPropertyOptional({ example: '2026-08-29T12:00:00.000Z' })
  @IsOptional()
  @IsString()
  occurredAt?: string;
}

export class MatchCandidateItemDto {
  @ApiProperty({ example: 'b6f2b5a1-4321-4f1a-b333-123456789abc' })
  id!: string;

  @ApiProperty({ enum: ['transaction', 'pending_interaction'] })
  targetType!: 'transaction' | 'pending_interaction';

  @ApiProperty({ example: '250.00' })
  amountEtb!: string;

  @ApiProperty({ enum: ['expense', 'income'] })
  type!: 'expense' | 'income';

  @ApiProperty({ example: 'uncategorized' })
  category!: string;

  @ApiProperty({ example: 'Telebirr payment to Merchant 0911...', nullable: true })
  note!: string | null;

  @ApiProperty({ example: 'TELEBIRR' })
  bankSource!: string;

  @ApiProperty({ example: '2026-08-29T10:15:00.000Z' })
  occurredAt!: string;

  @ApiPropertyOptional({ example: 'TXN123456' })
  reference?: string | undefined;
}

export class LinkCandidateDto {
  @ApiProperty({ example: 'b6f2b5a1-4321-4f1a-b333-123456789abc' })
  @IsString()
  targetId!: string;

  @ApiProperty({ enum: ['transaction', 'pending_interaction'] })
  @IsIn(['transaction', 'pending_interaction'])
  targetType!: 'transaction' | 'pending_interaction';

  @ApiProperty({ example: 'food_groceries' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category!: string;

  @ApiPropertyOptional({ example: 'Lunch with team' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ enum: ['expense', 'income'] })
  @IsOptional()
  @IsIn(['expense', 'income'])
  type?: 'expense' | 'income';
}
