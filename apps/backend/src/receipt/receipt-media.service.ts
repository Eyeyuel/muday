import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants } from 'node:fs';
import { mkdir, mkdtemp, open, readdir, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import type { Environment } from '../config/environment.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { ReceiptError } from './receipt.error.js';
import type { ReceiptMimeType } from './receipt-job.js';

export interface PreparedReceipt {
  directory: string;
  imagePath: string;
}

@Injectable()
export class ReceiptMediaService {
  private readonly token: string;
  private readonly tempRoot: string;
  private readonly mediaRoot: string;
  private readonly maxBytes: number;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
  ) {
    this.token = config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    this.tempRoot = resolve(config.get('RECEIPT_TEMP_DIR', { infer: true }));
    this.mediaRoot = resolve('.local/media/receipts');
    this.maxBytes = config.get('MAX_RECEIPT_FILE_BYTES', { infer: true });
  }

  async persistReceipt(
    fileId: string,
    mimeType: ReceiptMimeType,
    userId: string,
    groupId: string,
  ): Promise<string> {
    const userDir = resolve(this.mediaRoot, userId);
    await mkdir(userDir, { recursive: true, mode: 0o777 });
    const extension =
      ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const)[mimeType] ||
      'jpg';
    const filename = `${groupId}.${extension}`;
    const destination = resolve(userDir, filename);
    const file = await this.transport.getFile(fileId);
    if (file.fileSize !== undefined && file.fileSize > this.maxBytes) {
      throw new ReceiptError('too_large');
    }
    await this.download(file.filePath, destination);
    await this.validateSignature(destination, mimeType);
    return `${userId}/${filename}`;
  }

  getReceiptAbsolutePath(relativePath: string): string {
    const fullPath = resolve(this.mediaRoot, relativePath);
    if (!fullPath.startsWith(`${this.mediaRoot}${sep}`) && fullPath !== this.mediaRoot) {
      throw new ReceiptError('processing_failed');
    }
    return fullPath;
  }

  async prepare(fileId: string, mimeType: ReceiptMimeType): Promise<PreparedReceipt> {
    await mkdir(this.tempRoot, { recursive: true, mode: 0o777 });
    const directory = await mkdtemp(`${this.tempRoot}${sep}job-`);
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
    const imagePath = resolve(directory, `receipt.${extension}`);
    try {
      const file = await this.transport.getFile(fileId);
      if (file.fileSize !== undefined && file.fileSize > this.maxBytes) {
        throw new ReceiptError('too_large');
      }
      await this.download(file.filePath, imagePath);
      await this.validateSignature(imagePath, mimeType);
      return { directory, imagePath };
    } catch (error) {
      await this.cleanup(directory);
      throw error;
    }
  }

  cleanup(directory: string): Promise<void> {
    const target = resolve(directory);
    if (!target.startsWith(`${this.tempRoot}${sep}`)) {
      return Promise.reject(new ReceiptError('processing_failed'));
    }
    return rm(target, { recursive: true, force: true });
  }

  async cleanupAbandoned(): Promise<void> {
    await mkdir(this.tempRoot, { recursive: true, mode: 0o777 });
    const entries = await readdir(this.tempRoot, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('job-'))
        .map((entry) => this.cleanup(resolve(this.tempRoot, entry.name))),
    );
  }

  private async download(filePath: string, destination: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const handle = await open(destination, constants.O_CREAT | constants.O_WRONLY, 0o666);
    let total = 0;
    try {
      const response = await fetch(
        `https://api.telegram.org/file/bot${this.token}/${encodedPath}`,
        { signal: controller.signal },
      );
      if (!response.ok || !response.body) throw new ReceiptError('download_failed');
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > this.maxBytes) {
          await reader.cancel();
          throw new ReceiptError('too_large');
        }
        await handle.write(value);
      }
    } catch (error) {
      if (error instanceof ReceiptError) throw error;
      throw new ReceiptError('download_failed');
    } finally {
      clearTimeout(timeout);
      await handle.close();
    }
    if (total === 0) throw new ReceiptError('download_failed');
  }

  private async validateSignature(imagePath: string, mimeType: ReceiptMimeType): Promise<void> {
    const handle = await open(imagePath, constants.O_RDONLY);
    const signature = Buffer.alloc(12);
    try {
      const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
      if (bytesRead < signature.length) throw new ReceiptError('unsupported_type');
    } finally {
      await handle.close();
    }
    const valid =
      (mimeType === 'image/jpeg' &&
        signature[0] === 0xff &&
        signature[1] === 0xd8 &&
        signature[2] === 0xff) ||
      (mimeType === 'image/png' &&
        signature.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) ||
      (mimeType === 'image/webp' &&
        signature.subarray(0, 4).toString('ascii') === 'RIFF' &&
        signature.subarray(8, 12).toString('ascii') === 'WEBP');
    if (!valid) throw new ReceiptError('unsupported_type');
  }
}
