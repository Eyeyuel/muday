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

export function ExecutiveRevenueWaveCard({ report }: { report?: AdminAnalyticsReport }) {
  const chartData = report?.dailyWave ?? [];

  return (
    <section className="flex flex-col rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
            Daily Money Tracked (Last 14 Days)
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
            Daily total money logged by users compared to the previous 2 weeks
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] font-medium text-[var(--slate-gray)]">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#10b981]" />
            <span className="text-[var(--ink-charcoal)] font-semibold">Last 14 Days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#64748b]" />
            <span>Previous 14 Days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#34d399]" />
            <span>Expected Average</span>
          </div>
        </div>
      </div>

      {/* Recharts Multi-Wave Chart */}
      {chartData.length > 0 ? (
        <div className="h-[240px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="waveCurrentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="wavePriorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="waveForecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border-hairline)"
              />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--slate-gray)', fontSize: 10 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--slate-gray)', fontSize: 10 }}
                tickFormatter={(val) => `${val}k`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] p-2.5 shadow-lg text-xs space-y-1">
                        <p className="font-semibold text-[var(--ink-charcoal)]">{label}</p>
                        {payload.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-[var(--slate-gray)] capitalize">
                              {entry.name}:
                            </span>
                            <span className="font-semibold text-[var(--ink-charcoal)]">
                              ETB {Number(entry.value).toLocaleString()}k
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="#34d399"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#waveForecastGrad)"
              />
              <Area
                type="monotone"
                dataKey="prior"
                stroke="#64748b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#wavePriorGrad)"
              />
              <Area
                type="monotone"
                dataKey="current"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#waveCurrentGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[240px] w-full flex-col items-center justify-center rounded-[var(--radius-cards)] border border-dashed border-[var(--border-hairline)] p-6 text-center">
          <p className="text-[13px] font-medium text-[var(--slate-gray)]">
            No daily wave data recorded
          </p>
          <p className="mt-1 text-[11px] text-[var(--steel-gray)]">
            Multi-wave intake comparison will populate as daily transaction volume accumulates.
          </p>
        </div>
      )}
    </section>
  );
}
