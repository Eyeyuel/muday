import { Module } from '@nestjs/common';

import { DataRetentionService } from './data-retention.service.js';

@Module({ providers: [DataRetentionService], exports: [DataRetentionService] })
export class RetentionModule {}
