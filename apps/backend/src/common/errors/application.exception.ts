import { HttpException } from '@nestjs/common';

import type { ErrorCode } from './error-code.js';

export class ApplicationException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    statusCode: number,
    message: string,
  ) {
    super(message, statusCode);
  }
}
