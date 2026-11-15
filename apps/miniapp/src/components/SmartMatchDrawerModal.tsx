import React, { useState, useEffect } from 'react';
import { Link2, Clock, PlusCircle, Check, X, Building2, ReceiptText } from 'lucide-react';
import type { Locale, MatchCandidateItem } from '../api/dashboard-types';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';
import { triggerHaptic } from '@/telegram/telegram-webapp';

interface SmartMatchDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: MatchCandidateItem[];
  selectedCandidateId?: string;
  onSelectCandidate?: (candidate: MatchCandidateItem) => void;
  onLinkAndSave: (candidate: MatchCandidateItem) => void;
  onSaveSeparate: () => void;
  isLinking?: boolean;
  locale: Locale;
  userCategory?: string;
  userNote?: string;
}

function getBankInfo(bankSource: string) {
  const upper = (bankSource || '').toUpperCase();
  if (upper.includes('TELEBIRR')) {
    return {
      name: 'Telebirr',
      fullName: 'Telebirr SuperApp',
      logo: '/bank_logos/TeleBirr Logo.svg',
      color: 'text-cyan-500',
      badgeBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    };
  }
  if (upper.includes('CBE') || upper.includes('COMMERCIAL')) {
    return {
      name: 'CBE',
      fullName: 'Commercial Bank of Ethiopia',
      logo: '/bank_logos/Commercial Bank of Ethiopia Logo.svg',
      color: 'text-purple-500',
      badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    };
  }
  if (upper.includes('ABYSSINIA') || upper.includes('BOA')) {
    return {
      name: 'Abyssinia',
      fullName: 'Bank of Abyssinia',
      logo: '/bank_logos/Bank of Abyssinia Logo.svg',
      color: 'text-amber-500',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    };
  }
  if (upper.includes('AWASH')) {
    return {
      name: 'Awash',
      fullName: 'Awash Bank',
      logo: '/bank_logos/Awash International Bank ( No text ) Logo.svg',
      color: 'text-orange-500',
      badgeBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    };
  }
  if (upper.includes('DASHEN')) {
    return {
      name: 'Dashen',
      fullName: 'Dashen Bank (Amole)',
      logo: '/bank_logos/Dashen Bank Logo.svg',
      color: 'text-blue-500',
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    };
  }
  if (upper.includes('COOP') || upper.includes('OROMIA')) {
    return {
      name: 'Coop',
      fullName: 'Cooperative Bank of Oromia',
      logo: '/bank_logos/Cooperative Bank of Oromia Logo.svg',
      color: 'text-emerald-500',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    };
  }
  return {
    name: bankSource || 'Bank SMS',
    fullName: `${bankSource || 'Bank'} SMS Payment`,
    logo: null,
    color: 'text-emerald-500',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  };
}

function formatCandidateTime(isoString: string, locale: Locale) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffMins < 5) return locale === 'en' ? 'Just now' : 'አሁን';
    if (diffMins < 60) return locale === 'en' ? `${diffMins}m ago` : `ከ${diffMins} ደቂቃ በፊት`;
    if (diffDays === 0) return locale === 'en' ? `Today, ${timeStr}` : `ዛሬ፣ ${timeStr}`;
    if (diffDays === 1) return locale === 'en' ? `Yesterday, ${timeStr}` : `ትናንት፣ ${timeStr}`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` (${timeStr})`;
  } catch {
    return locale === 'en' ? 'Recent' : 'የቅርብ';
  }
}

