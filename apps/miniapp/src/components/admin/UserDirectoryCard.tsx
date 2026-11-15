import { useEffect, useState } from 'react';
import { Check, ChevronRight, Copy, Globe, Search, ShieldCheck, Users, X } from 'lucide-react';
import { searchAdminUsers } from '../../api/admin-api';
import type {
  AdminAnalyticsReport,
  AdminUserDirectoryItem,
  PaginationMetadata,
} from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';
import { useDebounce } from '../../hooks/use-debounce';
import { UserAvatar } from '../UserAvatar';
import { PaginationFooter } from './UserDetailsPage';

export function UserDirectoryCard({
  report,
  locale = 'en',
  onSelectUser,
}: {
  report: AdminAnalyticsReport;
  locale?: Locale;
  onSelectUser?: (userId: string) => void;
}) {
  const { userDirectory } = report;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'PAUSED' | 'PENDING_CONSENT' | 'DELETED'
  >('ALL');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [users, setUsers] = useState<AdminUserDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSearch = async (
    query: string,
    status: string,
    targetPage = page,
    targetLimit = limit,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await searchAdminUsers(query, status, targetPage, targetLimit);
      setUsers(response.items);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void handleSearch(debouncedQuery, statusFilter, page, limit);
  }, [debouncedQuery, statusFilter, page, limit]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatETB = (val?: string) => {
    if (!val) return 'ETB 0.00';
    return `ETB ${new Intl.NumberFormat(locale === 'am' ? 'am-ET' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(val))}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Paused
          </span>
        );
      case 'PENDING_CONSENT':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <span className="size-1.5 rounded-full bg-blue-500" />
            Pending Consent
          </span>
        );
      case 'DELETED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="size-1.5 rounded-full bg-rose-500" />
            Deleted
          </span>
        );
      default:
        return (
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-[var(--surface-ivory)] text-[var(--slate-gray)] border border-[var(--border-hairline)]">
            {status}
          </span>
        );
    }
  };

  return (
    <section className="flex flex-col justify-between min-h-[720px] rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 md:p-6 shadow-none transition-colors">
      {/* 1. Header Section */}
      <div className="flex flex-col gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[17px] font-bold text-[var(--ink-charcoal)] tracking-tight">
                User Directory & Ledgers
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-ivory)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--slate-gray)]">
                <Users className="size-3 text-[var(--electric-cobalt)]" />
                {userDirectory.totalUsers} Total Accounts
              </span>
            </div>
            <p className="mt-1 text-[12px] text-[var(--slate-gray)]">
              Comprehensive list of all registered Telegram users, language preferences, transaction
              counts, and ledger volumes.
            </p>
          </div>

          {/* Quick Metrics Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60 px-2.5 py-1 text-xs">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[var(--slate-gray)]">Consented:</span>
              <span className="font-bold text-[var(--ink-charcoal)]">
                {userDirectory.activeConsentedUsers}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60 px-2.5 py-1 text-xs">
              <Globe className="size-3.5 text-[var(--electric-cobalt)]" />
              <span className="text-[var(--slate-gray)]">Amharic:</span>
              <span className="font-bold text-[var(--ink-charcoal)]">
                {userDirectory.languageBreakdown.AM ?? 0}
              </span>
              <span className="text-[var(--border-hairline)]">|</span>
              <span className="text-[var(--slate-gray)]">English:</span>
              <span className="font-bold text-[var(--ink-charcoal)]">
                {userDirectory.languageBreakdown.EN ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--slate-gray)]" />
            <input
              type="search"
              placeholder="Search by name, @username, Telegram ID, or UUID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/50 ps-9 pe-8 py-2 text-xs text-[var(--ink-charcoal)] placeholder:text-[var(--slate-gray)] outline-none focus-visible:border-[var(--electric-cobalt)] focus-visible:bg-[var(--pure-white)] transition-all shadow-2xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/70 p-1">
            {(['ALL', 'ACTIVE', 'PAUSED', 'PENDING_CONSENT', 'DELETED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[var(--pure-white)] text-[var(--ink-charcoal)] font-semibold shadow-xs border border-[var(--border-hairline)]'
                    : 'text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)]'
                }`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'ALL'
                  ? 'All Accounts'
                  : st === 'ACTIVE'
                    ? 'Active'
                    : st === 'PAUSED'
                      ? 'Paused'
                      : st === 'PENDING_CONSENT'
                        ? 'Pending'
                        : 'Deleted'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. User Directory Table Stream */}
      <div className="mt-4 min-h-[580px] flex-1 overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-[11px] font-semibold tracking-wider text-[var(--slate-gray)] uppercase">
              <th className="pb-3 pl-2 font-medium">User Profile</th>
              <th className="pb-3 px-3 font-medium">Status</th>
              <th className="pb-3 px-3 font-medium">Language</th>
              <th className="pb-3 px-3 font-medium text-right">Transactions</th>
              <th className="pb-3 px-3 font-medium text-right">Total Volume</th>
              <th className="pb-3 px-3 font-medium">Joined Date</th>
              <th className="pb-3 pr-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {loading ? (
              Array.from({ length: 10 }).map((_, idx) => (
                <tr key={`user-skel-${idx}`} className="animate-pulse">
                  {/* User Profile */}
                  <td className="py-3 pl-2">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-full bg-[var(--surface-ivory)] border border-[var(--border-hairline)] shrink-0" />
                      <div className="space-y-1.5 min-w-0 max-w-[130px]">
                        <div className="h-3 w-20 rounded bg-[var(--surface-ivory)]" />
                        <div className="h-2.5 w-14 rounded bg-[var(--surface-ivory)]" />
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <div className="h-5 w-14 rounded-full bg-[var(--surface-ivory)]" />
                  </td>

                  {/* Language */}
                  <td className="py-3 px-3">
                    <div className="h-3 w-16 rounded bg-[var(--surface-ivory)]" />
                  </td>

                  {/* Transactions */}
                  <td className="py-3 px-3 text-right">
                    <div className="h-3 w-12 rounded bg-[var(--surface-ivory)] ml-auto" />
                  </td>

                  {/* Total Volume */}
                  <td className="py-3 px-3 text-right">
                    <div className="h-3.5 w-20 rounded bg-[var(--surface-ivory)] ml-auto" />
                  </td>

                  {/* Joined Date */}
                  <td className="py-3 px-3">
                    <div className="h-3 w-20 rounded bg-[var(--surface-ivory)]" />
                  </td>

                  {/* Action */}
                  <td className="py-3 pr-2 text-right">
                    <div className="size-7 rounded-lg bg-[var(--surface-ivory)] ml-auto" />
                  </td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-rose-500">
                  {error}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-xs text-[var(--slate-gray)]">
                  No user accounts matching the selected criteria.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
                const username = u.username ? `@${u.username}` : '';
                const displayId = u.telegramId ? `TG: ${u.telegramId}` : `ID: ${u.id.slice(0, 8)}`;
                const fullCopyText = u.telegramId ?? u.id;
                const isCopied = copiedId === fullCopyText;

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-[var(--surface-ivory)]/60 transition-colors cursor-pointer group"
                    onClick={() => onSelectUser?.(u.id)}
                  >
                    {/* User Profile */}
                    <td className="py-3 pl-2 pr-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          userId={u.id}
                          name={fullName || username}
                          size="sm"
                          allowPreview={true}
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[var(--ink-charcoal)] group-hover:text-[var(--electric-cobalt)] transition-colors">
                            {fullName || username || 'Telegram User'}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--slate-gray)] mt-0.5">
                            <span className="text-[var(--electric-cobalt)] font-medium">
                              {username ? username : displayId}
                            </span>
                            {username ? <span>•</span> : null}
                            {username ? <span>{displayId}</span> : null}
                            <button
                              type="button"
                              onClick={(e) => copyToClipboard(fullCopyText, e)}
                              className="text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] transition-colors p-0.5 rounded cursor-pointer"
                              title="Copy identifier"
                            >
                              {isCopied ? (
                                <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">{getStatusBadge(u.status)}</td>

                    {/* Language */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--surface-ivory)] px-2 py-0.5 text-[10px] font-semibold text-[var(--slate-gray)]">
                        {u.language === 'AM' ? '🇪🇹 AM' : u.language === 'EN' ? '🇬🇧 EN' : u.language}
                      </span>
                    </td>

                    {/* Transactions */}
                    <td className="py-3 px-3 text-right tabular-nums text-[var(--ink-charcoal)]">
                      <span className="font-semibold">{u.transactionCount.toLocaleString()}</span>
                      <span className="text-[11px] text-[var(--slate-gray)] ml-1">txs</span>
                    </td>

                    {/* Total Volume */}
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-[var(--ink-charcoal)]">
                      {formatETB(u.totalVolumeEtb)}
                    </td>

                    {/* Joined Date */}
                    <td className="py-3 px-3 text-xs tabular-nums text-[var(--slate-gray)]">
                      {u.createdAt.slice(0, 10)}
                    </td>

                    {/* Action */}
                    <td className="py-3 pr-2 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectUser?.(u.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-charcoal)] group-hover:border-[var(--electric-cobalt)]/40 group-hover:bg-[var(--electric-cobalt)]/5 group-hover:text-[var(--electric-cobalt)] transition-all cursor-pointer shadow-2xs"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="size-3 text-[var(--slate-gray)] group-hover:text-[var(--electric-cobalt)] transition-colors" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Pagination Footer */}
      {pagination && !loading && !error ? (
        <div className="mt-4 pt-3 border-t border-[var(--border-hairline)]">
          <PaginationFooter
            pagination={pagination}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            disabled={loading}
          />
        </div>
      ) : null}
    </section>
  );
}
