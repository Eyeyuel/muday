import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authentication } from '@/telegram/telegram-webapp';
import { getStoredAdminToken } from '@/api/admin-api';

export interface UserAvatarProps {
  userId?: string | null;
  photoUrl?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  allowPreview?: boolean;
  className?: string;
}

const SIZE_CONFIGS = {
  sm: {
    container: 'h-8 w-8 text-xs',
    badge: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5 border',
    iconSize: 7,
  },
  md: {
    container: 'h-10 w-10 text-sm',
    badge: 'h-4 w-4 -bottom-0.5 -right-0.5 border',
    iconSize: 8,
  },
  lg: {
    container: 'h-12 w-12 text-base',
    badge: 'h-5 w-5 -bottom-0.5 -right-0.5 border-2',
    iconSize: 9,
  },
  xl: {
    container: 'h-16 w-16 text-xl',
    badge: 'h-6 w-6 -bottom-1 -right-1 border-2',
    iconSize: 11,
  },
};

let cachedOwnPhotoBlobUrl: string | null = null;
const adminPhotoMap = new Map<string, string>();

export function UserAvatar({
  userId,
  photoUrl,
  name,
  size = 'md',
  showBadge = false,
  allowPreview = true,
  className,
}: UserAvatarProps) {
  const [resolvedPhoto, setResolvedPhoto] = useState<string | null>(() => {
    if (photoUrl) return photoUrl;
    if (userId && adminPhotoMap.has(userId)) {
      return adminPhotoMap.get(userId) ?? null;
    }
    if (
      !userId &&
      typeof window !== 'undefined' &&
      window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url
    ) {
      return window.Telegram.WebApp.initDataUnsafe.user.photo_url;
    }
    return !userId ? cachedOwnPhotoBlobUrl : null;
  });
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!isZoomed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomed]);

  useEffect(() => {
    if (photoUrl) {
      setResolvedPhoto(photoUrl);
      return;
    }

    // Admin Mode: Fetch user photo by userId using admin JWT token
    if (userId) {
      const cached = adminPhotoMap.get(userId);
      if (cached) {
        setResolvedPhoto(cached);
        return;
      }

      const adminToken = getStoredAdminToken();
      if (!adminToken) return;

      let isMounted = true;
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
      fetch(`${baseUrl}/api/telegram-profile/admin/users/${encodeURIComponent(userId)}/photo`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
        .then(async (res) => {
          if (!isMounted) return;
          if (res.ok) {
            const blob = await res.blob();
            if (!isMounted) return;
            const objectUrl = URL.createObjectURL(blob);
            adminPhotoMap.set(userId, objectUrl);
            setResolvedPhoto(objectUrl);
          } else {
            setHasError(true);
          }
        })
        .catch(() => {
          if (isMounted) setHasError(true);
        });

      return () => {
        isMounted = false;
      };
    }

    // Customer / MiniApp Mode
    const tgPhoto =
      typeof window !== 'undefined'
        ? window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url
        : undefined;

    if (tgPhoto) {
      setResolvedPhoto(tgPhoto);
      return;
    }

    if (cachedOwnPhotoBlobUrl) {
      setResolvedPhoto(cachedOwnPhotoBlobUrl);
      return;
    }

    let isMounted = true;
    try {
      const auth = authentication();
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
      fetch(`${baseUrl}/api/telegram-profile/photo`, {
        headers: { Authorization: auth.header },
      })
        .then(async (res) => {
          if (!isMounted) return;
          if (res.ok) {
            const blob = await res.blob();
            if (!isMounted) return;
            const objectUrl = URL.createObjectURL(blob);
            cachedOwnPhotoBlobUrl = objectUrl;
            setResolvedPhoto(objectUrl);
          } else {
            setHasError(true);
          }
        })
        .catch(() => {
          if (isMounted) setHasError(true);
        });
    } catch {
      if (isMounted) setHasError(true);
    }

    return () => {
      isMounted = false;
    };
  }, [userId, photoUrl]);

  // Derive initials from name
  const cleanName = (name ?? '').trim() || 'Muday';
  const initials = cleanName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const config = SIZE_CONFIGS[size];

  const handleImageClick = (e: React.MouseEvent) => {
    if (allowPreview && resolvedPhoto && !hasError) {
      e.stopPropagation();
      setIsZoomed(true);
    }
  };

  return (
    <>
      <div className={cn('relative inline-flex shrink-0 select-none', className)}>
        {resolvedPhoto && !hasError ? (
          <img
            src={resolvedPhoto}
            alt={cleanName}
            onClick={handleImageClick}
            onError={() => setHasError(true)}
            className={cn(
              'rounded-full object-cover shadow-xs border border-[var(--border-hairline)] ring-1 ring-black/5 dark:ring-white/10',
              allowPreview && 'cursor-pointer hover:opacity-90 transition-opacity',
              config.container,
            )}
            title={allowPreview ? 'Click to view full photo' : undefined}
          />
        ) : (
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)] font-bold border border-[var(--border-hairline)] shadow-xs select-none',
              config.container,
            )}
            aria-hidden="true"
          >
            {initials}
          </div>
        )}

        {showBadge && (
          <div
            className={cn(
              'absolute flex items-center justify-center rounded-full bg-[#2AABEE] text-white border-[var(--card)] shadow-xs pointer-events-none',
              config.badge,
            )}
            title="Verified Telegram User"
          >
            <Send size={config.iconSize} className="-translate-x-px" />
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal via React Portal (Always Top Layer) */}
      {isZoomed && resolvedPhoto && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 select-none cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(false);
              }}
            >
              {/* Screen Top-Right X Close Button */}
              <button
                type="button"
                className="fixed top-5 right-5 sm:top-8 sm:right-8 z-[100000] flex items-center justify-center h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white backdrop-blur-md border border-white/10 shadow-2xl transition-all cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomed(false);
                }}
                aria-label="Close photo preview"
              >
                <X size={22} className="stroke-[2.5]" />
              </button>

              {/* Large Image Card */}
              <div
                className="relative max-w-sm sm:max-w-md md:max-w-lg w-full flex flex-col items-center gap-4 cursor-default animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative group">
                  <img
                    src={resolvedPhoto}
                    alt={cleanName}
                    className="w-72 h-72 sm:w-96 sm:h-96 md:w-[28rem] md:h-[28rem] rounded-3xl object-cover shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border border-white/20 ring-1 ring-white/10"
                  />
                  {showBadge ? (
                    <div
                      className="absolute -bottom-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#2AABEE] text-white border-4 border-black/80 shadow-xl pointer-events-none"
                      title="Verified Telegram User"
                    >
                      <Send size={18} className="-translate-x-0.5" />
                    </div>
                  ) : null}
                </div>

                {/* Floating User Identity Pill */}
                <div className="flex flex-col items-center text-center px-6 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 shadow-xl">
                  <span className="text-base font-bold text-white tracking-wide">{cleanName}</span>
                  <span className="text-xs text-white/70">Telegram Profile Photo</span>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
