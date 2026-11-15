import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { PrismaService } from '../database/prisma.service.js';

const MAX_EVENTS = 10_000;
const voiceMetadata = z
  .object({
    source: z.literal('voice'),
    provider: z.string().min(1),
    model: z.string().min(1),
    sttLatencyMs: z.number().nonnegative().finite(),
    totalLatencyMs: z.number().nonnegative().finite(),
  })
  .strict();

type LatencySummary = {
  p50: string | null;
  p90: string | null;
  p95: string | null;
  max: string | null;
};

export type VoicePerformanceReport = {
  generatedAt: string;
  samples: number;
  skippedInvalidEvents: number;
  truncated: boolean;
  unit: 'ms';
  stages: {
    speechToText: LatencySummary;
    postTranscription: LatencySummary;
    endToEnd: LatencySummary;
  };
};

function summarize(values: number[]): LatencySummary {
  const sorted = values.toSorted((left, right) => left - right);
  const percentile = (value: number): string | null => {
    if (sorted.length === 0) return null;
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1);
    return sorted[index]!.toFixed(2);
  };
  return {
    p50: percentile(0.5),
    p90: percentile(0.9),
    p95: percentile(0.95),
    max: sorted.at(-1)?.toFixed(2) ?? null,
  };
}

export function aggregateVoiceLatencies(
  metadataValues: unknown[],
  truncated = false,
): VoicePerformanceReport {
  const valid = metadataValues.flatMap((metadata) => {
    const parsed = voiceMetadata.safeParse(metadata);
    return parsed.success ? [parsed.data] : [];
  });
  const stt = valid.map(({ sttLatencyMs }) => sttLatencyMs);
  const total = valid.map(({ totalLatencyMs }) => totalLatencyMs);
  const postTranscription = valid.map(({ sttLatencyMs, totalLatencyMs }) =>
    Math.max(0, totalLatencyMs - sttLatencyMs),
  );

  return {
    generatedAt: new Date().toISOString(),
    samples: valid.length,
    skippedInvalidEvents: metadataValues.length - valid.length,
    truncated,
    unit: 'ms',
    stages: {
      speechToText: summarize(stt),
      postTranscription: summarize(postTranscription),
      endToEnd: summarize(total),
    },
  };
}

@Injectable()
export class VoicePerformanceReportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async generate(): Promise<VoicePerformanceReport> {
    const events = await this.prisma.event.findMany({
      where: { eventType: 'voice_processing_completed' },
      select: { metadata: true },
      orderBy: { occurredAt: 'desc' },
      take: MAX_EVENTS,
    });
    return aggregateVoiceLatencies(
      events.map(({ metadata }) => metadata),
      events.length === MAX_EVENTS,
    );
  }
}
