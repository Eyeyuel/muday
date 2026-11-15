import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

import type { Environment } from '../../config/environment.js';
import type {
  SpeechToTextInput,
  SpeechToTextProvider,
  SpeechToTextResult,
} from '../speech-to-text.interface.js';
import { SttError } from '../stt.error.js';

const addisaiResponseSchema = z
  .object({
    status: z.literal('success'),
    data: z
      .object({
        transcription: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

@Injectable()
export class AddisAiSpeechToTextProvider implements SpeechToTextProvider {
  readonly provider = 'addisai';
  readonly model = 'addisai-transcription-v2';
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly maxResponseBytes: number;
  private readonly dailyLimit: number;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private dayKey = '';
  private dailyRequests = 0;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.apiKey = config.get('ADDISAI_API_KEY', { infer: true });
    this.endpoint = `${config.get('ADDISAI_BASE_URL', { infer: true }).replace(/\/$/, '')}/v2/stt`;
    this.timeoutMs = config.get('ADDISAI_TIMEOUT_MS', { infer: true });
    this.maxRetries = config.get('ADDISAI_MAX_RETRIES', { infer: true });
    this.retryBaseDelayMs = config.get('ADDISAI_RETRY_BASE_DELAY_MS', { infer: true });
    this.maxResponseBytes = config.get('ADDISAI_MAX_RESPONSE_BYTES', { infer: true });
    this.dailyLimit = config.get('ADDISAI_DAILY_REQUEST_LIMIT', { infer: true });
    this.failureThreshold = config.get('ADDISAI_CIRCUIT_FAILURE_THRESHOLD', { infer: true });
    this.cooldownMs = config.get('ADDISAI_CIRCUIT_COOLDOWN_SECONDS', { infer: true }) * 1_000;
  }

  async transcribe(input: SpeechToTextInput): Promise<SpeechToTextResult> {
    const startedAt = performance.now();
    const file = await readFile(input.wavPath).catch(() => {
      throw new SttError('failed');
    });
    const audio = new Uint8Array(file.byteLength);
    audio.set(file);

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      this.claimProviderAttempt();
      try {
        const transcript = await this.transcribeOnce(audio);
        this.consecutiveFailures = 0;
        this.circuitOpenUntil = 0;
        return {
          transcript,
          provider: this.provider,
          model: this.model,
          latencyMs: Math.round(performance.now() - startedAt),
        };
      } catch (error) {
        const safeError = this.safeError(error);
        if (!safeError.retryable) throw safeError;
        this.registerTransientFailure();
        if (attempt >= this.maxRetries || Date.now() < this.circuitOpenUntil) throw safeError;
        await this.waitBeforeRetry(attempt);
      }
    }

    throw new SttError('failed');
  }

  private async transcribeOnce(audio: Uint8Array<ArrayBuffer>): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const form = new FormData();
      form.set('audio', new Blob([audio], { type: 'audio/wav' }), 'voice.wav');
      form.set('request_data', JSON.stringify({ language_code: 'am' }));

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'x-api-key': this.apiKey },
        body: form,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) throw new SttError('authentication');
      if (response.status === 402 || response.status === 429) throw new SttError('quota');
      if (response.status === 400 || response.status === 404 || response.status === 422) {
        throw new SttError('invalid_response');
      }
      if (response.status >= 500) throw new SttError('failed', true);
      if (!response.ok) throw new SttError('failed');

      const payload = await this.readResponse(response);
      const parsed = addisaiResponseSchema.safeParse(payload);
      if (!parsed.success) throw new SttError('invalid_response');

      const transcript = parsed.data.data.transcription.trim();
      if (!transcript) throw new SttError('invalid_response');
      return transcript;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readResponse(response: Response): Promise<unknown> {
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > this.maxResponseBytes) {
      throw new SttError('invalid_response');
    }
    if (!response.body) throw new SttError('invalid_response');

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > this.maxResponseBytes) {
        await reader.cancel();
        throw new SttError('invalid_response');
      }
      chunks.push(value);
    }

    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
      throw new SttError('invalid_response');
    }
  }

  private safeError(error: unknown): SttError {
    if (error instanceof SttError) return error;
    if (error instanceof Error && error.name === 'AbortError') return new SttError('timeout', true);
    return new SttError('failed', true);
  }

  private registerTransientFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.circuitOpenUntil = Date.now() + this.cooldownMs;
    }
  }

  private waitBeforeRetry(attempt: number): Promise<void> {
    const exponential = this.retryBaseDelayMs * 2 ** attempt;
    const jitter = Math.floor(Math.random() * this.retryBaseDelayMs);
    return new Promise((resolve) => setTimeout(resolve, exponential + jitter));
  }

  private claimProviderAttempt(): void {
    if (Date.now() < this.circuitOpenUntil) throw new SttError('failed');
    const key = new Date(Date.now() + 3 * 60 * 60_000).toISOString().slice(0, 10);
    if (this.dayKey !== key) {
      this.dayKey = key;
      this.dailyRequests = 0;
    }
    if (this.dailyRequests >= this.dailyLimit) throw new SttError('quota');
    this.dailyRequests += 1;
  }
}
