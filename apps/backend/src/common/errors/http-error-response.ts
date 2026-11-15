import type { ErrorCode } from './error-code.js';

export type HttpErrorResponse = {
  statusCode: number;
  error: {
    code: ErrorCode;
    message: string;
  };
  correlationId: string;
  timestamp: string;
  path: string;
};
