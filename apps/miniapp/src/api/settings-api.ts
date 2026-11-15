import { authentication } from '../telegram/telegram-webapp';

export interface MiniAppSettings {
  morningReminderEnabled: boolean;
  morningReminderTime: string;
  nightStatusEnabled: boolean;
  nightStatusTime: string;
  weeklySummaryEnabled: boolean;
  monthlySummaryEnabled: boolean;
  updatedAt?: string;
}

export async function fetchSettings(): Promise<MiniAppSettings> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    return {
      morningReminderEnabled: false,
      morningReminderTime: '08:00',
      nightStatusEnabled: true,
      nightStatusTime: '21:00',
      weeklySummaryEnabled: true,
      monthlySummaryEnabled: true,
    };
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  try {
    const response = await fetch(`${baseUrl}/api/settings`, {
      headers: { Authorization: auth.header },
      cache: 'no-store',
    });

    if (response.ok) {
      return (await response.json()) as MiniAppSettings;
    }
  } catch {
    // fallback
  }

  return {
    morningReminderEnabled: false,
    morningReminderTime: '08:00',
    nightStatusEnabled: true,
    nightStatusTime: '21:00',
    weeklySummaryEnabled: true,
    monthlySummaryEnabled: true,
  };
}

export async function updateSettings(patch: Partial<MiniAppSettings>): Promise<MiniAppSettings> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    return {
      morningReminderEnabled: patch.morningReminderEnabled ?? false,
      morningReminderTime: patch.morningReminderTime ?? '08:00',
      nightStatusEnabled: patch.nightStatusEnabled ?? true,
      nightStatusTime: patch.nightStatusTime ?? '21:00',
      weeklySummaryEnabled: patch.weeklySummaryEnabled ?? true,
      monthlySummaryEnabled: patch.monthlySummaryEnabled ?? true,
    };
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  try {
    const response = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: auth.header,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    });

    if (response.ok) {
      return (await response.json()) as MiniAppSettings;
    }
  } catch {
    // fallback
  }

  return {
    morningReminderEnabled: patch.morningReminderEnabled ?? false,
    morningReminderTime: patch.morningReminderTime ?? '08:00',
    nightStatusEnabled: patch.nightStatusEnabled ?? true,
    nightStatusTime: patch.nightStatusTime ?? '21:00',
    weeklySummaryEnabled: patch.weeklySummaryEnabled ?? true,
    monthlySummaryEnabled: patch.monthlySummaryEnabled ?? true,
  };
}
