import { describe, expect, it } from 'vitest';

import { aggregateVoiceLatencies } from '../src/analytics/voice-performance-report.service.js';

const metadata = (sttLatencyMs: number, totalLatencyMs: number) => ({
  source: 'voice',
  provider: 'test-provider',
  model: 'test-model',
  sttLatencyMs,
  totalLatencyMs,
});

describe('aggregateVoiceLatencies', () => {
  it('calculates deterministic stage percentiles without exposing event metadata', () => {
    const report = aggregateVoiceLatencies([
      metadata(100, 150),
      metadata(200, 280),
      metadata(300, 450),
    ]);

    expect(report.samples).toBe(3);
    expect(report.stages.speechToText).toMatchObject({ p50: '200.00', p90: '300.00' });
    expect(report.stages.postTranscription).toMatchObject({ p50: '80.00', p90: '150.00' });
    expect(report.stages.endToEnd).toMatchObject({ p50: '280.00', p90: '450.00' });
    expect(JSON.stringify(report)).not.toContain('test-provider');
  });

  it('skips invalid legacy events and reports an empty sample safely', () => {
    const invalid = aggregateVoiceLatencies([{ transcript: 'sensitive' }, null], true);
    expect(invalid).toMatchObject({ samples: 0, skippedInvalidEvents: 2, truncated: true });
    expect(invalid.stages.endToEnd.p50).toBeNull();
    expect(JSON.stringify(invalid)).not.toContain('sensitive');
  });
});
