import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DatabaseHealthService } from '../database/database-health.service.js';
import { RedisHealthService } from '../redis/redis-health.service.js';
import { LivenessDto, ReadinessDto } from './health.dto.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseHealthService) private readonly databaseHealth: DatabaseHealthService,
    @Inject(RedisHealthService) private readonly redisHealth: RedisHealthService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Check whether the API process is alive' })
  @ApiOkResponse({ type: LivenessDto })
  liveness(): LivenessDto {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check PostgreSQL and Redis readiness' })
  @ApiOkResponse({ type: ReadinessDto })
  async readiness(): Promise<ReadinessDto> {
    const [database, redis] = await Promise.all([
      this.databaseHealth.check(),
      this.redisHealth.check(),
    ]);

    return {
      status: database === 'ok' && redis === 'ok' ? 'ok' : 'error',
      checks: {
        database,
        redis,
      },
    };
  }
}
