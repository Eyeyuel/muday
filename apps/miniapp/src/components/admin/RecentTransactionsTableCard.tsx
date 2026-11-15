import type { AdminAnalyticsReport } from '../../api/admin-types';
import { FinancialKindBadge } from './FinancialKindBadge';

const TRANSACTIONS = [
  {
    id: 'tx_1',
    user: 'Abebe Kebede',
    handle: '@abebe_k',
    avatar: 'AK',
    time: '14:22:10',
    category: 'Consultation',
    channel: 'Telebirr',
    amount: 'ETB 18,500.00',
    kind: 'EXPENSE',
    status: 'Paid',
    statusColor: 'bg-[#5ecf9a]/15 text-[#2f9e6e]',
  },
  {
    id: 'tx_2',
    user: 'Hiwot Tadesse',
    handle: '@hiwot_t',
    avatar: 'HT',
    time: '14:05:40',
    category: 'Emergency / Care',
    channel: 'CBE Birr',
    amount: 'ETB 24,120.00',
    kind: 'EXPENSE',
    status: 'Paid',
    statusColor: 'bg-[#5ecf9a]/15 text-[#2f9e6e]',
  },
  {
    id: 'tx_3',
    user: 'Yohannes Getachew',
    handle: '@yohannes_g',
    avatar: 'YG',
    time: '13:48:15',
    category: 'Salary Deposit',
    channel: 'Telebirr',
    amount: 'ETB 45,000.00',
    kind: 'INCOME',
    status: 'Received',
    statusColor: 'bg-emerald-500/15 text-emerald-700',
  },
  {
    id: 'tx_4',
    user: 'Sara Daniel',
    handle: '@sara_d',
    avatar: 'SD',
    time: '13:12:00',
    category: 'Lab Diagnostics',
    channel: 'Bank of Abyssinia',
    amount: 'ETB 6,800.00',
    kind: 'EXPENSE',
    status: 'Paid',
    statusColor: 'bg-[#5ecf9a]/15 text-[#2f9e6e]',
  },
  {
    id: 'tx_5',
    user: 'Biruk Hailu',
    handle: '@biruk_h',
    avatar: 'BH',
    time: '12:55:20',
    category: 'Refund from Merchant',
    channel: 'Telebirr',
    amount: 'ETB 12,000.00',
    kind: 'REFUND',
    status: 'Matched',
    statusColor: 'bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)]',
  },
];

export function RecentTransactionsTableCard({ report }: { report?: AdminAnalyticsReport }) {
  const transactions = report?.recentLedger?.length
    ? report.recentLedger.map((tx) => ({
        id: tx.id,
        user: tx.userName,
        handle: tx.userHandle,
        avatar: tx.avatar,
        time: tx.occurredAt,
        category: tx.category,
        channel: tx.bankSource,
        amount: tx.amountEtb,
        kind: tx.kind || 'EXPENSE',
        status: tx.status,
        statusColor: 'bg-[#5ecf9a]/15 text-[#2f9e6e]',
      }))
    : TRANSACTIONS;

  return (
    <section className="flex flex-col rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
          Recent Verified Ledger (Live Stream)
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
          Real-time incoming transactions streamed from PostgreSQL database
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--slate-gray)] uppercase tracking-wider">
              <th className="py-2.5 font-medium">User / Wallet</th>
              <th className="py-2.5 font-medium">Time (EAT)</th>
              <th className="py-2.5 font-medium">Event Kind</th>
              <th className="py-2.5 font-medium">Category / Bank</th>
              <th className="py-2.5 font-medium text-right">Amount</th>
              <th className="py-2.5 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-[var(--surface-ivory)]/50 transition-colors">
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-full bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)] font-semibold text-[11px]">
                      {tx.avatar}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-[var(--ink-charcoal)]">{tx.user}</span>
                      <span className="text-[10px] text-[var(--slate-gray)]">{tx.handle}</span>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-[var(--slate-gray)] tabular-nums">{tx.time}</td>
                <td className="py-3 whitespace-nowrap">
                  <FinancialKindBadge kind={tx.kind} size="xs" />
                </td>
                <td className="py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--ink-charcoal)]">{tx.category}</span>
                    <span className="text-[10px] text-[var(--slate-gray)]">{tx.channel}</span>
                  </div>
                </td>
                <td className="py-3 text-right font-semibold text-[var(--ink-charcoal)] tabular-nums">
                  {tx.amount}
                </td>
                <td className="py-3 text-right">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${tx.statusColor}`}
                  >
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
