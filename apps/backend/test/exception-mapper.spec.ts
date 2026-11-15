import { BadRequestException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ApplicationException } from '../src/common/errors/application.exception.js';
import { ErrorCode } from '../src/common/errors/error-code.js';
import { mapException } from '../src/common/errors/exception-mapper.js';

describe('mapException', () => {
  it('preserves safe application error contracts', () => {
    expect(
      mapException(
        new ApplicationException(
          ErrorCode.USER_NOT_CONSENTED,
          HttpStatus.FORBIDDEN,
          'Consent is required.',
        ),
      ),
    ).toEqual({
      statusCode: 403,
      code: ErrorCode.USER_NOT_CONSENTED,
      message: 'Consent is required.',
      isUnexpected: false,
    });
  });

  it('does not expose framework exception payloads', () => {
    const mapped = mapException(
      new BadRequestException({
        message: ['rawTranscript must not be empty'],
        token: 'must-not-escape',
      }),
    );

    expect(mapped).toEqual({
      statusCode: 400,
      code: ErrorCode.BAD_REQUEST,
      message: 'rawTranscript must not be empty',
      isUnexpected: false,
    });
  });

  it('maps dependency availability safely', () => {
    expect(mapException(new ServiceUnavailableException()).code).toBe(
      ErrorCode.SERVICE_UNAVAILABLE,
    );
  });

  it('hides unexpected error messages', () => {
    const mapped = mapException(new Error('DATABASE_URL=secret'));

    expect(mapped.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(mapped.message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(mapped)).not.toContain('secret');
  });
});
