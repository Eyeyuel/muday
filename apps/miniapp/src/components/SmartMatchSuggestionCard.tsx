import React, { useState, useEffect } from 'react';
import { Link2, Clock, PlusCircle, Check, Building2, ReceiptText } from 'lucide-react';
import type { MatchCandidateItem } from '../api/dashboard-types';
import { triggerHaptic } from '@/telegram/telegram-webapp';

interface SmartMatchSuggestionCardProps {
  candidates: MatchCandidateItem[];
  selectedCandidateId?: string;
  onSelectCandidate?: (candidate: MatchCandidateItem) => void;
  onLinkAndSave: (candidate: MatchCandidateItem) => void;
  onSaveSeparate: () => void;
  isLinking?: boolean;
}

function getBankInfo(bankSource: string) {
  const upper = (bankSource || '').toUpperCase();
  if (upper.includes('TELEBIRR')) {
    return {
      name: 'Telebirr',
      fullName: 'Telebirr SuperApp',
      badgeClass:
        'bg-[#005cb9]/15 text-[#005cb9] border-[#005cb9]/30 dark:bg-[#005cb9]/30 dark:text-blue-300',
    };
  }
  if (upper.includes('CBE') || upper.includes('COMMERCIAL')) {
    return {
      name: 'CBE',
      fullName: 'Commercial Bank of Ethiopia',
      logo: '/bank_logos/Commercial Bank of Ethiopia Logo.svg',
    };
  }
  if (upper.includes('AWASH')) {
    return {
      name: 'Awash',
      fullName: 'Awash Bank',
      logo: '/bank_logos/Awash International Bank ( No text ) Logo.svg',
    };
  }
  if (upper.includes('DASHEN')) {
    return {
      name: 'Dashen',
      fullName: 'Dashen Bank (Amole)',
      logo: '/bank_logos/Dashen Bank Logo.svg',
    };
  }
  if (upper.includes('COOP') || upper.includes('OROMIA')) {
    return {
      name: 'Coop',
      fullName: 'Cooperative Bank of Oromia',
      logo: '/bank_logos/Cooperative Bank of Oromia Logo.svg',
    };
  }
  return {
    name: bankSource || 'Bank SMS',
    fullName: `${bankSource || 'Bank'} SMS Payment`,
    logo: null,
  };
}

function formatCandidateTime(isoString: string) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffDays === 0) return `Today, ${timeStr}`;
    if (diffDays === 1) return `Yesterday, ${timeStr}`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` (${timeStr})`;
  } catch {
    return 'Recent';
  }
}

export const SmartMatchSuggestionCard: React.FC<SmartMatchSuggestionCardProps> = ({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onLinkAndSave,
  onSaveSeparate,
  isLinking = false,
}) => {
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
    <div className="mb-3.5 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm animate-fade-in flex flex-col gap-3">
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border)]/70">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Link2 size={14} />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-[var(--foreground)] tracking-tight">
                Matching Bank Payment Found
              </span>
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)]">
              {candidates.length > 1
                ? `${candidates.length} matching unorganized bank transactions`
                : 'Link to avoid duplicate expense records'}
            </p>
          </div>
        </div>
      </div>

      {/* Selectable Candidates List */}
      <div className="flex flex-col gap-2">
        {candidates.map((cand, idx) => {
          const isSelected = cand.id === activeCandidate.id;
          const bank = getBankInfo(cand.bankSource);
          const timeDisplay = formatCandidateTime(cand.occurredAt);

          return (
            <div
              key={cand.id}
              onClick={() => handleSelect(cand)}
              className={`relative flex flex-col gap-2 p-3 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500/5 border-emerald-500 dark:border-emerald-400/80 shadow-2xs ring-1 ring-emerald-500/20'
                  : 'bg-[var(--secondary)]/40 border-[var(--border)] hover:bg-[var(--secondary)]/70 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--card)] border border-[var(--border)] p-1 shadow-2xs">
                    {bank.logo ? (
                      <img
                        src={bank.logo}
                        alt={bank.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Building2 size={16} className="text-emerald-500" />
                    )}
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[var(--foreground)]">
                        {bank.fullName}
                      </span>
                      {idx === 0 && candidates.length > 1 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                      <Clock size={10} className="shrink-0" />
                      <span>{timeDisplay}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="font-mono text-xs font-black text-[var(--foreground)] tabular-nums">
                      ETB {cand.amountEtb}
                    </div>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-rose-500">
                      {cand.type}
                    </span>
                  </div>

                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                      isSelected
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-[var(--border)] bg-[var(--card)]'
                    }`}
                  >
                    {isSelected && <Check size={10} strokeWidth={3} />}
                  </div>
                </div>
              </div>

              {cand.note && (
                <div className="rounded-lg bg-[var(--card)]/80 border border-[var(--border)]/70 px-2 py-1 text-[10px] text-[var(--muted-foreground)] flex items-start gap-1">
                  <ReceiptText
                    size={11}
                    className="shrink-0 mt-0.5 text-[var(--muted-foreground)]/70"
                  />
                  <span className="line-clamp-1">
                    <strong className="text-[var(--foreground)]/80 font-semibold">
                      Bank Note:{' '}
                    </strong>
                    {cand.note}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-1.5 pt-1">
        <button
          type="button"
          disabled={isLinking}
          onClick={() => onLinkAndSave(activeCandidate)}
          className="w-full h-11 rounded-2xl bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {isLinking ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Link2 size={14} />
          )}
          <span>Link & Update Bank Payment ({getBankInfo(activeCandidate.bankSource).name})</span>
        </button>

        <button
          type="button"
          disabled={isLinking}
          onClick={onSaveSeparate}
          className="w-full h-9 rounded-xl bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 border border-[var(--border)] text-[var(--foreground)] font-semibold text-[11px] transition-all active:scale-98 flex items-center justify-center gap-1 cursor-pointer"
        >
          <PlusCircle size={12} className="text-[var(--muted-foreground)]" />
          <span>Save as Separate Transaction</span>
        </button>
      </div>
    </div>
  );
};
