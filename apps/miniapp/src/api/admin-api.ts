import type {
  AdminAnalyticsReport,
  AdminAiChatResponse,
  AdminAiDirectExportPayload,
  AdminAiDirectExportResponse,
  AdminAiSessionSummary,
  AdminBankingAnalyticsResponse,
  AdminLoginResponse,
  AdminSystemHealth,
  AdminTransactionQueryParams,
  AdminTransactionsResponse,
  AdminUserDirectoryResponse,
  AdminUserProfileDetail,
  AdminUserSession,
  AdminVoiceErrorItem,
} from './admin-types';

const getBaseUrl = () => import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';

export const getStoredAdminToken = (): string | null => {
  try {
    return sessionStorage.getItem('mezgeb_admin_token');
  } catch {
    return null;
  }
};

export const setStoredAdminToken = (token: string | null): void => {
  try {
    if (token) {
      sessionStorage.setItem('mezgeb_admin_token', token);
    } else {
      sessionStorage.removeItem('mezgeb_admin_token');
    }
  } catch {
    // Ignore storage restrictions
  }
};

export async function loginAdmin(
  emailInput: string,
  passwordInput: string,
): Promise<AdminLoginResponse> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailInput, password: passwordInput }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid email or password');
    if (response.status === 429)
      throw new Error('Too many login attempts. Please wait 15 minutes.');
    throw new Error('Failed to login as admin');
  }

  const data = (await response.json()) as AdminLoginResponse;
  setStoredAdminToken(data.token);
  return data;
}

export async function verifyAdminSession(): Promise<AdminUserSession | null> {
  const token = getStoredAdminToken();
  if (!token) return null;

  const baseUrl = getBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setStoredAdminToken(null);
      return null;
    }
    const data = (await response.json()) as { valid: boolean; user: AdminUserSession };
    return data.user;
  } catch {
    return null;
  }
}

export async function fetchAdminAnalytics(
  asOfDate?: string,
  forceRefresh = false,
): Promise<AdminAnalyticsReport> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated');

  const baseUrl = getBaseUrl();
  const params = new URLSearchParams();
  if (asOfDate) params.set('asOf', asOfDate);
  if (forceRefresh) params.set('refresh', 'true');

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${baseUrl}/api/admin/analytics${queryString}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401) {
      setStoredAdminToken(null);
      throw new Error('Unauthenticated');
    }
    throw new Error('Failed to fetch analytics report');
  }

  return (await response.json()) as AdminAnalyticsReport;
}

export async function searchAdminUsers(
  query?: string,
  status?: string,
  page = 1,
  limit = 10,
): Promise<AdminUserDirectoryResponse> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated');

  const baseUrl = getBaseUrl();
  const params = new URLSearchParams();
  if (query?.trim()) params.set('query', query.trim());
  if (status && status !== 'ALL') params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));
  const qString = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(`${baseUrl}/api/admin/users${qString}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401) {
      setStoredAdminToken(null);
      throw new Error('Unauthenticated');
    }
    throw new Error('Failed to search user directory');
  }

  return (await response.json()) as AdminUserDirectoryResponse;
}

export async function downloadAdminAnalyticsCSV(asOfDate?: string) {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated');

  const baseUrl = getBaseUrl();
  const qParam = asOfDate ? `?asOf=${encodeURIComponent(asOfDate)}` : '';
  const response = await fetch(`${baseUrl}/api/admin/export${qParam}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to export CSV report');

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `muday-analytics-${asOfDate ?? new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchAdminUserProfile(
  userId: string,
  page = 1,
  limit = 10,
): Promise<AdminUserProfileDetail> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated');

  const baseUrl = getBaseUrl();
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));

  const response = await fetch(
    `${baseUrl}/api/admin/users/${encodeURIComponent(userId)}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  if (!response.ok) throw new Error('Failed to fetch user profile details');
  return (await response.json()) as AdminUserProfileDetail;
}

