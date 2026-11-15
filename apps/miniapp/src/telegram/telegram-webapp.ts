interface TelegramWebApp {
  initData: string;
  colorScheme?: 'light' | 'dark';
  initDataUnsafe?: {
    user?: {
      id?: number;
      language_code?: string;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };

  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(event: 'themeChanged', callback: () => void): void;
  offEvent?(event: 'themeChanged', callback: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function telegramWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

export function bootstrapTelegram(): void {
  const webApp = telegramWebApp();
  webApp?.ready();
  webApp?.expand();
}

export function setTelegramColors(theme: 'light' | 'dark'): void {
  const webApp = telegramWebApp();
  if (!webApp) return;
  const headerColor = theme === 'dark' ? '#090d16' : '#f8fafc';
  const bgColor = theme === 'dark' ? '#090d16' : '#f8fafc';
  try {
    webApp.setHeaderColor?.(headerColor);
    webApp.setBackgroundColor?.(bgColor);
  } catch {
    // Ignore unsupported WebApp client errors
  }
}

export function triggerHaptic(
  type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' = 'light',
): void {
  const haptic = telegramWebApp()?.HapticFeedback;
  if (!haptic) return;
  if (type === 'selection') {
    haptic.selectionChanged();
  } else if (type === 'success' || type === 'warning' || type === 'error') {
    haptic.notificationOccurred(type);
  } else {
    haptic.impactOccurred(type);
  }
}

export function initialLocale(): 'am' | 'en' {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('muday_locale');
    if (saved === 'am' || saved === 'en') return saved;
  }
  return telegramWebApp()?.initDataUnsafe?.user?.language_code?.toLowerCase().startsWith('en')
    ? 'en'
    : 'am';
}

export function authentication(): { header: string; development: boolean } {
  const initData = telegramWebApp()?.initData;
  if (initData) return { header: `tma ${initData}`, development: false };
  if (import.meta.env.VITE_ALLOW_LOCAL_DEV_AUTH === 'true' || import.meta.env.DEV) {
    return { header: 'dev', development: true };
  }
  throw new Error('telegram_auth_unavailable');
}
