import { useState, useEffect } from 'react';
import { Search, X, RotateCcw, ArrowUpDown } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import type { AdminTransactionQueryParams } from '../../../api/admin-types';
import type { Locale } from '../../../api/dashboard-types';
import { categoryLabels } from '../../../i18n/catalogs';
import { BankLogo } from '../BankLogo';

export function TransactionFilterToolbar({
  locale,
  filters,
  availableCategories = [],
  onFilterChange,
  onReset,
  totalResults,
}: {
  locale: Locale;
  filters: AdminTransactionQueryParams;
  availableCategories?: string[];
  onFilterChange: (updates: Partial<AdminTransactionQueryParams>) => void;
  onReset: () => void;
  totalResults?: number;
}) {
  const [searchTerm, setSearchTerm] = useState(filters.search ?? '');

  // Sync external filter changes (e.g. Reset or external filter selection)
  useEffect(() => {
    setSearchTerm(filters.search ?? '');
  }, [filters.search]);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchTerm.trim();
      const current = filters.search?.trim() || '';
      if (trimmed !== current) {
        onFilterChange({ search: trimmed ? trimmed : undefined, page: 1 });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, filters.search, onFilterChange]);

  const handleClearSearch = () => {
    setSearchTerm('');
    onFilterChange({ search: undefined, page: 1 });
  };

  const platforms = [
    { id: 'all', label: 'All Rails' },
    { id: 'telebirr', label: 'Telebirr' },
    { id: 'cbe', label: 'CBE' },
    { id: 'dashen', label: 'Dashen' },
    { id: 'awash', label: 'Awash' },
    { id: 'abyssinia', label: 'Abyssinia' },
    { id: 'cash', label: 'Cash' },
  ];

  const standardCategories = [
    'food_groceries',
    'transportation',
    'housing_rent',
    'utilities',
    'healthcare',
    'education',
    'shopping',
    'airtime_internet',
    'debt_repayment',
    'entertainment',
    'other',
  ];

  // Combine standard catalog categories with real dynamic categories found in the DB
  const categoriesList = Array.from(
    new Set([...standardCategories, ...availableCategories.filter(Boolean)]),
  );

  const getCategoryDisplay = (cat: string) => {
    if (categoryLabels[locale][cat]) return categoryLabels[locale][cat];
    return cat.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const hasActiveFilters = Boolean(
    (filters.platform && filters.platform !== 'all') ||
    (filters.category && filters.category !== 'all') ||
    filters.kind ||
    filters.source ||
    filters.search?.trim() ||
    filters.minAmount !== undefined ||
    filters.maxAmount !== undefined ||
    filters.startDate ||
    filters.endDate,
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none">
      {/* Top Search and Shadcn Dropdowns */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--slate-gray)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search note, category, @handle, or user name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/80 py-2 pr-9 pl-9 text-xs text-[var(--ink-charcoal)] placeholder:text-[var(--slate-gray)] outline-none focus:border-[var(--electric-cobalt)] focus:bg-[var(--pure-white)] transition-colors"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Shadcn Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dynamic Category Dropdown */}
          <Select
            value={filters.category ?? 'all'}
            onValueChange={(val) =>
              onFilterChange({
                category: val === 'all' ? undefined : val,
                page: 1,
              })
            }
          >
            <SelectTrigger className="h-9 min-w-[140px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/80 px-3 text-xs font-semibold text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] transition-colors shadow-2xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="max-h-72 min-w-[160px]">
              <SelectItem value="all">All Categories</SelectItem>
              {categoriesList.map((c) => (
                <SelectItem key={c} value={c}>
                  {getCategoryDisplay(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Kind Dropdown */}
          <Select
            value={filters.kind ?? 'all'}
            onValueChange={(val) =>
              onFilterChange({
                kind: val === 'all' ? undefined : val,
                page: 1,
              })
            }
          >
            <SelectTrigger className="h-9 min-w-[130px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/80 px-3 text-xs font-semibold text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] transition-colors shadow-2xs">
              <SelectValue placeholder="All Event Kinds" />
            </SelectTrigger>
            <SelectContent className="min-w-[140px]">
              <SelectItem value="all">All Event Kinds</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
              <SelectItem value="LOAN_RECEIVED">Loan Received</SelectItem>
              <SelectItem value="LOAN_REPAYMENT">Debt Repayment</SelectItem>
              <SelectItem value="REFUND">Refund</SelectItem>
              <SelectItem value="REIMBURSEMENT">Reimbursement</SelectItem>
            </SelectContent>
          </Select>

          {/* Ingestion Source Dropdown */}
          <Select
            value={filters.source ?? 'all'}
            onValueChange={(val) =>
              onFilterChange({
                source: val === 'all' ? undefined : val,
                page: 1,
              })
            }
          >
            <SelectTrigger className="h-9 min-w-[135px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/80 px-3 text-xs font-semibold text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] transition-colors shadow-2xs">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent className="min-w-[145px]">
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="TEXT">💬 Text Message</SelectItem>
              <SelectItem value="VOICE">🎤 Voice Note</SelectItem>
              <SelectItem value="RECEIPT">🧾 Scanned Receipt</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Dropdown */}
          <Select
            value={`${filters.sortBy ?? 'occurredAt'}-${filters.sortOrder ?? 'desc'}`}
            onValueChange={(val) => {
              const parts = val.split('-');
              const sortBy = parts[0] as 'occurredAt' | 'amountEtb' | 'category';
              const sortOrder = parts[1] as 'asc' | 'desc';
              onFilterChange({ sortBy, sortOrder, page: 1 });
            }}
          >
            <SelectTrigger className="h-9 min-w-[135px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/80 px-3 text-xs font-semibold text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] transition-colors shadow-2xs gap-1.5">
              <ArrowUpDown className="size-3 text-[var(--slate-gray)] shrink-0" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent align="end" className="min-w-[140px]">
              <SelectItem value="occurredAt-desc">Date: Newest</SelectItem>
              <SelectItem value="occurredAt-asc">Date: Oldest</SelectItem>
              <SelectItem value="amountEtb-desc">Amount: Highest</SelectItem>
              <SelectItem value="amountEtb-asc">Amount: Lowest</SelectItem>
              <SelectItem value="category-asc">Category: A-Z</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset Filters */}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Banking Rail Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[var(--border-hairline)]">
        <span className="text-[11px] font-semibold text-[var(--slate-gray)] mr-1">
          Banking Rails:
        </span>
        {platforms.map((p) => {
          const isSelected =
            p.id === 'all'
              ? !filters.platform || filters.platform === 'all'
              : filters.platform === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onFilterChange({
                  platform: p.id === 'all' ? undefined : p.id,
                  page: 1,
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[var(--electric-cobalt)] text-white shadow-xs'
                  : 'bg-[var(--surface-ivory)]/70 text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] border border-[var(--border-hairline)]'
              }`}
            >
              {p.id !== 'all' ? (
                <BankLogo
                  platform={p.id}
                  className={`size-3.5 rounded-xs ${isSelected ? 'bg-white/20' : ''}`}
                />
              ) : null}
              <span>{p.label}</span>
            </button>
          );
        })}

        {totalResults !== undefined ? (
          <span className="ml-auto text-[11px] text-[var(--slate-gray)] font-medium">
            Found <strong className="text-[var(--ink-charcoal)]">{totalResults}</strong> matches
          </span>
        ) : null}
      </div>
    </div>
  );
}
