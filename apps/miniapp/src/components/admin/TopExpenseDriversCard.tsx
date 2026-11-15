import type { AdminAnalyticsReport } from '../../api/admin-types';

const DEFAULT_EXPENSE_DRIVERS = [
  { name: 'Food & Groceries', amount: 'ETB 8,420,000', percent: 78 },
  { name: 'Housing & Rent', amount: 'ETB 6,150,000', percent: 56 },
  { name: 'Transport & Fuel', amount: 'ETB 4,300,000', percent: 39 },
  { name: 'Utilities & Airtime', amount: 'ETB 2,100,000', percent: 22 },
  { name: 'Personal & Healthcare', amount: 'ETB 980,000', percent: 11 },
];

export function TopExpenseDriversCard({ report }: { report?: AdminAnalyticsReport }) {
  const drivers = report?.financials?.topCategories?.length
    ? report.financials.topCategories.map((c) => ({
        name: c.category.toUpperCase().replace(/_/g, ' '),
        amount: `ETB ${Math.round(Number(c.amountEtb)).toLocaleString()}`,
        percent: Math.min(100, Math.round(parseFloat(c.percentage) || 20)),
      }))
    : DEFAULT_EXPENSE_DRIVERS;

  return (
    <section className="flex flex-col justify-between rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
            Top Spending Categories
          </h2>
          <span className="text-[11px] font-medium text-[var(--slate-gray)]">
            ETB{' '}
            {report?.financials?.totalExpenseVolumeEtb
              ? Math.round(Number(report.financials.totalExpenseVolumeEtb)).toLocaleString()
              : report?.financials?.totalVolumeEtb
                ? Math.round(Number(report.financials.totalVolumeEtb)).toLocaleString()
                : '0'}{' '}
            Spent
          </span>
        </div>
        <p className="text-[12px] text-[var(--slate-gray)] mb-4">
          What users spend the most money on
        </p>

        <div className="space-y-3.5">
          {drivers.map((item, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--ink-charcoal)] truncate max-w-[170px]">
                  {item.name}
                </span>
                <span className="font-semibold text-[var(--ink-charcoal)] tabular-nums">
                  {item.amount}
                </span>
              </div>
              {/* Progress Track */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-ivory)]">
                <div
                  className="h-full rounded-full bg-[#10b981] transition-all duration-500"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
