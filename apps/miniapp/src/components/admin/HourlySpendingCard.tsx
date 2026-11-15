import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AdminAnalyticsReport } from '../../api/admin-types';

export function HourlySpendingCard({ report }: { report?: AdminAnalyticsReport }) {
  const hourlyData = report?.hourlySpending ?? [];
  const hasActivity = hourlyData.some((item) => item.count > 0 || item.volumeEtb > 0);
  const totalVolume = hourlyData.reduce((acc, curr) => acc + curr.volumeEtb, 0);

  // Dynamic real calculations from database data
  const peakHourItem = hourlyData.length
    ? [...hourlyData].sort((a, b) => b.volumeEtb - a.volumeEtb)[0]
    : null;

  const daytimeVolume = hourlyData
    .filter((d) => {
      const hour = parseInt(d.hour.split(':')[0] || '0', 10);
      return hour >= 6 && hour < 18;
    })
    .reduce((acc, curr) => acc + curr.volumeEtb, 0);

  const dayPercent = totalVolume > 0 ? Math.round((daytimeVolume / totalVolume) * 100) : 0;
  const nightPercent = totalVolume > 0 ? 100 - dayPercent : 0;

  return (
    <section className="flex flex-col justify-between rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
            Consumer Spending by Hour (EAT)
          </h2>
          <span className="text-[11px] font-medium text-[var(--slate-gray)]">
            Total ETB {totalVolume.toLocaleString()}
          </span>
        </div>
        <p className="text-[12px] text-[var(--slate-gray)] mb-3">
          Distribution of transaction volume across 24-hour East Africa Time
        </p>

        {hasActivity ? (
          <div className="space-y-3.5">
            <div className="h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border-hairline)"
                  />
                  <XAxis
                    dataKey="hour"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--slate-gray)', fontSize: 10 }}
                    interval={2}
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
                        const d = first.payload as {
                          hour: string;
                          volumeEtb: number;
                          count: number;
                        };
                        return (
                          <div className="rounded-[8px] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-2.5 shadow-sm text-xs">
                            <p className="font-semibold text-[var(--ink-charcoal)]">{d.hour} EAT</p>
                            <p className="mt-1 text-[var(--slate-gray)]">
                              Volume:{' '}
                              <span className="font-semibold text-[var(--ink-charcoal)]">
                                ETB {Number(d.volumeEtb).toLocaleString()}
                              </span>
                            </p>
                            <p className="text-[var(--slate-gray)]">
                              Count:{' '}
                              <span className="font-semibold text-[var(--ink-charcoal)]">
                                {d.count} transactions
                              </span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="volumeEtb" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Real Data Micro-Insights */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/40 p-2 text-xs">
                <span className="text-[10px] text-[var(--slate-gray)] font-medium">
                  Peak Spending Hour
                </span>
                <p className="mt-0.5 font-semibold text-[var(--ink-charcoal)]">
                  {peakHourItem ? `${peakHourItem.hour} EAT` : '—'}
                </p>
                <span className="text-[10px] text-[#2f9e6e] font-medium">
                  {peakHourItem ? `ETB ${peakHourItem.volumeEtb.toLocaleString()}` : ''}
                </span>
              </div>
              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/40 p-2 text-xs">
                <span className="text-[10px] text-[var(--slate-gray)] font-medium">
                  Day vs Night Share
                </span>
                <p className="mt-0.5 font-semibold text-[var(--ink-charcoal)]">
                  {dayPercent}% Day · {nightPercent}% Night
                </p>
                <span className="text-[10px] text-[var(--slate-gray)]">
                  6:00 to 18:00 EAT active
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-[200px] w-full flex-col items-center justify-center rounded-[var(--radius-cards)] border border-dashed border-[var(--border-hairline)] p-6 text-center">
            <p className="text-[13px] font-medium text-[var(--slate-gray)]">
              No hourly activity recorded
            </p>
            <p className="mt-1 text-[11px] text-[var(--steel-gray)]">
              Spending curve by time of day (EAT) will display as transactions are logged.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--slate-gray)]">
        <span>24-Hour Cycle</span>
        <span className="font-medium">Temporal Curve</span>
      </div>
    </section>
  );
}
