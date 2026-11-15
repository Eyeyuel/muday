import type { AdminAnalyticsReport } from '../../api/admin-types';

export function QuickStatGrid({ report }: { report?: AdminAnalyticsReport }) {
  const pendingClarifications = report?.dataQuality?.pendingClarifications ?? 0;
  const uncategorizedTx = report?.dataQuality?.uncategorizedTransactions ?? 0;
  const highValueOutliers = report?.dataQuality?.highValueOutliers ?? 0;
  const companionSessions = report?.dataQuality?.activeCompanionSessions ?? 0;
  const geminiInvalid = report?.extractionQuality?.geminiInvalidOutputs ?? 0;

  const totalLatency = report?.voicePerformance?.avgTotalLatencyMs;
  const voiceLatencyStr =
    totalLatency != null && totalLatency > 0 ? `${Math.round(totalLatency)} ms` : '—';

  const stats = [
    {
      label: 'Pending Clarifications',
      value: pendingClarifications.toLocaleString(),
      subtitle: 'Awaiting user reply',
      color: pendingClarifications > 0 ? 'text-amber-600' : 'text-[var(--ink-charcoal)]',
    },
    {
      label: 'Uncategorized Tx',
      value: uncategorizedTx.toLocaleString(),
      subtitle: 'Needs categorization',
      color: uncategorizedTx > 0 ? 'text-amber-600' : 'text-[var(--ink-charcoal)]',
    },
    {
      label: 'High-Value Outliers',
      value: highValueOutliers.toLocaleString(),
      subtitle: 'Transactions ≥ 2,000 ETB',
      color: 'text-[var(--ink-charcoal)]',
    },
    {
      label: 'Voice Pipeline Latency',
      value: voiceLatencyStr,
      subtitle: 'STT + NLP avg latency',
      color: 'text-[var(--ink-charcoal)]',
    },
    {
      label: 'Companion Sessions',
      value: companionSessions.toLocaleString(),
      subtitle: 'Paired mobile devices',
      color: 'text-[var(--electric-cobalt)]',
    },
    {
      label: 'Gemini Parsing Errors',
      value: geminiInvalid.toLocaleString(),
      subtitle: 'AI schema fallbacks',
      color: geminiInvalid > 0 ? 'text-red-600' : 'text-[var(--ink-charcoal)]',
    },
  ];

  return (
    <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className="rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none transition-colors hover:bg-[var(--surface-ivory)] flex flex-col justify-between"
        >
          <div>
            <p className="text-[12px] font-medium text-[var(--slate-gray)] truncate">
              {stat.label}
            </p>
            <p
              className={`mt-2 text-[20px] font-semibold tracking-tight tabular-nums ${stat.color}`}
            >
              {stat.value}
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-[var(--steel-gray)]">{stat.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
