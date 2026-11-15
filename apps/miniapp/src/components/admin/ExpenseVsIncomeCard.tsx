import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminAnalyticsReport } from '../../api/admin-types';

export function ExpenseVsIncomeCard({ report }: { report?: AdminAnalyticsReport }) {
  const eventKinds = report?.eventKinds ?? [];

  const chartData = eventKinds.map((item) => {
    const rawNum =
      typeof item.volumeEtb === 'string'
        ? parseFloat(item.volumeEtb.replace(/[^0-9.-]/g, '')) || 0
        : Number(item.volumeEtb) || 0;
    return {
      name: item.label,
      volume: rawNum,
      count: item.count,
      percentage: item.percentage,
      color: item.color || '#10b981',
    };
  });

  const totalVolume = chartData.reduce((acc, curr) => acc + curr.volume, 0);

  return (
    <section className="flex flex-col rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
          Financial Event Types
        </h2>
        <span className="text-[11px] font-medium text-[var(--slate-gray)]">
          Total ETB {totalVolume.toLocaleString()}
        </span>
      </div>
      <p className="text-[12px] text-[var(--slate-gray)] mb-4">
        Ledger volume and event count classified by transaction kind
      </p>

      {chartData.length > 0 ? (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border-hairline)"
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--slate-gray)', fontSize: 10 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--slate-gray)', fontSize: 10 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const first = payload?.[0];
                  if (active && first && first.payload) {
                    const data = first.payload as {
                      name: string;
                      volume: number;
                      percentage: string;
                      count: number;
                    };
                    return (
                      <div className="rounded-[8px] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-2.5 shadow-sm text-xs">
                        <p className="font-semibold text-[var(--ink-charcoal)]">{data.name}</p>
                        <p className="mt-1 text-[var(--slate-gray)]">
                          Volume:{' '}
                          <span className="font-semibold text-[var(--ink-charcoal)]">
                            ETB {data.volume.toLocaleString()}
                          </span>{' '}
                          ({data.percentage}%)
                        </p>
                        <p className="text-[var(--slate-gray)]">
                          Count:{' '}
                          <span className="font-semibold text-[var(--ink-charcoal)]">
                            {data.count} txs
                          </span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="volume" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[180px] w-full flex-col items-center justify-center rounded-[var(--radius-cards)] border border-dashed border-[var(--border-hairline)] p-6 text-center">
          <p className="text-[13px] font-medium text-[var(--slate-gray)]">
            No transaction kinds recorded
          </p>
          <p className="mt-1 text-[11px] text-[var(--steel-gray)]">
            Event types (Expense, Income, Loan, Refund) will display as entries are logged.
          </p>
        </div>
      )}
    </section>
  );
}
