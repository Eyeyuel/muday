import { describe, expect, it } from 'vitest';

import { parseDeletionCallback } from '../src/deletion/deletion.types.js';

describe('deletion callback parser', () => {
  it('accepts only opaque UUID callbacks and supported actions', () => {
    expect(parseDeletionCallback('delete:123e4567-e89b-42d3-a456-426614174000:continue')).toEqual({
      interactionId: '123e4567-e89b-42d3-a456-426614174000',
      action: 'continue',
    });
    expect(parseDeletionCallback('delete:100:permanent')).toBeUndefined();
    expect(
      parseDeletionCallback('delete:123e4567-e89b-42d3-a456-426614174000:yes'),
    ).toBeUndefined();
  });
});
