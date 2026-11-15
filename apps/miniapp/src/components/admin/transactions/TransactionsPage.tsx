import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type {
  AdminTransactionExplorerItem,
  AdminTransactionQueryParams,
  PaginationMetadata,
} from '../../../api/admin-types';
import { fetchAdminTransactions } from '../../../api/admin-api';
import type { Locale } from '../../../api/dashboard-types';
import { BankingMarketShareCard } from './BankingMarketShareCard';
import { PlatformDeepDiveCard } from './PlatformDeepDiveCard';
import { CategoryPlatformMatrixCard } from './CategoryPlatformMatrixCard';
import { TransactionFilterToolbar } from './TransactionFilterToolbar';
import { TransactionsTable } from './TransactionsTable';
import { TransactionDetailDrawer } from './TransactionDetailDrawer';

export function TransactionsPage({
  locale,
  onNavigateUser,
}: {
  locale: Locale;
  onNavigateUser?: (userId: string) => void;
}) {
  const [filters, setFilters] = useState<AdminTransactionQueryParams>({
    page: 1,
    limit: 10,
    sortBy: 'occurredAt',
    sortOrder: 'desc',
  });

  const [transactions, setTransactions] = useState<AdminTransactionExplorerItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<AdminTransactionExplorerItem | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminTransactions(filters);
      setTransactions(res.items);
      setPagination(res.pagination);
      if (res.availableCategories?.length) {
        setAvailableCategories(res.availableCategories);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const handleFilterChange = (updates: Partial<AdminTransactionQueryParams>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: 10,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
    });
  };

  const handleSelectPlatformFromCard = (platform: string) => {
    const p = platform.toLowerCase();
    let filterVal: string | undefined = p;
    if (p.includes('telebirr')) filterVal = 'telebirr';
    else if (p.includes('cbe')) filterVal = 'cbe';
    else if (p.includes('dashen') || p.includes('amole')) filterVal = 'dashen';
    else if (p.includes('awash')) filterVal = 'awash';
    else if (p.includes('abyssinia') || p.includes('boa')) filterVal = 'abyssinia';
    else if (p.includes('cash')) filterVal = 'cash';

    setFilters((prev) => ({ ...prev, platform: filterVal, page: 1 }));
  };

  const handleSelectCategoryFromMatrix = (category: string) => {
    setFilters((prev) => ({ ...prev, category, page: 1 }));
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)] border border-[var(--electric-cobalt)]/20 shadow-xs">
              <ArrowLeftRight className="size-5" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[var(--ink-charcoal)] tracking-tight">
                Transactions & Banking Rails Explorer
              </h1>
              <p className="text-xs text-[var(--slate-gray)]">
                Forensic transaction ledger, Ethiopian payment rail market share, and category
                dominance intelligence
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Analytics Section: Market Share, Rail Deep Dive & Dominance Matrix */}
      <div className="space-y-6">
        <BankingMarketShareCard locale={locale} onSelectPlatform={handleSelectPlatformFromCard} />

        <PlatformDeepDiveCard locale={locale} onSelectPlatform={handleSelectPlatformFromCard} />

        <CategoryPlatformMatrixCard
          locale={locale}
          onSelectCategory={handleSelectCategoryFromMatrix}
        />
      </div>

      {/* 3. Filter Hub */}
      <TransactionFilterToolbar
        locale={locale}
        filters={filters}
        availableCategories={availableCategories}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        totalResults={pagination.totalCount}
      />

      {/* 4. Transactions Stream Table */}
      <TransactionsTable
        locale={locale}
        transactions={transactions}
        loading={loading}
        error={error}
        pagination={pagination}
        filters={filters}
        onFilterChange={handleFilterChange}
        onSelectTransaction={(tx) => setSelectedTx(tx)}
        onNavigateUser={onNavigateUser}
      />

      {/* 5. Forensic Detail Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        locale={locale}
        onClose={() => setSelectedTx(null)}
        onNavigateUser={onNavigateUser}
      />
    </div>
  );
}
