import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

@Injectable()
export class DatabaseHealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async check(): Promise<'ok' | 'error'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