export function SmartMatchDrawerModal({
  isOpen,
  onClose,
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onLinkAndSave,
  onSaveSeparate,
  isLinking = false,
  locale,
}: SmartMatchDrawerModalProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(
    selectedCandidateId || candidates[0]?.id,
  );

  useEffect(() => {
    if (selectedCandidateId) {
      setInternalSelectedId(selectedCandidateId);
    } else if (
      candidates.length > 0 &&
      (!internalSelectedId || !candidates.find((c) => c.id === internalSelectedId))
    ) {
      setInternalSelectedId(candidates[0]?.id);
    }
  }, [selectedCandidateId, candidates]);

  if (!candidates || candidates.length === 0) return null;

  const activeCandidate = candidates.find((c) => c.id === internalSelectedId) || candidates[0];
  if (!activeCandidate) return null;

  const handleSelect = (cand: MatchCandidateItem) => {
    triggerHaptic('selection');
    setInternalSelectedId(cand.id);
    onSelectCandidate?.(cand);
  };

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLinking) {
          onClose();
        }
      }}
    >
      <DrawerContent className="p-5 max-w-md mx-auto h-auto max-h-[85vh] flex flex-col rounded-t-[2.5rem] bg-[var(--card)] border-t border-[var(--border)] shadow-2xl overflow-hidden">
        {/* 1. Pinned Header */}
        <DrawerHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-[var(--border)]/60 shrink-0">
          <div className="flex flex-col text-left">
            <DrawerTitle className="text-base font-black text-[var(--foreground)] tracking-tight">
              {locale === 'en' ? 'Matching Bank Payment Found' : 'ተዛማጅ የባንክ ክፍያ ተገኝቷል'}
            </DrawerTitle>
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              {candidates.length > 1
                ? locale === 'en'
                  ? `Found ${candidates.length} matching unorganized payments`
                  : `${candidates.length} ያልተደራጁ ተመሳሳይ ክፍያዎች ተገኝተዋል`
                : locale === 'en'
                  ? 'Link your note to avoid duplicate records'
                  : 'ተደጋጋሚ ምዝገባን ለማስቀረት ከባንክ ክፍያው ጋር ያገናኙ'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLinking}
            className="p-1.5 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </DrawerHeader>

        {/* 2. Scrollable Body: Contained & bound to max height */}
        <div className="overflow-y-auto overscroll-contain no-scrollbar py-2.5 my-1 flex flex-col gap-2.5 max-h-[50vh]">
          {candidates.length > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                {locale === 'en' ? 'Select which payment to link:' : 'የሚገናኘውን ክፍያ ይምረጡ፡'}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {candidates.length} {locale === 'en' ? 'matches' : 'ተመሳሳይ'}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {candidates.map((cand, idx) => {
              const isSelected = cand.id === activeCandidate.id;
              const bank = getBankInfo(cand.bankSource);
              const timeDisplay = formatCandidateTime(cand.occurredAt, locale);

              return (
                <div
                  key={cand.id}
                  onClick={() => handleSelect(cand)}
                  className={`relative flex flex-col gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/5 border-emerald-500 dark:border-emerald-400/80 shadow-xs ring-1 ring-emerald-500/20'
                      : 'bg-[var(--secondary)]/40 border-[var(--border)] hover:bg-[var(--secondary)]/70 opacity-80'
                  }`}
                >
                  {/* Top Row: Bank Info & Amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--card)] border border-[var(--border)] p-1.5 shadow-2xs shrink-0">
                        {bank.logo ? (
                          <img
                            src={bank.logo}
                            alt={bank.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Building2 size={18} className="text-emerald-500" />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[var(--foreground)]">
                            {bank.fullName}
                          </span>
                          {idx === 0 && candidates.length > 1 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                              {locale === 'en' ? 'Latest' : 'የቅርብ'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                          <Clock size={11} className="shrink-0" />
                          <span>{timeDisplay}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <div className="font-mono text-sm font-black text-[var(--foreground)] tabular-nums">
                          ETB {cand.amountEtb}
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500">
                          {cand.type}
                        </span>
                      </div>

                      {/* Selection Radio Icon */}
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-[var(--border)] bg-[var(--card)]'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Original SMS Note */}
                  {cand.note && (
                    <div className="rounded-xl bg-[var(--card)]/80 border border-[var(--border)]/70 px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] flex items-start gap-1.5">
                      <ReceiptText
                        size={13}
                        className="shrink-0 mt-0.5 text-[var(--muted-foreground)]/70"
                      />
                      <span className="line-clamp-2">
                        <strong className="text-[var(--foreground)]/80 font-semibold">
                          SMS Note:{' '}
                        </strong>
                        {cand.note}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Pinned Action Buttons */}
        <div className="flex flex-col gap-2 pt-3 border-t border-[var(--border)]/60 shrink-0 bg-[var(--card)]">
          <button
            type="button"
            disabled={isLinking}
            onClick={() => onLinkAndSave(activeCandidate)}
            className="w-full h-12 rounded-2xl bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLinking ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Link2 size={16} />
            )}
            <span>
              {locale === 'en'
                ? `Link & Update Bank Payment (${getBankInfo(activeCandidate.bankSource).name})`
                : `ከ${getBankInfo(activeCandidate.bankSource).name} ክፍያ ጋር አገናኝ`}
            </span>
          </button>

          <button
            type="button"
            disabled={isLinking}
            onClick={onSaveSeparate}
            className="w-full h-11 rounded-2xl bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 border border-[var(--border)] text-[var(--foreground)] font-semibold text-xs transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PlusCircle size={14} className="text-[var(--muted-foreground)]" />
            <span>
              {locale === 'en'
                ? 'No, Save as Separate New Transaction'
                : 'አይ፣ እንደ አዲስ ራሱን የቻለ ወጪ መዝግብ'}
            </span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
