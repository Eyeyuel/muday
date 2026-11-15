import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminAnalyticsReport } from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-3 shadow-xl backdrop-blur-md text-xs space-y-1.5 min-w-[170px]">
        <p className="font-semibold text-[var(--ink-charcoal)] border-b border-[var(--border-hairline)] pb-1">
          Date: {label}
        </p>
        <div className="space-y-1">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[var(--slate-gray)] text-[11px]">{entry.name}:</span>
              </div>
              <strong className="font-semibold text-[var(--ink-charcoal)] tabular-nums">
                {entry.value.toLocaleString()}
              </strong>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export function TimeSeriesChartCard({ report }: { report: AdminAnalyticsReport; locale?: Locale }) {
  const { timeSeries } = report;

  if (!timeSeries || timeSeries.length === 0) return null;

  const chartData = timeSeries.map((d) => ({
    date: d.date.slice(5),
    'Active Users (DAU)': d.dau,
    'Logged Transactions': d.transactions,
  }));

  return (
    <section className="flex flex-col overflow-hidden rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink-charcoal)]">
            Activity & Transaction Volume
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
            Trailing 14 days · Daily active users vs platform financial transactions
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#10b981]" />
            <span className="text-[var(--slate-gray)]">DAU</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#059669]" />
            <span className="text-[var(--slate-gray)]">Transactions</span>
          </div>
        </div>
      </div>

      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--slate-gray)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--slate-gray)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomChartTooltip />} />

            <Area
              type="monotone"
              dataKey="Active Users (DAU)"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#dauGradient)"
              activeDot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: 'var(--pure-white)' }}
            />
            <Area
              type="monotone"
              dataKey="Logged Transactions"
              stroke="#059669"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#txGradient)"
              activeDot={{ r: 4, stroke: '#3d8bfd', strokeWidth: 2, fill: 'var(--pure-white)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
