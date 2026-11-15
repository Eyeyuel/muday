import { Camera, CheckCircle2, Clock, Receipt, UploadCloud } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle } from './ui/card';
import { triggerHaptic } from '@/telegram/telegram-webapp';

export function ReceiptsView({
  locale,
  onScanReceipt,
}: {
  locale: Locale;
  onScanReceipt?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 w-full pb-24 select-none animate-fade-in">
      <h2 className="text-xl font-black text-[var(--foreground)] tracking-tight">
        {locale === 'en' ? 'Receipts & SMS Ingestion' : 'ደረሰኞችና ኤስኤምኤስ'}
      </h2>

      {/* Hero Action Card */}
      <Card className="p-5 flex flex-col items-center text-center gap-3 border-dashed border-2 border-[var(--primary)]/40 bg-[var(--card)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--primary)]/10 text-[var(--primary)] shadow-sm">
          <Camera size={26} />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-[var(--foreground)]">
            {locale === 'en' ? 'Scan Receipt Photo' : 'የደረሰኝ ፎቶ አንሳ'}
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
            {locale === 'en'
              ? 'Muday AI will automatically extract merchant, amount, category, and items.'
              : 'ሙዳይ AI የነጋዴውን ስም፣ መጠንና ምድብ ወዲያውኑ ይለያል።'}
          </p>
        </div>
        <Button
          onClick={() => {
            triggerHaptic('heavy');
            onScanReceipt?.();
          }}
          className="mt-1 h-10 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md"
        >
          <UploadCloud size={16} className="mr-1.5" />
          {locale === 'en' ? 'Upload Receipt' : 'ደረሰኝ ላክ'}
        </Button>
      </Card>

      {/* Recent Scanned Receipts */}
      <Card className="p-4 flex flex-col gap-3">
        <CardHeader className="p-0 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
            <Receipt size={14} className="text-emerald-500" />
            <span>{locale === 'en' ? 'Recent Scanned Receipts' : 'የቅርብ ጊዜ ደረሰኞች'}</span>
          </CardTitle>
        </CardHeader>

        <div className="flex flex-col gap-2">
          {[
            {
              merchant: 'TotalEnergies Station',
              amount: '1,200.00 ETB',
              date: '28 Aug, 07:58',
              status: 'Approved',
            },
            {
              merchant: 'Fresh Corner Supermarket',
              amount: '850.00 ETB',
              date: '27 Aug, 18:20',
              status: 'Approved',
            },
            {
              merchant: "Kaldi's Coffee",
              amount: '120.50 ETB',
              date: '27 Aug, 10:15',
              status: 'Pending Review',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)]"
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[var(--foreground)]">{item.merchant}</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">{item.date}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-black text-rose-500 tabular-nums">{item.amount}</span>
                <span
                  className={`text-[10px] font-bold flex items-center gap-1 mt-0.5 ${
                    item.status === 'Approved' ? 'text-emerald-500' : 'text-amber-500'
                  }`}
                >
                  {item.status === 'Approved' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                  <span>{item.status}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
