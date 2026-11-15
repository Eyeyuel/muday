import { Check, FileText, Phone, Zap } from 'lucide-react';
import type { AdminAnalyticsReport } from '../../api/admin-types';

const DEFAULT_TIMELINE_EVENTS = [
  {
    id: 'ev_1',
    time: '14:22',
    icon: Zap,
    title: 'Telebirr Webhook Settlement Completed',
    desc: 'Automated matching verified for ETB 18,500.00 from Abebe Kebede.',
    badge: 'Automated Match',
    badgeClass: 'bg-[#5ecf9a]/15 text-[#2f9e6e]',
    amount: '+ETB 18,500.00',
  },
  {
    id: 'ev_2',
    time: '14:05',
    icon: Phone,
    title: 'Voice Expense Note Synthesized',
    desc: 'Gemini 2.5 Flash parsed Amharic audio clip into 3 itemized categories.',
    badge: 'Voice NLP',
    badgeClass: 'bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)]',
    amount: '-ETB 2,450.00',
  },
  {
    id: 'ev_3',
    time: '13:48',
    icon: FileText,
    title: 'CBE Statement Batch Uploaded',
    desc: '48 new transactions ingested; 46 automatically reconciled to customer accounts.',
    badge: 'Bank Sync',
    badgeClass: 'bg-[#3d8bfd]/15 text-[#3d8bfd]',
    amount: '+ETB 142,000.00',
  },
  {
    id: 'ev_4',
    time: '13:12',
    icon: Check,
    title: 'Bulk SMS Extraction Run Finished',
    desc: 'Multi-device pairing sync updated 12 active mobile sessions.',
    badge: 'Device Sync',
    badgeClass:
      'bg-[var(--surface-ivory)] text-[var(--slate-gray)] border border-[var(--border-hairline)]',
    amount: '12 Devices',
  },
];

export function ActivityTimelineCard({ report }: { report?: AdminAnalyticsReport }) {
  const events = report?.activityTimeline?.length
    ? report.activityTimeline.map((ev) => ({
        id: ev.id,
        time: ev.time,
        icon: ev.eventType.includes('voice')
          ? Phone
          : ev.eventType.includes('transaction')
            ? Zap
            : FileText,
        title: ev.title,
        desc: ev.desc,
        badge: ev.badge,
        badgeClass: ev.eventType.includes('transaction')
          ? 'bg-[#5ecf9a]/15 text-[#2f9e6e]'
          : 'bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)]',
        amount: ev.amountEtb || 'Live',
      }))
    : DEFAULT_TIMELINE_EVENTS;

  return (
    <section className="flex flex-col rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
          Activity Timeline (Live Audit Log)
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
          Chronological audit trail of financial events, voice parsing, and ledger synchronizations
        </p>
      </div>

      <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--border-hairline)]">
        {events.map((item) => (
          <div key={item.id} className="relative flex items-start justify-between gap-4 text-xs">
            {/* Dot Icon on timeline */}
            <div className="absolute -left-6 top-0 flex size-4 items-center justify-center rounded-full bg-[var(--pure-white)] border-2 border-[var(--electric-cobalt)]" />

            <div className="flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--ink-charcoal)] text-[13px]">
                  {item.title}
                </span>
                <span
                  className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${item.badgeClass}`}
                >
                  {item.badge}
                </span>
              </div>
              <p className="text-[12px] text-[var(--slate-gray)] leading-relaxed">{item.desc}</p>
            </div>

            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="font-semibold text-[var(--ink-charcoal)] tabular-nums">
                {item.amount}
              </span>
              <span className="text-[10px] text-[var(--steel-gray)]">{item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
