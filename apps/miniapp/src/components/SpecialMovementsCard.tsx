import { HandCoins, ReceiptText, RotateCcw, WalletCards } from 'lucide-react';
import type { DashboardResponse, Locale } from '../api/dashboard-types';
import { movementLabels, t } from '../i18n/catalogs';
import { formatETB } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from './ui/card';

const icons = {
  loan_received: HandCoins,
  loan_repayment: WalletCards,
  refund: RotateCcw,
  reimbursement: ReceiptText,
};

export function SpecialMovementsCard({
  movements,
  locale,
}: {
  movements: DashboardResponse['specialMovements'];
  locale: Locale;
}) {
  if (movements.length === 0) return null;

  return (
    <Card
      className="p-5 border border-amber-500/20 bg-amber-500/5"
      aria-labelledby="movements-heading"
    >
      <CardHeader className="p-0 pb-1.5 flex flex-row items-center justify-between">
        <CardTitle id="movements-heading" className="text-sm font-bold text-[var(--foreground)]">
          {t(locale, 'otherMovements')}
        </CardTitle>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
          {movements.length}
        </span>
      </CardHeader>

      <p className="text-xs text-[var(--muted-foreground)] mb-3">{t(locale, 'movementsHint')}</p>

      <ul className="flex flex-col gap-2 p-0 m-0 list-none">
        {movements.map((movement) => {
          const Icon = icons[movement.kind];
          const inflow = movement.kind !== 'loan_repayment';
          return (
            <li
              key={movement.kind}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--card)]/60 border border-[var(--border)]"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-500">
                  <Icon size={14} aria-hidden="true" />
                </div>
                <span>{movementLabels[locale][movement.kind]}</span>
              </div>
              <strong className="text-xs font-bold tabular-nums text-[var(--foreground)]">
                <span
                  className={inflow ? 'text-emerald-500 mr-0.5' : 'text-rose-500 mr-0.5'}
                  aria-hidden="true"
                >
                  {inflow ? '+' : '−'}
                </span>
                ETB {formatETB(movement.amountEtb, locale)}
              </strong>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
