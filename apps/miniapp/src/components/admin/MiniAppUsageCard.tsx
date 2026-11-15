import { CalendarDays, Filter, MousePointerClick } from 'lucide-react';
import type { AdminAnalyticsReport } from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';

export function MiniAppUsageCard({ report }: { report: AdminAnalyticsReport; locale?: Locale }) {
  const { dashboard } = report;

  const metrics = [
    {
      label: 'Total Opens',
      value: dashboard.opens.toLocaleString(),
      sub: 'Dashboard launches',
      icon: MousePointerClick,
    },
    {
      label: 'Weekly Filter',
      value: dashboard.weekOpens.toLocaleString(),
      sub: '7-day view queries',
      icon: CalendarDays,
    },
    {
      label: 'Monthly Filter',
      value: dashboard.monthOpens.toLocaleString(),
      sub: '30-day view queries',
      icon: CalendarDays,
    },
    {
      label: 'Custom Range',
      value: dashboard.customOpens.toLocaleString(),
      sub: 'Custom timeframe',
      icon: Filter,
    },
  ];

  return (
    <section className="flex flex-col overflow-hidden rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-[var(--ink-charcoal)]">
          MiniApp & Telegram Engagement
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
          WebApp launches and timeframe filter telemetry
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={idx}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-3.5 space-y-1"
            >
              <div className="flex items-center gap-1.5 text-xs text-[var(--slate-gray)]">
                <Icon className="size-3.5 text-[var(--electric-cobalt)]" />
                <span>{m.label}</span>
              </div>
              <div className="text-[18px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
                {m.value}
              </div>
              <p className="text-[10px] text-[var(--steel-gray)]">{m.sub}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
