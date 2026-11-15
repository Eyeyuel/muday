import { Module } from '@nestjs/common';

import { ApplicationConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { IdentityModule } from './identity.module.js';

@Module({ imports: [ApplicationConfigModule, DatabaseModule, IdentityModule] })
export class IdentityBackfillCommandModule {}
