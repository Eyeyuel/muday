import { Mic, Receipt, MessageSquare, ArrowUpDown, Eye } from 'lucide-react';
import { UserAvatar } from '../../UserAvatar';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import type {
  AdminTransactionExplorerItem,
  AdminTransactionQueryParams,
  PaginationMetadata,
} from '../../../api/admin-types';
import type { Locale } from '../../../api/dashboard-types';
import { categoryLabels } from '../../../i18n/catalogs';
import { BankLogo } from '../BankLogo';
import { FinancialKindBadge } from '../FinancialKindBadge';

export function TransactionsTable({
  locale,
  transactions,
  loading,
  error,
  pagination,
  filters,
  onFilterChange,
  onSelectTransaction,
  onNavigateUser,
}: {
  locale: Locale;
  transactions: AdminTransactionExplorerItem[];
  loading: boolean;
  error: string | null;
  pagination: PaginationMetadata;
  filters: AdminTransactionQueryParams;
  onFilterChange: (updates: Partial<AdminTransactionQueryParams>) => void;
  onSelectTransaction: (tx: AdminTransactionExplorerItem) => void;
  onNavigateUser?: (userId: string) => void;
}) {
  const formatETB = (val: string | number) => {
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

  const getRailBadgeClass = (platform?: string | null) => {
    if (!platform)
      return 'bg-[var(--surface-ivory)] text-[var(--slate-gray)] border-[var(--border-hairline)]';
    const p = platform.toLowerCase();
    if (p.includes('telebirr')) return 'bg-[#06b6d4]/15 text-[#0891b2] border-[#06b6d4]/30';
    if (p.includes('cbe')) return 'bg-[#8b5cf6]/15 text-[#7c3aed] border-[#8b5cf6]/30';
    if (p.includes('dashen') || p.includes('amole'))
      return 'bg-[#3b82f6]/15 text-[#2563eb] border-[#3b82f6]/30';
    if (p.includes('awash')) return 'bg-[#f59e0b]/15 text-[#d97706] border-[#f59e0b]/30';
    if (p.includes('abyssinia') || p.includes('boa'))
      return 'bg-[#ef4444]/15 text-[#dc2626] border-[#ef4444]/30';
    if (p.includes('cash')) return 'bg-[#10b981]/15 text-[#059669] border-[#10b981]/30';
    return 'bg-[var(--electric-cobalt)]/15 text-[var(--electric-cobalt)] border-[var(--electric-cobalt)]/30';
  };

  const toggleSort = (field: 'occurredAt' | 'amountEtb' | 'category' | 'platform') => {
    if (filters.sortBy === field) {
      onFilterChange({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc', page: 1 });
    } else {
      onFilterChange({ sortBy: field, sortOrder: 'desc', page: 1 });
    }
  };

  return (
    <section className="flex flex-col justify-between min-h-[720px] rounded-2xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 md:p-6 shadow-none transition-colors">
      {/* 1. Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
        <div>
          <h3 className="text-[16px] font-bold text-[var(--ink-charcoal)]">
            Verified Transaction Ledger
          </h3>
          <p className="mt-0.5 text-xs text-[var(--slate-gray)]">
            Real-time feed of multi-modal financial events logged across Telegram bot and companion
            apps
          </p>
        </div>

        <div className="text-xs text-[var(--slate-gray)]">
          Total Records:{' '}
          <strong className="text-[var(--ink-charcoal)]">{pagination.totalCount}</strong>
        </div>
      </div>

      {/* 2. Table Area (Locked min-height for zero layout shift) */}
      <div className="mt-4 min-h-[580px] flex-1 overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-[11px] font-semibold tracking-wider text-[var(--slate-gray)] uppercase select-none">
              <th className="pb-3 pl-2 font-medium">User Profile</th>
              <th
                className="pb-3 px-3 font-medium cursor-pointer hover:text-[var(--ink-charcoal)]"
                onClick={() => toggleSort('occurredAt')}
              >
                <div className="flex items-center gap-1">
                  <span>Date & Time</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th className="pb-3 px-3 font-medium">Event Kind</th>
              <th
                className="pb-3 px-3 font-medium cursor-pointer hover:text-[var(--ink-charcoal)]"
                onClick={() => toggleSort('category')}
              >
                <div className="flex items-center gap-1">
                  <span>Category</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th
                className="pb-3 px-3 font-medium text-right cursor-pointer hover:text-[var(--ink-charcoal)]"
                onClick={() => toggleSort('amountEtb')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Amount</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th
                className="pb-3 px-3 font-medium cursor-pointer hover:text-[var(--ink-charcoal)]"
                onClick={() => toggleSort('platform')}
              >
                <div className="flex items-center gap-1">
                  <span>Platform Rail</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th className="pb-3 px-3 font-medium">Channel</th>
              <th className="pb-3 px-3 font-medium">Note / Description</th>
              <th className="pb-3 pr-2 text-right font-medium">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {loading ? (
              Array.from({ length: pagination.limit || 10 }).map((_, idx) => (
                <tr key={`tx-skel-${idx}`} className="animate-pulse">
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

                  {/* Date & Time */}
                  <td className="py-3 px-3">
                    <div className="h-3 w-24 rounded bg-[var(--surface-ivory)]" />
                  </td>

                  {/* Event Kind */}
                  <td className="py-3 px-3">
                    <div className="h-5 w-20 rounded-md bg-[var(--surface-ivory)]" />
                  </td>

                  {/* Category */}
                  <td className="py-3 px-3">
                    <div className="h-5 w-24 rounded-md bg-[var(--surface-ivory)]" />
                  </td>

                  {/* Amount */}
                  <td className="py-3 px-3 text-right">
                    <div className="h-3.5 w-20 rounded bg-[var(--surface-ivory)] ml-auto" />
                  </td>

                  {/* Platform Rail */}
                  <td className="py-3 px-3">
                    <div className="h-5 w-16 rounded-md bg-[var(--surface-ivory)]" />
                  </td>

                  {/* Channel */}
                  <td className="py-3 px-3">
                    <div className="h-4 w-14 rounded bg-[var(--surface-ivory)]" />
                  </td>

                  {/* Note */}
                  <td className="py-3 px-3">
                    <div className="h-3 w-28 rounded bg-[var(--surface-ivory)]" />
                  </td>

                  {/* Inspect Button */}
                  <td className="py-3 pr-2 text-right">
                    <div className="size-7 rounded-lg bg-[var(--surface-ivory)] ml-auto" />
                  </td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-rose-500">
                  {error}
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-xs text-[var(--slate-gray)]">
                  No transactions match the selected filter criteria.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const isIncome =
                  tx.kind === 'INCOME' ||
                  tx.kind === 'LOAN_RECEIVED' ||
                  tx.kind === 'REFUND' ||
                  tx.kind === 'REIMBURSEMENT';

                const categoryLabel = categoryLabels[locale][tx.category] ?? tx.category;
                const userFullName =
                  [tx.user.firstName, tx.user.lastName].filter(Boolean).join(' ') ||
                  'Telegram User';

                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-[var(--surface-ivory)]/80 transition-colors group cursor-pointer"
                    onClick={() => onSelectTransaction(tx)}
                  >
                    {/* User Profile */}
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          userId={tx.user.id}
                          name={userFullName}
                          size="sm"
                          allowPreview={false}
                          className="shrink-0"
                        />
                        <div className="min-w-0 max-w-[130px]">
                          <span
                            className="font-semibold text-xs text-[var(--ink-charcoal)] block truncate hover:text-[var(--electric-cobalt)]"
                            onClick={(e) => {
                              if (onNavigateUser) {
                                e.stopPropagation();
                                onNavigateUser(tx.user.id);
                              }
                            }}
                          >
                            {userFullName}
                          </span>
                          <span className="text-[10px] text-[var(--slate-gray)] block truncate">
                            {tx.user.username
                              ? `@${tx.user.username}`
                              : `ID: ${tx.user.telegramId || '—'}`}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Date & Time */}
                    <td className="py-3 px-3 tabular-nums text-[11px] text-[var(--slate-gray)] whitespace-nowrap">
                      {tx.occurredAt ? tx.occurredAt.slice(0, 16).replace('T', ' ') : '—'}
                    </td>

                    {/* Event Kind */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <FinancialKindBadge kind={tx.kind} type={tx.type} locale={locale} size="sm" />
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--surface-ivory)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-charcoal)] capitalize">
                        {categoryLabel}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-xs whitespace-nowrap">
                      <span
                        className={
                          isIncome
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-[var(--ink-charcoal)]'
                        }
                      >
                        {isIncome ? '+' : ''}
                        {formatETB(tx.amount)}
                      </span>
                    </td>

                    {/* Platform Rail */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${getRailBadgeClass(
                          tx.platform,
                        )}`}
                      >
                        <BankLogo platform={tx.platform} className="size-3.5" />
                        <span>{formatPlatform(tx.platform)}</span>
                      </span>
                    </td>

                    {/* Channel */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--slate-gray)]">
                        {tx.source === 'VOICE' ? (
                          <Mic className="size-3.5 text-[#10b981]" />
                        ) : tx.source === 'RECEIPT' ? (
                          <Receipt className="size-3.5 text-[#3b82f6]" />
                        ) : (
                          <MessageSquare className="size-3.5 text-[var(--electric-cobalt)]" />
                        )}
                        <span className="capitalize">{tx.source?.toLowerCase() ?? 'text'}</span>
                        {tx.group?.receiptImagePath && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 ml-1"
                            title="Receipt photo attached"
                          >
                            📷 Photo
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Note */}
                    <td className="py-3 px-3 text-xs text-[var(--slate-gray)] max-w-[160px] truncate">
                      {tx.note || '—'}
                    </td>

                    {/* Inspect Button */}
                    <td className="py-3 pr-2 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTransaction(tx);
                        }}
                        className="inline-flex size-7 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] text-[var(--slate-gray)] hover:text-[var(--electric-cobalt)] hover:border-[var(--electric-cobalt)]/40 transition-all cursor-pointer shadow-2xs"
                        title="Inspect transaction"
                      >
                        <Eye className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Centered Pagination Footer (Zero Layout Shift) */}
      <div className="mt-4 pt-4 border-t border-[var(--border-hairline)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[var(--slate-gray)]">
          {/* Left: Record counts & Rows selector */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div>
              Showing page{' '}
              <strong className="text-[var(--ink-charcoal)]">{pagination.currentPage}</strong> of{' '}
              <strong className="text-[var(--ink-charcoal)]">{pagination.totalPages}</strong> (
              {pagination.totalCount} records)
            </div>
            <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border-hairline)]">
              <span className="text-[11px]">Rows:</span>
              <Select
                value={String(pagination.limit)}
                onValueChange={(val) => onFilterChange({ limit: Number(val), page: 1 })}
                disabled={loading}
              >
                <SelectTrigger className="h-7 w-[64px] rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-ivory)] px-2 text-xs font-semibold text-[var(--ink-charcoal)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="min-w-[4.5rem]">
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Center: Centered Pagination Controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              className="h-8 px-3.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] text-xs font-semibold text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              disabled={loading || !pagination.hasPreviousPage}
              onClick={() => onFilterChange({ page: pagination.currentPage - 1 })}
            >
              Previous
            </button>
            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--electric-cobalt)] text-white px-3 font-bold text-xs shadow-xs">
              {pagination.currentPage}
            </span>
            <button
              type="button"
              className="h-8 px-3.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] text-xs font-semibold text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              disabled={loading || !pagination.hasNextPage}
              onClick={() => onFilterChange({ page: pagination.currentPage + 1 })}
            >
              Next
            </button>
          </div>

          {/* Right: Spacer for balance */}
          <div className="hidden md:block w-36" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
