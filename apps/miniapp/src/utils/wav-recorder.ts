export class WavRecorder {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private rawSamples: Float32Array[] = [];
  private sampleRate = 44100;
  private recording = false;
  private mimeType = 'audio/wav';

  async start(): Promise<void> {
    const getUserMedia =
      navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ||
      (
        navigator as unknown as { webkitGetUserMedia?: (c: unknown) => Promise<MediaStream> }
      ).webkitGetUserMedia?.bind(navigator) ||
      (
        navigator as unknown as { mozGetUserMedia?: (c: unknown) => Promise<MediaStream> }
      ).mozGetUserMedia?.bind(navigator) ||
      (
        navigator as unknown as { getUserMedia?: (c: unknown) => Promise<MediaStream> }
      ).getUserMedia?.bind(navigator);

    if (!getUserMedia) {
      throw new Error('Microphone access is not supported in this browser/environment');
    }

    // Flexible constraints so iOS Safari and Telegram WebViews don't reject
    this.mediaStream = await getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // 1. Try modern MediaRecorder first (hardware accelerated, highly reliable)
    if (typeof MediaRecorder !== 'undefined') {
      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ];
      const supportedType = preferredMimeTypes.find((type) => {
        try {
          return MediaRecorder.isTypeSupported(type);
        } catch {
          return false;
        }
      });

      if (supportedType) {
        this.mimeType = supportedType;
        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: supportedType });
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.audioChunks.push(e.data);
          }
        };
        this.mediaRecorder.start(100);
        this.recording = true;
        return;
      }
    }

    // 2. Fallback: Web Audio PCM Recording with safe native sampleRate and downsampling
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser');
    }

    // Crucial: Do not pass hardcoded sampleRate to AudioContext constructor on iOS
    this.audioContext = new AudioContextClass();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.sampleRate = this.audioContext.sampleRate || 44100;
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.rawSamples = [];
    this.recording = true;

    this.processor.onaudioprocess = (e) => {
      if (!this.recording) return;
      const input = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input.length);
      copy.set(input);
      this.rawSamples.push(copy);
    };

    this.sourceNode.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  async stop(): Promise<Blob | null> {
    this.recording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      return new Promise<Blob | null>((resolve) => {
        if (!this.mediaRecorder) {
          resolve(null);
          return;
        }
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.audioChunks, { type: this.mimeType });
          this.cleanupTracks();
          resolve(blob);
        };
        this.mediaRecorder.stop();
      });
    }

    if (this.sourceNode && this.processor) {
      try {
        this.sourceNode.disconnect();
        this.processor.disconnect();
      } catch {
        // ignore
      }
    }

    this.cleanupTracks();

    if (this.audioContext) {
      await this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }

    if (this.rawSamples.length === 0) {
      return null;
    }

    let totalLength = 0;
    for (const chunk of this.rawSamples) {
      totalLength += chunk.length;
    }
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.rawSamples) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Downsample from hardware sample rate to 16kHz WAV
    const resampled = resample(merged, this.sampleRate, 16000);
    const wavBuffer = encodeWav(resampled, 16000);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  private cleanupTracks() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }
}

function resample(samples: Float32Array, inputRate: number, targetRate: number): Float32Array {
  if (inputRate === targetRate) return samples;
  const ratio = inputRate / targetRate;
  const targetLength = Math.round(samples.length / ratio);
  const result = new Float32Array(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const origIndex = i * ratio;
    const index1 = Math.floor(origIndex);
    const index2 = Math.min(index1 + 1, samples.length - 1);
    const fraction = origIndex - index1;
    result[i] = (samples[index1] ?? 0) * (1 - fraction) + (samples[index2] ?? 0) * fraction;
  }
  return result;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true); // 16000 sample rate
  view.setUint32(28, sampleRate * 2, true); // Byte rate: 16000 * 1 * 16 / 8
  view.setUint16(32, 2, true); // Block align: 1 * 16 / 8
  view.setUint16(34, 16, true); // 16 bits per sample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Float32 to Int16 PCM samples
  let index = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    index += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
