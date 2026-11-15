import { HttpException, HttpStatus } from '@nestjs/common';

import { ApplicationException } from './application.exception.js';
import { ErrorCode, type ErrorCode as ErrorCodeValue } from './error-code.js';

export type MappedException = {
  statusCode: number;
  code: ErrorCodeValue;
  message: string;
  isUnexpected: boolean;
};

const statusCodeMap: Partial<Record<number, ErrorCodeValue>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
};

const safeStatusMessages: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'The request is invalid.',
  [HttpStatus.UNAUTHORIZED]: 'Authentication is required.',
  [HttpStatus.FORBIDDEN]: 'You are not allowed to perform this action.',
  [HttpStatus.NOT_FOUND]: 'The requested resource was not found.',
  [HttpStatus.CONFLICT]: 'The request conflicts with the current resource state.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests. Please try again later.',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable.',
};

export function mapException(exception: unknown): MappedException {
  if (exception instanceof ApplicationException) {
    return {
      statusCode: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      isUnexpected: false,
    };
  }

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    let message = safeStatusMessages[statusCode] ?? 'The request could not be completed.';

    if (statusCode === 400) {
      const response = exception.getResponse() as Record<string, unknown>;
      if (response && typeof response === 'object' && 'message' in response) {
        const msg = response.message;
        message = Array.isArray(msg) ? msg.join(', ') : String(msg);
      }
    }

    return {
      statusCode,
      code: statusCodeMap[statusCode] ?? ErrorCode.BAD_REQUEST,
      message,
      isUnexpected: statusCode >= 500,
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred.',
    isUnexpected: true,
  };
}
