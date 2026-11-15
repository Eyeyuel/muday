import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface IdempotentResult<T> {
  statusCode: number;
  body: T;
}

@Injectable()
export class IdempotencyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  hashPayload(payload: unknown): string {
    const json = JSON.stringify(payload ?? null);
    return createHash('sha256').update(json).digest('hex');
  }

  async execute<T>(params: {
    userId: string;
    operation: string;
    key?: string | undefined | null;
    payload: unknown;
    fn: () => Promise<IdempotentResult<T>>;
  }): Promise<IdempotentResult<T>> {
    const { userId, operation, key, payload, fn } = params;

    if (!key || typeof key !== 'string' || key.trim() === '') {
      return fn();
    }

    const trimmedKey = key.trim();
    const requestHash = this.hashPayload(payload);

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        userId_operation_key: {
          userId,
          operation,
          key: trimmedKey,
        },
      },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException('Idempotency key reused with different request payload');
      }

      if (existing.status === 'COMPLETED' && existing.responseBody !== null) {
        return {
          statusCode: existing.responseCode ?? 200,
          body: existing.responseBody as T,
        };
      }

      if (existing.status === 'PROCESSING') {
        throw new ConflictException(
          'Concurrent request with the same idempotency key is currently processing',
        );
      }
    }

    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          userId,
          operation,
          key: trimmedKey,
          requestHash,
          status: 'PROCESSING',
        },
      });
    } catch {
      const racedRecord = await this.prisma.idempotencyRecord.findUnique({
        where: {
          userId_operation_key: {
            userId,
            operation,
            key: trimmedKey,
          },
        },
      });

      if (racedRecord?.requestHash !== requestHash) {
        throw new ConflictException('Idempotency key reused with different request payload');
      }

      if (racedRecord?.status === 'COMPLETED' && racedRecord.responseBody !== null) {
        return {
          statusCode: racedRecord.responseCode ?? 200,
          body: racedRecord.responseBody as T,
        };
      }

      throw new ConflictException(
        'Concurrent request with the same idempotency key is currently processing',
      );
    }

    try {
      const result = await fn();

      await this.prisma.idempotencyRecord.update({
        where: {
          userId_operation_key: {
            userId,
            operation,
            key: trimmedKey,
          },
        },
        data: {
          status: 'COMPLETED',
          responseCode: result.statusCode,
          responseBody: JSON.parse(JSON.stringify(result.body)) as Prisma.InputJsonValue,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.idempotencyRecord
        .deleteMany({
          where: {
            userId,
            operation,
            key: trimmedKey,
            status: 'PROCESSING',
          },
        })
        .catch(() => undefined);

      throw error;
    }
  }
}
