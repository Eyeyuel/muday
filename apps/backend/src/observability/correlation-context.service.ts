import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

type CorrelationStore = {
  correlationId: string;
};

@Injectable()
export class CorrelationContext {
  private readonly storage = new AsyncLocalStorage<CorrelationStore>();

  run<T>(correlationId: string, callback: () => T): T {
    return this.storage.run({ correlationId }, callback);
  }

  getId(): string {
    return this.storage.getStore()?.correlationId ?? randomUUID();
  }
}
