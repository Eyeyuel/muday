import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { fileURLToPath } from 'node:url';

import { validateEnvironment } from './environment.js';

const repositoryEnvironmentFile = fileURLToPath(new URL('../../../../.env', import.meta.url));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: repositoryEnvironmentFile,
      validate: validateEnvironment,
    }),
  ],
})
export class ApplicationConfigModule {}
