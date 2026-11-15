import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { CorrelationContext } from './correlation-context.service.js';
import { redactText, redactValue } from './log-redactor.js';

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
type LogRecord = Record<string, unknown> & {
  timestamp: string;
  level: LogLevel;
  service: 'mezgeb';
  correlationId: string;
  message: string;
};

const levelPriority: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly configuredLevel: LogLevel;

  constructor(
    @Inject(CorrelationContext) private readonly correlationContext: CorrelationContext,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.configuredLevel = config.get('LOG_LEVEL', { infer: true });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, optionalParams);
  }

  private write(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    if (levelPriority[level] > levelPriority[this.configuredLevel]) {
      return;
    }

    const metadata =
      optionalParams.length === 1 && this.isRecord(optionalParams[0])
        ? (redactValue(optionalParams[0]) as Record<string, unknown>)
        : {};
    const record: LogRecord = {
      ...metadata,
      timestamp: new Date().toISOString(),
      level,
      service: 'mezgeb',
      correlationId: this.correlationContext.getId(),
      message: redactText(typeof message === 'string' ? message : String(message)),
    };
    const line = JSON.stringify(record);

    if (level === 'fatal' || level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
