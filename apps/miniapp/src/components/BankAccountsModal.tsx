import { CheckCircle2, Clock, Wallet, X } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';

export function BankAccountsModal({
  isOpen,
  onClose,
  locale,
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const accounts = [
    {
      id: 'telebirr',
      name: 'Telebirr Wallet',
      number: '•••• 4510',
      type: 'telebirr',
      status: 'Connected',
      pending: 1,
    },
    {
      id: 'abyssinia',
      name: 'Bank of Abyssinia',
      number: '•••• 8920',
      type: 'abyssinia',
      status: 'Connected',
      pending: 2,
    },
    {
      id: 'cbe',
      name: 'Commercial Bank of Ethiopia',
      number: '•••• 1102',
      type: 'cbe',
      status: 'Connected',
      pending: 0,
    },
  ];

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="p-5 max-w-md mx-auto">
        <DrawerHeader className="p-0 pb-4 flex flex-row items-center justify-between">
          <DrawerTitle className="text-base font-black text-[var(--foreground)] flex items-center gap-2">
            <Wallet size={18} className="text-amber-500" />
            <span>{locale === 'en' ? 'Connected Bank Accounts' : 'የተገናኙ የባንክ ሒሳቦች'}</span>
          </DrawerTitle>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          >
            <X size={18} />
          </button>
        </DrawerHeader>

        <div className="flex flex-col gap-3 py-1">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--secondary)]/60 border border-[var(--border)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-2xs">
                  {acc.type === 'telebirr' ? (
                    <span className="text-cyan-500 font-bold text-base">✦</span>
                  ) : acc.type === 'abyssinia' ? (
                    <span className="text-amber-500 font-bold text-base">★</span>
                  ) : (
                    <span className="text-purple-500 font-bold text-base">🏛</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[var(--foreground)]">{acc.name}</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">{acc.number}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                  <CheckCircle2 size={12} />
                  <span>{acc.status}</span>
                </span>
                {acc.pending > 0 ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold">
                    <Clock size={10} />
                    <span>{acc.pending} pending</span>
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
