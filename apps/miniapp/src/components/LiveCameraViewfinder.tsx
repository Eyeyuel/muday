import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, AlertCircle } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { Button } from './ui/button';

interface LiveCameraViewfinderProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  locale: Locale;
}

export function LiveCameraViewfinder({
  isOpen,
  onClose,
  onCapture,
  locale,
}: LiveCameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopStream();
      setIsStarting(true);
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          locale === 'en'
            ? 'Live camera access is not supported by your browser.'
            : 'የቀጥታ ካሜራ ድጋፍ በዚህ ብሮውዘር ላይ አልተገኘም።',
        );
        setIsStarting(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (err: unknown) {
        console.warn('Live camera error:', err);
        // Retry with default video constraint if facingMode rejected
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play().catch(() => undefined);
          }
        } catch {
          setCameraError(
            locale === 'en'
              ? 'Camera permission denied or camera in use. Please allow camera permissions.'
              : 'የካሜራ ፈቃድ አልተሰጠም ወይም ካሜራው በሌላ መተግበሪያ ተይዟል። እባክዎ ፈቃድ ይስጡ።',
          );
        }
      } finally {
        setIsStarting(false);
      }
    },
    [locale, stopStream],
  );

  useEffect(() => {
    if (isOpen) {
      void startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  const handleFlipCamera = () => {
    triggerHaptic('selection');
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
  };

  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    triggerHaptic('heavy');
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `receipt_${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopStream();
        onCapture(file);
      },
      'image/jpeg',
      0.92,
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white animate-fade-in select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-emerald-400" />
          <span className="text-sm font-black tracking-wide">
            {locale === 'en' ? 'Live Receipt Camera' : 'የቀጥታ ደረሰኝ ካሜራ'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            stopStream();
            onClose();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:scale-90 transition-all cursor-pointer"
          aria-label="Close camera"
        >
          <X size={20} />
        </button>
      </div>

      {/* Camera Viewfinder Stream */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        {cameraError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center gap-3 max-w-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
              <AlertCircle size={28} />
            </div>
            <p className="text-xs text-rose-300 font-medium">{cameraError}</p>
            <Button
              onClick={() => void startCamera(facingMode)}
              className="mt-2 h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
            >
              <RefreshCw size={14} className="mr-1.5" />
              {locale === 'en' ? 'Retry Camera' : 'እንደገና ሞክር'}
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />

            {/* Receipt Scanner Frame Overlay */}
            <div className="absolute inset-x-8 inset-y-16 pointer-events-none border-2 border-dashed border-emerald-400/70 rounded-3xl flex flex-col items-center justify-between p-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              {/* Top Corners */}
              <div className="w-full flex justify-between">
                <div className="w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              </div>

              <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-xs text-[11px] font-bold text-emerald-300">
                {locale === 'en' ? 'Align receipt in frame' : 'ደረሰኙን በሳጥኑ ውስጥ ያስተካክሉ'}
              </div>

              {/* Bottom Corners */}
              <div className="w-full flex justify-between">
                <div className="w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-around p-6 bg-gradient-to-t from-black/90 via-black/70 to-transparent z-10 pb-10">
        {/* Flip Camera Button */}
        <button
          type="button"
          onClick={handleFlipCamera}
          disabled={isStarting || !!cameraError}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:scale-90 transition-all text-white disabled:opacity-30 cursor-pointer"
          aria-label="Flip Camera"
        >
          <RefreshCw size={20} />
        </button>

        {/* Shutter / Capture Button */}
        <button
          type="button"
          onClick={handleSnapPhoto}
          disabled={isStarting || !!cameraError}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-white hover:bg-slate-100 active:scale-90 transition-all shadow-[0_0_25px_rgba(255,255,255,0.4)] disabled:opacity-30 cursor-pointer p-1"
          aria-label="Take Photo"
        >
          <div className="h-full w-full rounded-full border-4 border-black/20 bg-emerald-500 flex items-center justify-center text-white">
            <Camera size={28} />
          </div>
        </button>

        {/* Placeholder to balance grid */}
        <div className="w-12 h-12" />
      </div>
    </div>
  );
}
