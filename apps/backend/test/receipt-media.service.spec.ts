import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { ReceiptMediaService } from '../src/receipt/receipt-media.service.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';

const roots: string[] = [];

async function setup(maxBytes = 1024) {
  const root = await mkdtemp(join(tmpdir(), 'mezgeb-receipt-media-'));
  roots.push(root);
  const values: Record<string, unknown> = {
    TELEGRAM_BOT_TOKEN: 'test-token',
    RECEIPT_TEMP_DIR: root,
    MAX_RECEIPT_FILE_BYTES: maxBytes,
  };
  const transport = new RecordingTelegramTransport();
  const service = new ReceiptMediaService(
    { get: vi.fn((key: string) => values[key]) } as unknown as ConfigService<Environment, true>,
    transport,
  );
  return { root, transport, service };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('ReceiptMediaService', () => {
  it('accepts a matching PNG signature and deletes it on cleanup', async () => {
    const { root, service } = await setup();
    const png = Buffer.concat([
      Buffer.from('89504e470d0a1a0a00000000', 'hex'),
      Buffer.from('test'),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(png)));
    const prepared = await service.prepare('opaque-file-id', 'image/png');
    expect(await readdir(root)).toHaveLength(1);
    await service.cleanup(prepared.directory);
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects MIME spoofing and removes the temporary directory', async () => {
    const { root, service } = await setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Buffer.from('not-a-real-png'))));
    await expect(service.prepare('opaque-file-id', 'image/png')).rejects.toMatchObject({
      code: 'unsupported_type',
    });
    expect(await readdir(root)).toEqual([]);
  });

  it('persists a confirmed JPEG receipt file and provides safe absolute path', async () => {
    const { service } = await setup();
    const jpeg = Buffer.concat([
      Buffer.from('ffd8ffe000104a4649460001', 'hex'),
      Buffer.from('jpeg-content-data'),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(jpeg)));
    const relPath = await service.persistReceipt(
      'file-123',
      'image/jpeg',
      'test-user-uuid',
      'group-456',
    );
    expect(relPath).toBe('test-user-uuid/group-456.jpg');
    const absPath = service.getReceiptAbsolutePath(relPath);
    expect(absPath).toContain('group-456.jpg');
  });
});
