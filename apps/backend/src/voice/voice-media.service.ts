import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, mkdtemp, open, readdir, rm, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import type { Environment } from '../config/environment.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { VoiceError } from './voice.error.js';

export interface PreparedVoice {
  directory: string;
  inputPath: string;
  wavPath: string;
}

@Injectable()
export class VoiceMediaService {
  private readonly token: string;
  private readonly tempRoot: string;
  private readonly maxBytes: number;
  private readonly sampleRate: number;
  private readonly ffmpegPath: string;
  private readonly ffprobePath: string;
  private readonly maxDurationSeconds: number;
  private readonly maxDecodedBytes: number;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
  ) {
    this.token = config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    this.tempRoot = resolve(config.get('VOICE_TEMP_DIR', { infer: true }));
    this.maxBytes = config.get('MAX_VOICE_FILE_BYTES', { infer: true });
    this.sampleRate = config.get('VOICE_AUDIO_SAMPLE_RATE', { infer: true });
    this.ffmpegPath = config.get('FFMPEG_PATH', { infer: true });
    this.ffprobePath = config.get('FFPROBE_PATH', { infer: true });
    this.maxDurationSeconds = config.get('MAX_VOICE_DURATION_SECONDS', { infer: true });
    this.maxDecodedBytes = config.get('GEMINI_MAX_INLINE_AUDIO_BYTES', { infer: true });
  }

  async prepare(fileId: string): Promise<PreparedVoice> {
    await mkdir(this.tempRoot, { recursive: true, mode: 0o700 });
    const directory = await mkdtemp(`${this.tempRoot}${sep}job-`);
    const prepared = {
      directory,
      inputPath: resolve(directory, 'input.oga'),
      wavPath: resolve(directory, 'voice.wav'),
    };
    try {
      const file = await this.transport.getFile(fileId);
      if (file.fileSize !== undefined && file.fileSize > this.maxBytes) {
        throw new VoiceError('too_large');
      }
      await this.download(file.filePath, prepared.inputPath);
      await this.convert(prepared.inputPath, prepared.wavPath);
      await this.validateDecodedAudio(prepared.wavPath);
      return prepared;
    } catch (error) {
      await this.cleanup(directory);
      throw error;
    }
  }

  cleanup(directory: string): Promise<void> {
    const target = resolve(directory);
    if (!target.startsWith(`${this.tempRoot}${sep}`)) {
      return Promise.reject(new VoiceError('processing_failed'));
    }
    return rm(target, { recursive: true, force: true });
  }

  async cleanupAbandoned(): Promise<void> {
    await mkdir(this.tempRoot, { recursive: true, mode: 0o700 });
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
    const handle = await open(destination, constants.O_CREAT | constants.O_WRONLY, 0o600);
    let total = 0;
    try {
      const response = await fetch(
        `https://api.telegram.org/file/bot${this.token}/${encodedPath}`,
        { signal: controller.signal },
      );
      if (!response.ok || !response.body) throw new VoiceError('download_failed');
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > this.maxBytes) {
          await reader.cancel();
          throw new VoiceError('too_large');
        }
        await handle.write(value);
      }
    } catch (error) {
      if (error instanceof VoiceError) throw error;
      throw new VoiceError('download_failed');
    } finally {
      clearTimeout(timeout);
      await handle.close();
    }
    if (total === 0) throw new VoiceError('download_failed');
  }

  private async convert(inputPath: string, wavPath: string): Promise<void> {
    await access(this.ffmpegPath, constants.X_OK).catch(() => {
      throw new VoiceError('conversion_failed');
    });

    const runFfmpeg = (withFilters: boolean) =>
      new Promise<void>((resolvePromise, reject) => {
        const args = [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          inputPath,
          '-vn',
        ];
        if (withFilters) {
          args.push('-af', 'highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11');
        }
        args.push('-ar', String(this.sampleRate), '-ac', '1', '-c:a', 'pcm_s16le', wavPath);

        const process = spawn(this.ffmpegPath, args, {
          shell: false,
          stdio: ['ignore', 'ignore', 'ignore'],
        });
        const timeout = setTimeout(() => {
          process.kill('SIGKILL');
          reject(new VoiceError('conversion_failed'));
        }, 30_000);
        process.once('error', () => {
          clearTimeout(timeout);
          reject(new VoiceError('conversion_failed'));
        });
        process.once('exit', (code) => {
          clearTimeout(timeout);
          if (code === 0) resolvePromise();
          else reject(new VoiceError('conversion_failed'));
        });
      });

    try {
      await runFfmpeg(true);
    } catch {
      // Fallback to basic conversion if complex filter chain is unprocessable
      await runFfmpeg(false);
    }

    const output = await stat(wavPath).catch(() => null);
    if (!output?.isFile() || output.size === 0 || output.size > this.maxDecodedBytes) {
      throw new VoiceError('conversion_failed');
    }
  }

  private async validateDecodedAudio(wavPath: string): Promise<void> {
    await access(this.ffprobePath, constants.X_OK).catch(() => {
      throw new VoiceError('conversion_failed');
    });
    const output = await new Promise<string>((resolvePromise, reject) => {
      const process = spawn(
        this.ffprobePath,
        [
          '-v',
          'error',
          '-select_streams',
          'a:0',
          '-show_entries',
          'stream=codec_name,channels,sample_rate,duration',
          '-of',
          'json',
          wavPath,
        ],
        { shell: false, stdio: ['ignore', 'pipe', 'ignore'] },
      );
      let stdout = '';
      process.stdout.setEncoding('utf8');
      process.stdout.on('data', (chunk: string) => {
        if (stdout.length < 16_384) stdout += chunk;
      });
      const timeout = setTimeout(() => {
        process.kill('SIGKILL');
        reject(new VoiceError('conversion_failed'));
      }, 10_000);
      process.once('error', () => {
        clearTimeout(timeout);
        reject(new VoiceError('conversion_failed'));
      });
      process.once('exit', (code) => {
        clearTimeout(timeout);
        if (code === 0) resolvePromise(stdout);
        else reject(new VoiceError('conversion_failed'));
      });
    });

    let probe: { streams?: Array<Record<string, unknown>> };
    try {
      probe = JSON.parse(output) as { streams?: Array<Record<string, unknown>> };
    } catch {
      throw new VoiceError('conversion_failed');
    }
    const stream = probe.streams?.[0];
    const duration = Number(stream?.duration);
    const channels = Number(stream?.channels);
    const sampleRate = Number(stream?.sample_rate);
    if (
      stream?.codec_name !== 'pcm_s16le' ||
      channels !== 1 ||
      sampleRate !== this.sampleRate ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > this.maxDurationSeconds + 1
    ) {
      throw new VoiceError(
        duration > this.maxDurationSeconds + 1 ? 'too_long' : 'conversion_failed',
      );
    }
  }
}
