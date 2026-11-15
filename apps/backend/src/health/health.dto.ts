import { ApiProperty } from '@nestjs/swagger';

export class LivenessDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';
}

export class DependencyChecksDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  database!: 'ok' | 'error';

  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  redis!: 'ok' | 'error';
}

export class ReadinessDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ type: DependencyChecksDto })
  checks!: DependencyChecksDto;
}
