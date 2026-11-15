import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Eye,
  Globe,
  MessageSquare,
  Mic,
  PauseCircle,
  PlayCircle,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { fetchAdminUserProfile, updateAdminUserStatus } from '../../api/admin-api';
import { UserAvatar } from '../UserAvatar';
import type {
  AdminTransactionExplorerItem,
  AdminUserProfileDetail,
  AdminUserTransactionItem,
  PaginationMetadata,
} from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';
import { categoryLabels } from '../../i18n/catalogs';
import { FinancialKindBadge } from './FinancialKindBadge';
import { TransactionDetailDrawer } from './transactions/TransactionDetailDrawer';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export function UserDetailsPage({
  userId,
  locale = 'en',
  onBack,
  onStatusChanged,
  canManageUsers = false,
}: {
  userId: string;
  locale?: Locale;
  onBack: () => void;
  onStatusChanged?: () => void;
  canManageUsers?: boolean;
}) {
  const [profile, setProfile] = useState<AdminUserProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [inspectedTx, setInspectedTx] = useState<AdminTransactionExplorerItem | null>(null);

  const handleInspectTx = (tx: AdminUserTransactionItem) => {
    if (!profile) return;
    setInspectedTx({
      id: tx.id,
      groupId: tx.groupId || tx.id,
      amount: tx.amount,
      type:
        tx.kind === 'INCOME' ||
        tx.kind === 'LOAN_RECEIVED' ||
        tx.kind === 'REFUND' ||
        tx.kind === 'REIMBURSEMENT'
          ? 'income'
          : 'expense',
      kind: tx.kind || 'EXPENSE',
      category: tx.category,
      platform: tx.platform ?? null,
      source: tx.source || 'TEXT',
      note: tx.note,
      occurredAt: tx.date,
      createdAt: tx.date,
      user: {
        id: profile.user.id,
        telegramId: profile.user.telegramId ? String(profile.user.telegramId) : null,
        firstName: profile.user.firstName ?? null,
        lastName: profile.user.lastName ?? null,
        username: profile.user.username ?? null,
      },
      group: {
        source: tx.source || 'TEXT',
        rawTranscript: tx.rawTranscript ?? null,
        receiptImagePath: tx.receiptImagePath ?? null,
        sttProvider: null,
        sttModel: tx.source === 'VOICE' ? 'Groq Whisper Large v3' : null,
        extractionModel: 'gemini-2.0-flash',
        promptVersion: 'v1.0.0',
        messageAt: tx.date,
      },
    });
  };

  const loadProfile = (targetPage = page, targetLimit = limit) => {
    setLoading(true);
    setError(null);
    fetchAdminUserProfile(userId, targetPage, targetLimit)
      .then((data) => setProfile(data))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load user profile');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProfile(page, limit);
  }, [userId, page, limit]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleOpenStatusModal = () => {
    if (!profile || togglingStatus) return;
    setShowStatusModal(true);
  };

  const executeStatusToggle = async () => {
    if (!profile || togglingStatus) return;
    const currentStatus = profile.user.status;
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    setTogglingStatus(true);
    try {
      await updateAdminUserStatus(profile.user.id, nextStatus);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              user: { ...prev.user, status: nextStatus },
            }
          : prev,
      );
      setShowStatusModal(false);
      onStatusChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user account status.');
    } finally {
      setTogglingStatus(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
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
    if (p.includes('cbe')) return 'Commercial Bank of Ethiopia (CBE)';
    if (p.includes('telebirr')) return 'Telebirr';
    if (p.includes('dashen') || p.includes('amole')) return 'Dashen Bank';
    if (p.includes('awash')) return 'Awash Bank';
    if (p.includes('abyssinia') || p.includes('boa')) return 'Bank of Abyssinia';
    if (p.includes('cash')) return 'Direct Cash';
    return platform.toUpperCase();
  };

  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-[var(--slate-gray)] space-y-2">
        <span className="size-5 border-2 border-[var(--electric-cobalt)] border-t-transparent rounded-full animate-spin" />
        <span>Loading user ledger…</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] px-3 py-1.5 text-xs font-medium text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Directory</span>
        </button>
        <div className="flex items-center justify-between p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-600">
          <span>{error ?? 'User not found'}</span>
          <button
            type="button"
            onClick={() => loadProfile()}
            className="rounded-lg border border-red-500/30 px-2 py-1 text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { user, summary, transactions } = profile;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Telegram User';
  const username = user.username ? `@${user.username}` : '';
  const isPaused = user.status === 'PAUSED';

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* 1. Back Navigation & Action Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] px-3 py-1.5 text-xs font-medium text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Directory</span>
        </button>

        {canManageUsers ? (
          <button
            type="button"
            onClick={handleOpenStatusModal}
            disabled={togglingStatus}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              isPaused
                ? 'bg-[#2f9e6e] text-white hover:bg-[#25825a]'
                : 'border border-[var(--border-hairline)] bg-[var(--pure-white)] text-[#c27803] hover:bg-[var(--surface-ivory)]'
            }`}
          >
            {isPaused ? <PlayCircle className="size-3.5" /> : <PauseCircle className="size-3.5" />}
            <span>{isPaused ? 'Re-activate Account' : 'Pause Account'}</span>
          </button>
        ) : null}
      </div>

      {/* 2. User Profile Header Card */}
      <section className="rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <UserAvatar
              userId={user.id}
              name={fullName || username}
              size="lg"
              allowPreview={true}
              className="shrink-0"
            />

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[18px] font-semibold text-[var(--ink-charcoal)] tracking-tight">
                  {fullName}
                </h2>
                {username ? (
                  <span className="text-xs text-[var(--slate-gray)] font-medium">{username}</span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    user.status === 'ACTIVE'
                      ? 'bg-[#5ecf9a]/15 text-[#2f9e6e]'
                      : user.status === 'PAUSED'
                        ? 'bg-[#f0a04b]/15 text-[#c27803]'
                        : 'bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)]'
                  }`}
                >
                  {user.status}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-[var(--slate-gray)] flex-wrap">
                <div className="flex items-center gap-1">
                  <span>UUID:</span>
                  <code className="text-[11px] font-mono text-[var(--ink-charcoal)]">
                    {user.id.slice(0, 8)}…
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(user.id, 'uuid')}
                    className="p-0.5 text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)]"
                  >
                    {copiedField === 'uuid' ? (
                      <Check className="size-3 text-[#2f9e6e]" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>

                {user.telegramId ? (
                  <div className="flex items-center gap-1">
                    <span>TG ID:</span>
                    <code className="text-[11px] font-mono text-[var(--ink-charcoal)]">
                      {user.telegramId}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(user.telegramId!, 'tgid')}
                      className="p-0.5 text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)]"
                    >
                      {copiedField === 'tgid' ? (
                        <Check className="size-3 text-[#2f9e6e]" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                ) : null}

                <div className="flex items-center gap-1">
                  <Globe className="size-3 text-[var(--electric-cobalt)]" />
                  <span>{user.language === 'am' ? 'Amharic' : 'English'}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Calendar className="size-3 text-[var(--slate-gray)]" />
                  <span>Joined: {user.createdAt.slice(0, 10)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-ivory)] px-3 py-1.5 text-xs text-[var(--ink-charcoal)] font-medium">
              <ShieldCheck className="size-3.5 text-[var(--electric-cobalt)]" />
              <span>Consent: {user.consentVersion ? `v${user.consentVersion}` : 'Pending'}</span>
            </span>
          </div>
        </div>
      </section>

      {/* 3. Financial Summary Metric Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none">
          <p className="text-[12px] font-medium text-[var(--slate-gray)]">Total Volume Logged</p>
          <p className="mt-2 text-[20px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
            {formatETB(summary.totalVolumeEtb)}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--steel-gray)]">Lifetime transactions</p>
        </div>

        <div className="rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none">
          <p className="text-[12px] font-medium text-[var(--slate-gray)]">Transactions Logged</p>
          <p className="mt-2 text-[20px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
            {summary.totalTransactions}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--steel-gray)]">All channels</p>
        </div>

        <div className="rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none">
          <p className="text-[12px] font-medium text-[var(--slate-gray)]">Voice / Text Groups</p>
          <p className="mt-2 text-[20px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
            {summary.voiceGroups ?? 0}{' '}
            <span className="text-xs font-normal text-[var(--slate-gray)]">voice</span> /{' '}
            {summary.textGroups ?? 0}{' '}
            <span className="text-xs font-normal text-[var(--slate-gray)]">text</span>
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--steel-gray)]">Input modalities</p>
        </div>

        <div className="rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none">
          <p className="text-[12px] font-medium text-[var(--slate-gray)]">Scanned Receipts</p>
          <p className="mt-2 text-[20px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
            {summary.receiptGroups ?? 0}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--steel-gray)]">OCR parsed groups</p>
        </div>
      </div>

      {/* 4. Transaction History Ledger Table */}
      <section className="flex flex-col justify-between min-h-[660px] overflow-hidden rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none">
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-[var(--ink-charcoal)]">
            Transaction History Ledger
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
            Full chronological stream with category classification and input channels
          </p>
        </div>

        <div className="min-h-[520px] flex-1 overflow-x-auto">
          {transactions.items.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--slate-gray)]">
              No transactions recorded for this user yet.
            </div>
          ) : (
            <table className="w-full min-w-[700px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-[11px] font-semibold tracking-[0.04em] text-[var(--slate-gray)] uppercase">
                  <th className="pb-3 pr-3 font-semibold">Date & Time</th>
                  <th className="pb-3 pr-3 font-semibold">Event Kind</th>
                  <th className="pb-3 pr-3 font-semibold">Category</th>
                  <th className="pb-3 pr-3 font-semibold text-right">Amount</th>
                  <th className="pb-3 pr-3 font-semibold">Platform</th>
                  <th className="pb-3 pr-3 font-semibold">Channel</th>
                  <th className="pb-3 pr-3 font-semibold">Note / Description</th>
                  <th className="pb-3 text-right font-semibold">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {transactions.items.map((tx: AdminUserTransactionItem) => {
                  const categoryLabel = categoryLabels[locale][tx.category] ?? tx.category;
                  const isIncoming =
                    tx.kind === 'INCOME' ||
                    tx.kind === 'LOAN_RECEIVED' ||
                    tx.kind === 'REFUND' ||
                    tx.kind === 'REIMBURSEMENT';

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => handleInspectTx(tx)}
                      className="border-b border-[var(--border-hairline)] last:border-0 hover:bg-[var(--surface-ivory)] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 pr-3 text-xs tabular-nums text-[var(--slate-gray)] whitespace-nowrap">
                        {tx.date ? tx.date.slice(0, 16).replace('T', ' ') : '—'}
                      </td>

                      <td className="py-3 pr-3 whitespace-nowrap">
                        <FinancialKindBadge kind={tx.kind} locale={locale} size="sm" />
                      </td>

                      <td className="py-3 pr-3 font-medium text-[var(--ink-charcoal)]">
                        {categoryLabel}
                      </td>

                      <td className="py-3 pr-3 text-right tabular-nums font-semibold whitespace-nowrap">
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

                      <td className="py-3 pr-3">
                        {tx.platform ? (
                          <span className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--surface-ivory)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-charcoal)]">
                            {formatPlatform(tx.platform)}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--slate-gray)]">—</span>
                        )}
                      </td>

                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--slate-gray)]">
                          {tx.source === 'VOICE' ? (
                            <Mic className="size-3.5 text-[#10b981]" />
                          ) : tx.source === 'RECEIPT' ? (
                            <Receipt className="size-3.5 text-[#2f9e6e]" />
                          ) : (
                            <MessageSquare className="size-3.5 text-[#3d8bfd]" />
                          )}
                          <span className="capitalize">{tx.source?.toLowerCase() ?? 'text'}</span>
                          {tx.receiptImagePath && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 ml-1"
                              title="Receipt photo attached"
                            >
                              📷 Photo
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 pr-3 text-xs text-[var(--slate-gray)] max-w-xs truncate">
                        {tx.note || '—'}
                      </td>

                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectTx(tx);
                          }}
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] text-[var(--slate-gray)] hover:text-[var(--electric-cobalt)] hover:border-[var(--electric-cobalt)]/40 transition-all cursor-pointer shadow-2xs"
                          title="Inspect full transaction"
                        >
                          <Eye className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {transactions.pagination ? (
          <div className="mt-4 pt-3 border-t border-[var(--border-hairline)]">
            <PaginationFooter
              pagination={transactions.pagination}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              disabled={loading}
            />
          </div>
        ) : null}
      </section>

      {/* 5. Account Status Confirmation Dialog */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md rounded-2xl bg-[var(--pure-white)] border border-[var(--border-hairline)] p-6">
          <DialogHeader>
            <div
              className={`flex size-10 items-center justify-center rounded-xl mb-2 border ${
                isPaused
                  ? 'bg-[#5ecf9a]/15 text-[#2f9e6e] border-[#5ecf9a]/30'
                  : 'bg-[#f0a04b]/15 text-[#c27803] border-[#f0a04b]/30'
              }`}
            >
              {isPaused ? <PlayCircle className="size-5" /> : <PauseCircle className="size-5" />}
            </div>
            <DialogTitle className="text-[18px] font-semibold text-[var(--ink-charcoal)]">
              {isPaused ? 'Re-activate User Account?' : 'Pause User Account?'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--slate-gray)] mt-1">
              {isPaused
                ? `Are you sure you want to re-activate the account for ${fullName}? This will restore their Telegram bot access.`
                : `Are you sure you want to pause the account for ${fullName}? This will temporarily halt their Telegram bot access.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] px-3 py-1.5 text-xs font-medium text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] cursor-pointer"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white cursor-pointer ${
                isPaused ? 'bg-[#2f9e6e] hover:bg-[#25825a]' : 'bg-[#d94a40] hover:bg-[#b83d34]'
              }`}
              onClick={() => void executeStatusToggle()}
              disabled={togglingStatus}
            >
              {togglingStatus ? 'Updating…' : isPaused ? 'Confirm Activation' : 'Confirm Pause'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Transaction Detail Inspection Drawer */}
      {inspectedTx && (
        <TransactionDetailDrawer
          transaction={inspectedTx}
          locale={locale}
          onClose={() => setInspectedTx(null)}
        />
      )}
    </div>
  );
}

