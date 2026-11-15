import { Bot } from 'lucide-react';
import type { AdminAnalyticsReport } from '../../api/admin-types';

export function AdminAiInsightBanner({ report }: { report?: AdminAnalyticsReport }) {
  const dau = report?.activeUsers?.dau ?? 0;
  const logged = report?.transactions?.loggedTransactions ?? 0;
  const voiceCount = report?.transactions?.voiceTransactions ?? 0;
  const resolutionRate = report?.clarifications?.resolutionRate?.percentage ?? 0;
  const geminiInvalid = report?.extractionQuality?.geminiInvalidOutputs ?? 0;
  const cancelledConf = report?.extractionQuality?.cancelledConfirmations ?? 0;

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-cards)] shadow-sm text-white min-h-[220px] md:min-h-[240px] flex flex-col justify-between p-6 md:p-8 bg-[#09090b]">
      {/* Background Image: bgpic.png */}
      <div
        className="absolute inset-0 bg-cover bg-right md:bg-[center_right] bg-no-repeat opacity-95"
        style={{ backgroundImage: "url('/bgpic.png')" }}
        aria-hidden="true"
      />

      {/* Smooth Dark Gradient Mask: Ensures high contrast on text while letting abstract art glow */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#09090b]/95 via-[#09090b]/75 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Foreground Content */}
      <div className="relative z-10 max-w-3xl flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-emerald-400 uppercase">
            <Bot className="size-3.5 text-emerald-400" />
            <span>INSIGHT · QTD 2026</span>
          </div>

          <h2 className="mt-2.5 text-[20px] md:text-[24px] lg:text-[25px] font-bold leading-snug tracking-tight text-white">
            Platform activity is tracking {logged.toLocaleString()} total logged events and{' '}
            {dau.toLocaleString()} daily active users.
          </h2>

          <p className="mt-2.5 text-[13px] md:text-[14px] leading-relaxed text-zinc-200/90">
            Multi-channel intake is live across 6 Ethiopian banking rails with {resolutionRate}%
            clarification resolution. Voice notes account for {voiceCount} automated entries, with{' '}
            {geminiInvalid} schema fallbacks and {cancelledConf} cancelled confirmations recorded in
            audit telemetry.
          </p>
        </div>

        <div className="mt-5 flex items-center gap-3 text-[11px] tracking-[0.02em] text-zinc-400 flex-wrap">
          <span>AI-generated from ledger</span>
          <span>•</span>
          <span>Muday Consumer Finance</span>
          <span>•</span>
          <span>Refreshed live</span>
        </div>
      </div>
    </section>
  );
}
