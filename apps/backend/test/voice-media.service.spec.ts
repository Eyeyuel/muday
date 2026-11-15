import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import { VoiceMediaService } from '../src/voice/voice-media.service.js';

const roots: string[] = [];

async function setup(maxBytes = 1024) {
  const root = await mkdtemp(join(tmpdir(), 'mezgeb-voice-media-'));
  roots.push(root);
  const values: Record<string, unknown> = {
    TELEGRAM_BOT_TOKEN: 'test-token',
    VOICE_TEMP_DIR: root,
    MAX_VOICE_FILE_BYTES: maxBytes,
    VOICE_AUDIO_SAMPLE_RATE: 24000,
    MAX_VOICE_DURATION_SECONDS: 120,
    GEMINI_MAX_INLINE_AUDIO_BYTES: 12_000_000,
    FFMPEG_PATH: '/bin/false',
    FFPROBE_PATH: '/bin/false',
  };
  const transport = new RecordingTelegramTransport();
  const service = new VoiceMediaService(
    { get: vi.fn((key: string) => values[key]) } as unknown as ConfigService<Environment, true>,
    transport,
  );
  return { root, transport, service };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('VoiceMediaService', () => {
  it('removes the temporary directory after conversion failure', async () => {
    const { root, service } = await setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Buffer.from('audio-bytes'))));
    await expect(service.prepare('opaque-file-id')).rejects.toMatchObject({
      code: 'conversion_failed',
    });
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects Telegram file metadata above the byte limit and cleans up', async () => {
    const { root, service, transport } = await setup(100);
    transport.resolvedFile = { filePath: 'voice/file.oga', fileSize: 101 };
    await expect(service.prepare('opaque-file-id')).rejects.toMatchObject({ code: 'too_large' });
    expect(await readdir(root)).toEqual([]);
  });
});
