import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { AdminAnalyticsReport } from '../../api/admin-types';

const MODALITY_COLORS = ['#10b981', '#059669', '#34d399', '#6ee7b7', '#a7f3d0'];

export function ModalityBreakdownBarCard({ report }: { report?: AdminAnalyticsReport }) {
  const chartData = (report?.modalityBreakdown ?? []).map((m, idx) => {
    let cleanType = m.name
      .replace(/ \(STT\)/g, '')
      .replace(/ Telegram/g, '')
      .replace(/Memo/g, '')
      .replace(/Camera OCR/g, 'Photos')
      .trim();
    if (cleanType === 'Voice') cleanType = 'Voice Notes';
    if (cleanType === 'Receipt' || cleanType === 'Receipt Photo') cleanType = 'Receipt Photos';
    if (cleanType === 'Voice Notes (Amharic)') cleanType = 'Voice (Amharic)';
    if (cleanType === 'Voice Notes (English)') cleanType = 'Voice (English)';

    return {
      type: cleanType,
      count: m.count,
      volumeEtb: m.volumeEtb,
      fill: MODALITY_COLORS[idx % MODALITY_COLORS.length] ?? '#10b981',
    };
  });

  const totalCount = chartData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <section className="flex flex-col rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
          How Users Log Expenses
        </h2>
        <span className="text-[11px] font-medium text-[var(--slate-gray)]">
          {totalCount.toLocaleString()} total messages
        </span>
      </div>
      <p className="text-[12px] text-[var(--slate-gray)] mb-4">
        Breakdown of how users log transactions: via text messages, voice notes, or receipt photos
      </p>

      {chartData.length > 0 ? (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border-hairline)"
              />
              <XAxis
                dataKey="type"
                interval={0}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--slate-gray)', fontSize: 10 }}
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
                    const data = first.payload as {
                      type: string;
                      count: number;
                      volumeEtb: string | number;
                    };
                    return (
                      <div className="rounded-[8px] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-2.5 shadow-sm text-xs">
                        <p className="font-semibold text-[var(--ink-charcoal)]">{data.type}</p>
                        <p className="mt-1 text-[var(--slate-gray)]">
                          Count:{' '}
                          <span className="font-semibold text-[var(--ink-charcoal)]">
                            {data.count.toLocaleString()} messages
                          </span>
                        </p>
                        {data.volumeEtb && Number(data.volumeEtb) > 0 ? (
                          <p className="text-[var(--slate-gray)]">
                            Volume:{' '}
                            <span className="font-semibold text-[var(--ink-charcoal)]">
                              ETB {Number(data.volumeEtb).toLocaleString()}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[180px] w-full flex-col items-center justify-center rounded-[var(--radius-cards)] border border-dashed border-[var(--border-hairline)] p-6 text-center">
          <p className="text-[13px] font-medium text-[var(--slate-gray)]">
            No modality data recorded
          </p>
          <p className="mt-1 text-[11px] text-[var(--steel-gray)]">
            Ingestion breakdown will populate as voice, text, or receipts are processed.
          </p>
        </div>
      )}
    </section>
  );
}
