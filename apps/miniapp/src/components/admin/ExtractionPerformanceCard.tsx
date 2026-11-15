import { ShieldAlert } from 'lucide-react';
import type { AdminAnalyticsReport } from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';

export function ExtractionPerformanceCard({
  report,
}: {
  report: AdminAnalyticsReport;
  locale?: Locale;
}) {
  const { clarifications, extractionQuality, transactions } = report;

  return (
    <section className="flex flex-col overflow-hidden rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink-charcoal)]">
            AI Extraction & Clarification Quality
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
            Telemetry from Gemini 2.5 Flash entity parsing, safety guardrails & user confirmations
          </p>
        </div>
        <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--electric-cobalt)]">
          Gemini 2.5 Flash
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Clarification Request Rate */}
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--slate-gray)]">Clarification Rate</span>
            <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--electric-cobalt)]">
              {clarifications.requestRate.percentage}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--pure-white)] border border-[var(--border-hairline)]">
            <div
              className="h-full rounded-full bg-[var(--electric-cobalt)]"
              style={{ width: `${Math.min(100, Number(clarifications.requestRate.percentage))}%` }}
            />
          </div>
          <p className="text-[11px] text-[var(--slate-gray)]">
            <strong className="font-semibold text-[var(--ink-charcoal)]">
              {clarifications.requested}
            </strong>{' '}
            of {clarifications.measurableAttempts} logs queried
          </p>
        </div>

        {/* Other Category Rate */}
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--slate-gray)]">Unclassified Rate</span>
            <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--electric-cobalt)]">
              {transactions.otherRate.percentage}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--pure-white)] border border-[var(--border-hairline)]">
            <div
              className="h-full rounded-full bg-[var(--electric-cobalt)]"
              style={{ width: `${Math.min(100, Number(transactions.otherRate.percentage))}%` }}
            />
          </div>
          <p className="text-[11px] text-[var(--slate-gray)]">
            <strong className="font-semibold text-[var(--ink-charcoal)]">
              {transactions.otherTransactions}
            </strong>{' '}
            transactions classified as other
          </p>
        </div>

        {/* Resolution Rate */}
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--slate-gray)]">Resolution Rate</span>
            <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--electric-cobalt)]">
              {clarifications.resolutionRate.percentage}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--pure-white)] border border-[var(--border-hairline)]">
            <div
              className="h-full rounded-full bg-[var(--electric-cobalt)]"
              style={{
                width: `${Math.min(100, Number(clarifications.resolutionRate.percentage))}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-[var(--slate-gray)]">
            <strong className="font-semibold text-[var(--ink-charcoal)]">
              {clarifications.resolved}
            </strong>{' '}
            resolved ({clarifications.failed} expired)
          </p>
        </div>

        {/* Safety Outcomes */}
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--slate-gray)]">
            <ShieldAlert className="size-3.5 text-[var(--electric-cobalt)]" />
            <span>Safety Rejections</span>
          </div>
          <div className="text-[18px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
            {extractionQuality.rejectedTransfers}{' '}
            <span className="text-xs font-normal text-[var(--slate-gray)]">transfers</span>
          </div>
          <p className="text-[11px] text-[var(--slate-gray)] leading-tight">
            {extractionQuality.cancelledConfirmations} cancelled ·{' '}
            {extractionQuality.geminiInvalidOutputs} invalid AI outputs
          </p>
        </div>
      </div>
    </section>
  );
}
