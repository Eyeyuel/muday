import { AlertTriangle, Clock, Cpu, MicOff } from 'lucide-react';
import type { AdminAnalyticsReport } from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';

export function VoiceHealthCard({ report }: { report: AdminAnalyticsReport; locale?: Locale }) {
  const { voicePerformance } = report;

  return (
    <section className="flex flex-col overflow-hidden rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink-charcoal)]">
            Voice & AI Latency Health
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
            Speech-to-Text (STT) transcription speed and Gemini extraction latencies
          </p>
        </div>
        <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--electric-cobalt)]">
          BullMQ Pipeline
        </span>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--slate-gray)]">
              <Clock className="size-3.5 text-[var(--electric-cobalt)]" />
              <span>Avg STT Latency</span>
            </div>
            <div className="text-[20px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
              {voicePerformance.avgSttLatencyMs}{' '}
              <span className="text-xs font-normal text-[var(--slate-gray)]">ms</span>
            </div>
            <p className="text-[10px] text-[var(--steel-gray)]">Audio transcription</p>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--slate-gray)]">
              <Cpu className="size-3.5 text-[var(--electric-cobalt)]" />
              <span>Avg Total Pipeline</span>
            </div>
            <div className="text-[20px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
              {voicePerformance.avgTotalLatencyMs}{' '}
              <span className="text-xs font-normal text-[var(--slate-gray)]">ms</span>
            </div>
            <p className="text-[10px] text-[var(--steel-gray)]">End-to-end Gemini execution</p>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--slate-gray)]">
              <MicOff className="size-3.5 text-[var(--electric-cobalt)]" />
              <span>Processing Failures</span>
            </div>
            <div
              className={`text-[20px] font-semibold tracking-tight tabular-nums ${
                voicePerformance.failureCount > 0
                  ? 'text-[#d94a40]'
                  : 'text-[var(--electric-cobalt)]'
              }`}
            >
              {voicePerformance.failureCount}
            </div>
            <p className="text-[10px] text-[var(--steel-gray)]">Failed conversion jobs</p>
          </div>
        </div>

        {voicePerformance.topFailureCodes.length > 0 ? (
          <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--slate-gray)]">
              Failure Reason Codes
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {voicePerformance.topFailureCodes.map((f) => (
                <span
                  key={f.code}
                  className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600"
                >
                  <AlertTriangle className="size-3" />
                  <span>{f.code}:</span>
                  <strong className="tabular-nums">{f.count}</strong>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
