import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { fetchAdminUserProfile, updateAdminUserStatus } from '../../api/admin-api';
import { UserAvatar } from '../UserAvatar';
import type { AdminUserProfileDetail, AdminUserTransactionItem } from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';
import { categoryLabels } from '../../i18n/catalogs';
import { FinancialKindBadge } from './FinancialKindBadge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

export function UserProfileModal({
  userId,
  locale = 'en',
  onClose,
  onStatusChanged,
}: {
  userId: string;
  locale?: Locale;
  onClose: () => void;
  onStatusChanged?: () => void;
}) {
  const [profile, setProfile] = useState<AdminUserProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const loadProfile = () => {
    setLoading(true);
    setError(null);
    fetchAdminUserProfile(userId)
      .then((data) => setProfile(data))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load user profile');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const handleToggleStatus = async () => {
    if (!profile) return;
    const newStatus = profile.user.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    setTogglingStatus(true);
    try {
      await updateAdminUserStatus(profile.user.id, newStatus);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              user: { ...prev.user, status: newStatus },
            }
          : null,
      );
      onStatusChanged?.();
    } catch {
      alert('Failed to update user account status.');
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleExportJSON = () => {
    if (!profile) return;
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(profile, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `user-report-${profile.user.id}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const formatETB = (val?: string | number) => {
    if (!val) return '0.00 ETB';
    return `${new Intl.NumberFormat(locale === 'am' ? 'am-ET' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(val))} ETB`;
  };

  const formatPlatform = (platform?: string | null) => {
    if (!platform) return '—';
    const p = platform.toLowerCase();
    if (p.includes('cbe')) return 'CBE';
    if (p.includes('telebirr')) return 'Telebirr';
    if (p.includes('dashen') || p.includes('amole')) return 'Dashen';
    if (p.includes('awash')) return 'Awash';
    if (p.includes('abyssinia') || p.includes('boa')) return 'Abyssinia';
    if (p.includes('cash')) return 'Cash';
    return platform.toUpperCase();
  };

  const fullName = profile
    ? [profile.user.firstName, profile.user.lastName].filter(Boolean).join(' ') || 'Telegram User'
    : 'User';

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-2xl bg-[var(--pure-white)] border border-[var(--border-hairline)] shadow-xl">
        <DialogHeader className="pb-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-[17px] font-semibold text-[var(--ink-charcoal)]">
                User Profile & Quick View
              </DialogTitle>
              {profile ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    profile.user.status === 'ACTIVE'
                      ? 'bg-[#5ecf9a]/15 text-[#2f9e6e]'
                      : 'bg-[#f0a04b]/15 text-[#c27803]'
                  }`}
                >
                  {profile.user.status}
                </span>
              ) : null}
            </div>
            {profile ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] px-2.5 py-1 text-xs font-medium text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] mr-6 cursor-pointer"
                onClick={handleExportJSON}
              >
                <Download className="size-3.5" />
                <span>Export JSON</span>
              </button>
            ) : null}
          </div>
          <DialogDescription className="text-xs text-[var(--slate-gray)]">
            Inspect profile metadata, consent records, and latest transactions.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8 text-xs text-[var(--slate-gray)] gap-2">
            <span className="size-4 border-2 border-[var(--electric-cobalt)] border-t-transparent rounded-full animate-spin" />
            <span>Loading user record…</span>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center justify-between p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-600">
            <span>{error}</span>
            <button
              type="button"
              onClick={loadProfile}
              className="rounded-lg border border-red-500/30 px-2 py-1 text-xs"
            >
              Retry
            </button>
          </div>
        ) : null}

        {profile && !loading ? (
          <div className="space-y-4 pt-2">
            {/* Identity Details */}
            <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    userId={profile.user.id}
                    name={fullName}
                    size="md"
                    allowPreview={true}
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-[var(--ink-charcoal)] truncate">
                      {fullName}
                    </p>
                    <p className="text-[11px] text-[var(--slate-gray)]">
                      {profile.user.username ? `@${profile.user.username}` : 'No Telegram handle'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={togglingStatus}
                    onClick={() => {
                      void handleToggleStatus();
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors cursor-pointer ${
                      profile.user.status === 'ACTIVE'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20'
                        : 'border-[#5ecf9a]/30 bg-[#5ecf9a]/10 text-[#2f9e6e] hover:bg-[#5ecf9a]/20'
                    }`}
                  >
                    {togglingStatus
                      ? 'Updating…'
                      : profile.user.status === 'ACTIVE'
                        ? 'Pause User'
                        : 'Re-activate'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--border-hairline)] text-[11px]">
                <div>
                  <span className="text-[var(--slate-gray)]">Telegram ID:</span>
                  <p className="font-mono font-medium text-[var(--ink-charcoal)]">
                    {profile.user.telegramId || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--slate-gray)]">Language:</span>
                  <p className="font-medium text-[var(--ink-charcoal)]">
                    {profile.user.language === 'AM' ? 'Amharic (AM)' : 'English (EN)'}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--slate-gray)]">Joined:</span>
                  <p className="font-medium text-[var(--ink-charcoal)]">
                    {profile.user.createdAt.slice(0, 10)}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--slate-gray)]">Consent:</span>
                  <p className="font-medium text-[var(--ink-charcoal)]">
                    {profile.user.consentVersion
                      ? `v${profile.user.consentVersion}`
                      : 'Not Completed'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] text-center">
                <span className="text-[11px] text-[var(--slate-gray)]">Transactions</span>
                <p className="text-base font-bold text-[var(--ink-charcoal)]">
                  {profile.summary.totalTransactions}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] text-center">
                <span className="text-[11px] text-[var(--slate-gray)]">Tx Groups</span>
                <p className="text-base font-bold text-[var(--ink-charcoal)]">
                  {profile.summary.totalGroups}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] text-center">
                <span className="text-[11px] text-[var(--slate-gray)]">Total Volume</span>
                <p className="text-base font-bold text-[var(--ink-charcoal)]">
                  {formatETB(profile.summary.totalVolumeEtb)}
                </p>
              </div>
            </div>

            {/* Recent 10 Transactions Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--ink-charcoal)] uppercase tracking-wider">
                Recent Transactions
              </h3>
              <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-ivory)] text-[10px] font-semibold uppercase text-[var(--slate-gray)] border-b border-[var(--border-hairline)]">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Kind</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-right">Amount</th>
                      <th className="p-2.5">Platform</th>
                      <th className="p-2.5">Channel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.transactions.items.slice(0, 5).map((tx: AdminUserTransactionItem) => {
                      const isIncoming =
                        tx.kind === 'INCOME' ||
                        tx.kind === 'LOAN_RECEIVED' ||
                        tx.kind === 'REFUND' ||
                        tx.kind === 'REIMBURSEMENT';

                      return (
                        <tr
                          key={tx.id}
                          className="border-b border-[var(--border-hairline)] last:border-0"
                        >
                          <td className="p-2.5 text-xs text-[var(--slate-gray)] whitespace-nowrap">
                            {tx.date?.slice(0, 10)}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <FinancialKindBadge kind={tx.kind} locale={locale} size="xs" />
                          </td>
                          <td className="p-2.5 font-medium text-[var(--ink-charcoal)]">
                            {categoryLabels[locale][tx.category] ?? tx.category}
                          </td>
                          <td className="p-2.5 text-right tabular-nums font-semibold whitespace-nowrap">
                            <span
                              className={
                                isIncoming
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-[var(--ink-charcoal)]'
                              }
                            >
                              {isIncoming ? '+' : ''}
                              {formatETB(tx.amount)}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {tx.platform ? (
                              <span className="inline-flex rounded border border-[var(--border-hairline)] bg-[var(--surface-ivory)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-charcoal)]">
                                {formatPlatform(tx.platform)}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--slate-gray)]">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-xs text-[var(--slate-gray)] capitalize">
                            {tx.source?.toLowerCase()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