export async function updateAdminUserStatus(userId: string, status: 'ACTIVE' | 'PAUSED') {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated');

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) throw new Error('Failed to update user status');
  return (await response.json()) as { success: boolean; user: { id: string; status: string } };
}

export async function fetchAdminSystemHealth(): Promise<AdminSystemHealth> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated');

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/admin/system-health`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) throw new Error('Failed to fetch system health diagnostics');
  return (await response.json()) as AdminSystemHealth;
}

export async function fetchAdminVoiceErrors(): Promise<AdminVoiceErrorItem[]> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated');

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/admin/voice-errors`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) throw new Error('Failed to fetch voice error log');
  return (await response.json()) as AdminVoiceErrorItem[];
}

export async function purgeAdminAnalyticsCache() {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated');

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/admin/cache/purge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to purge Redis cache');
  return (await response.json()) as { success: boolean; message: string };
}

export async function sendAdminAiMessage(
  message: string,
  sessionId?: string,
): Promise<AdminAiChatResponse> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated. Please log in again.');

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/admin/ai/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: message.trim(), sessionId }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized. Please log in again.');
    if (response.status === 429) {
      throw new Error('Too many requests. Please wait a moment before sending another message.');
    }
    throw new Error('Failed to process AI assistant inquiry');
  }

  return (await response.json()) as AdminAiChatResponse;
}

export async function fetchAdminAiSessions(): Promise<AdminAiSessionSummary[]> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated. Please log in again.');

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/admin/ai/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) throw new Error('Failed to fetch AI sessions');
  const data = (await response.json()) as { sessions?: AdminAiSessionSummary[] };
  return data.sessions ?? [];
}

export async function deleteAdminAiSession(sessionId: string): Promise<void> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated. Please log in again.');

  const baseUrl = getBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/admin/ai/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) throw new Error('Failed to delete AI session');
}

export async function fetchAdminTransactions(
  params: AdminTransactionQueryParams = {},
): Promise<AdminTransactionsResponse> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated');

  const baseUrl = getBaseUrl();
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.platform && params.platform !== 'all') searchParams.set('platform', params.platform);
  if (params.category && params.category !== 'all') searchParams.set('category', params.category);
  if (params.kind) searchParams.set('kind', params.kind);
  if (params.source) searchParams.set('source', params.source);
  if (params.search?.trim()) searchParams.set('search', params.search.trim());
  if (params.minAmount !== undefined) searchParams.set('minAmount', String(params.minAmount));
  if (params.maxAmount !== undefined) searchParams.set('maxAmount', String(params.maxAmount));
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const response = await fetch(`${baseUrl}/api/admin/transactions?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) throw new Error('Failed to fetch transactions');
  return (await response.json()) as AdminTransactionsResponse;
}

export async function fetchAdminBankingAnalytics(
  timeRange: '7d' | '30d' | '90d' | 'all' = '30d',
): Promise<AdminBankingAnalyticsResponse> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated');

  const baseUrl = getBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/admin/transactions/banking-analytics?timeRange=${timeRange}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  if (!response.ok) throw new Error('Failed to fetch banking analytics');
  return (await response.json()) as AdminBankingAnalyticsResponse;
}

export async function exportAdminAiDirect(
  payload: AdminAiDirectExportPayload,
): Promise<AdminAiDirectExportResponse> {
  const token = getStoredAdminToken();
  if (!token) throw new Error('Unauthenticated. Please log in again.');

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/admin/ai/export/direct`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error('Failed to generate document export');
  return (await response.json()) as AdminAiDirectExportResponse;
}

export async function downloadAdminAiExportFile(
  downloadUrl: string,
  filename?: string,
): Promise<void> {
  const baseUrl = getBaseUrl();
  const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${baseUrl}${downloadUrl}`;

  try {
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error('Failed to download file from server');
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename || 'Muday_Report');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    // Fallback direct navigation
    window.open(fullUrl, '_blank');
  }
}