export function PaginationFooter({
  pagination,
  onPageChange,
  onLimitChange,
  disabled,
}: {
  pagination: PaginationMetadata;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  disabled?: boolean;
}) {
  const { currentPage, totalPages, totalCount, hasNextPage, hasPreviousPage, limit } = pagination;

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[var(--slate-gray)]">
      {/* 1. Left: Record counts & Rows selector */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <div>
          Showing page <strong className="text-[var(--ink-charcoal)]">{currentPage}</strong> of{' '}
          <strong className="text-[var(--ink-charcoal)]">{totalPages}</strong> ({totalCount} total
          records)
        </div>
        <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border-hairline)]">
          <span className="text-[11px]">Rows:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="h-7 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-ivory)] px-2 text-xs font-medium text-[var(--ink-charcoal)] outline-none cursor-pointer"
            disabled={disabled}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* 2. Center: Centered Pagination Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          className="h-8 px-3.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] text-xs font-semibold text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
          disabled={disabled || !hasPreviousPage}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </button>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--electric-cobalt)] text-white px-3 font-bold text-xs shadow-xs">
          {currentPage}
        </span>
        <button
          type="button"
          className="h-8 px-3.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] text-xs font-semibold text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
          disabled={disabled || !hasNextPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>

      {/* 3. Right: Spacer for balance */}
      <div className="hidden md:block w-36" aria-hidden="true" />
    </div>
  );
}
