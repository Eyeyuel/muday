import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../ui/dialog';
import {
  Mic,
  Receipt,
  MessageSquare,
  Calendar,
  Landmark,
  Tag,
  Cpu,
  ExternalLink,
  Copy,
  Check,
  Radio,
  Smartphone,
} from 'lucide-react';
import { UserAvatar } from '../../UserAvatar';
import type { AdminTransactionExplorerItem } from '../../../api/admin-types';
import type { Locale } from '../../../api/dashboard-types';
import { categoryLabels } from '../../../i18n/catalogs';
import { BankLogo } from '../BankLogo';
import { FinancialKindBadge } from '../FinancialKindBadge';

export function TransactionDetailDrawer({
  transaction,
  locale,
  onClose,
  onNavigateUser,
}: {
  transaction: AdminTransactionExplorerItem | null;
  locale: Locale;
  onClose: () => void;
  onNavigateUser?: (userId: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const categoryLabel = categoryLabels[locale][transaction.category] ?? transaction.category;

  const formatPlatform = (platform?: string | null) => {
    if (!platform) return 'Direct Cash / Unspecified';
    const p = platform.toLowerCase();
    if (p.includes('cbe')) return 'Commercial Bank of Ethiopia (CBE)';
    if (p.includes('telebirr')) return 'Telebirr';
    if (p.includes('dashen') || p.includes('amole')) return 'Dashen Bank';
    if (p.includes('awash')) return 'Awash Bank';
    if (p.includes('abyssinia') || p.includes('boa')) return 'Bank of Abyssinia';
    if (p.includes('cash')) return 'Direct Cash';
    return platform.toUpperCase();
  };

  const userFullName =
    [transaction.user.firstName, transaction.user.lastName].filter(Boolean).join(' ') ||
    'Telegram User';

  const handleCopyTranscript = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Detect method details
  const getMethodMeta = () => {
    const src = transaction.source?.toUpperCase();
    if (src === 'VOICE') {
      return {
        label: 'Voice Note Audio',
        desc: 'Logged via Telegram Voice Message (Transcribed with Speech-to-Text)',
        icon: Mic,
        color: 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30',
        badgeColor: 'bg-[#10b981]/15 text-[#059669]',
      };
    }
    if (src === 'RECEIPT') {
      return {
        label: 'Receipt Photo / OCR',
        desc: 'Logged via Camera photo or receipt scan (Extracted with Vision OCR)',
        icon: Receipt,
        color: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/30',
        badgeColor: 'bg-[#3b82f6]/15 text-[#2563eb]',
      };
    }
    // Check if raw transcript looks like an SMS notification
    const raw = transaction.group?.rawTranscript?.toLowerCase() || '';
    if (
      raw.includes('you have received') ||
      raw.includes('transferred') ||
      raw.includes('debited') ||
      raw.includes('credited') ||
      raw.includes('telebirr:') ||
      raw.includes('cbe birr')
    ) {
      return {
        label: 'Bank SMS Notification',
        desc: 'Logged via forwarded bank SMS payment alert',
        icon: Smartphone,
        color: 'text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/30',
        badgeColor: 'bg-[#8b5cf6]/15 text-[#7c3aed]',
      };
    }
    return {
      label: 'Direct Text Message',
      desc: 'Logged via typed text in Telegram bot chat',
      icon: MessageSquare,
      color:
        'text-[var(--electric-cobalt)] bg-[var(--electric-cobalt)]/10 border-[var(--electric-cobalt)]/30',
      badgeColor: 'bg-[var(--electric-cobalt)]/15 text-[var(--electric-cobalt)]',
    };
  };

  const methodMeta = getMethodMeta();
  const MethodIcon = methodMeta.icon;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl bg-[var(--pure-white)] border border-[var(--border-hairline)] shadow-xl">
        {/* Header with Amount & Kind */}
        <DialogHeader className="pb-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FinancialKindBadge
                kind={transaction.kind}
                type={transaction.type}
                locale={locale}
                size="md"
              />
              <span className="text-xs text-[var(--slate-gray)] font-mono">
                #{transaction.id.slice(0, 8)}
              </span>
            </div>
          </div>
          <DialogTitle className="text-[22px] font-bold text-[var(--ink-charcoal)] mt-2 tabular-nums">
            {Number(transaction.amount).toLocaleString(locale === 'am' ? 'am-ET' : 'en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ETB
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--slate-gray)]">
            Occurred on{' '}
            {new Date(transaction.occurredAt).toLocaleString(locale === 'am' ? 'am-ET' : 'en-US')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 1. Ingestion Method & Channel Card (High Prominence) */}
          <div className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--slate-gray)] uppercase tracking-wider">
                Ingestion Channel & Method
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${methodMeta.badgeColor}`}
              >
                <MethodIcon className="size-3" />
                {methodMeta.label}
              </span>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <div
                className={`flex size-9 items-center justify-center rounded-xl border shrink-0 ${methodMeta.color}`}
              >
                <MethodIcon className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--ink-charcoal)]">
                  {methodMeta.label} (via Telegram Bot)
                </p>
                <p className="text-[11px] text-[var(--slate-gray)] mt-0.5 leading-relaxed">
                  {methodMeta.desc}
                </p>
              </div>
            </div>
          </div>

          {/* 2. User Profile Card */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)]">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar
                userId={transaction.user.id}
                name={userFullName}
                size="md"
                allowPreview={true}
                className="shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--ink-charcoal)] truncate">
                  {userFullName}
                </p>
                <p className="text-[11px] text-[var(--slate-gray)]">
                  {transaction.user.username
                    ? `@${transaction.user.username}`
                    : `Telegram ID: ${transaction.user.telegramId || '—'}`}
                </p>
              </div>
            </div>

            {onNavigateUser ? (
              <button
                type="button"
                onClick={() => onNavigateUser(transaction.user.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-ivory)] px-2.5 py-1 text-xs font-medium text-[var(--ink-charcoal)] hover:bg-[var(--pure-white)] transition-colors cursor-pointer shadow-2xs"
              >
                <span>View User Ledger</span>
                <ExternalLink className="size-3" />
              </button>
            ) : null}
          </div>

          {/* 3. Classification Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)]">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--slate-gray)]">
                <Tag className="size-3.5 text-[var(--electric-cobalt)]" />
                <span>Spending Category</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--ink-charcoal)] capitalize">
                {categoryLabel}
              </p>
            </div>

            {/* Banking Platform */}
            <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)]">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--slate-gray)]">
                <Landmark className="size-3.5 text-[#10b981]" />
                <span>Payment Platform / Rail</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 min-w-0">
                <BankLogo platform={transaction.platform} className="size-4" />
                <p className="text-xs font-semibold text-[var(--ink-charcoal)] truncate">
                  {formatPlatform(transaction.platform)}
                </p>
              </div>
            </div>

            {/* Financial Event Kind */}
            <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)]">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--slate-gray)]">
                <Radio className="size-3.5 text-indigo-500" />
                <span>Financial Event Kind</span>
              </div>
              <div className="mt-1">
                <FinancialKindBadge
                  kind={transaction.kind}
                  type={transaction.type}
                  locale={locale}
                  size="sm"
                />
              </div>
            </div>

            {/* Timestamp */}
            <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)]">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--slate-gray)]">
                <Calendar className="size-3.5 text-amber-500" />
                <span>Date & Time (EAT)</span>
              </div>
              <p className="mt-1 text-xs font-medium text-[var(--ink-charcoal)] tabular-nums">
                {transaction.occurredAt.slice(0, 16).replace('T', ' ')}
              </p>
            </div>
          </div>

          {/* 4. Parsed Description Note */}
          <div className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] space-y-1">
            <span className="text-[10px] font-bold text-[var(--slate-gray)] uppercase tracking-wider block">
              Parsed Description Note
            </span>
            <p className="text-xs text-[var(--ink-charcoal)] font-medium">
              {transaction.note || 'No description note provided.'}
            </p>
          </div>

          {/* 5. Raw Input Transcript / Speech / OCR / SMS Text */}
          {transaction.group?.rawTranscript ? (
            <div className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[var(--slate-gray)] uppercase tracking-wider">
                  Raw Input Content ({methodMeta.label})
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyTranscript(transaction.group.rawTranscript || '')}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] cursor-pointer"
                >
                  {copied ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-xs font-mono text-[var(--ink-charcoal)] bg-[var(--pure-white)] p-2.5 rounded-lg border border-[var(--border-hairline)] whitespace-pre-wrap leading-relaxed">
                "{transaction.group.rawTranscript}"
              </p>
            </div>
          ) : null}

          {/* 6. Receipt Image Attachment Preview (if available) */}
          {transaction.group?.receiptImagePath ? (
            <div className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-charcoal)]">
                  <Receipt className="size-3.5 text-[#3b82f6]" />
                  <span>Original Scanned Receipt Photo</span>
                </div>
                <a
                  href={`/api/admin/media/receipts/${transaction.groupId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--electric-cobalt)] hover:underline"
                >
                  <span>Open Full Size</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-[var(--border-hairline)] bg-[var(--surface-ivory)] max-h-64 flex items-center justify-center">
                <img
                  src={`/api/admin/media/receipts/${transaction.groupId}`}
                  alt="Scanned receipt transaction"
                  className="w-full max-h-64 object-contain rounded-xl hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
            </div>
          ) : null}

          {/* 7. AI Extraction Pipeline Forensics */}
          <div className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] text-[11px] space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[var(--ink-charcoal)]">
              <Cpu className="size-3.5 text-[var(--electric-cobalt)]" />
              <span>AI Extraction Pipeline (Database Telemetry)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-[var(--slate-gray)] pt-1 border-t border-[var(--border-hairline)]">
              <div>
                <span className="block text-[10px] text-[var(--steel-gray)]">STT Model</span>
                <strong className="text-[var(--ink-charcoal)]">
                  {transaction.source === 'VOICE'
                    ? (transaction.group?.sttModel ?? 'Groq Whisper Large v3')
                    : 'N/A (Text / OCR)'}
                </strong>
              </div>
              <div>
                <span className="block text-[10px] text-[var(--steel-gray)]">Extraction Model</span>
                <strong className="text-[var(--ink-charcoal)]">
                  {transaction.group?.extractionModel || 'gemini-2.0-flash'}
                </strong>
              </div>
              <div>
                <span className="block text-[10px] text-[var(--steel-gray)]">Prompt Version</span>
                <strong className="text-[var(--ink-charcoal)]">
                  {transaction.group?.promptVersion
                    ? transaction.group.promptVersion.startsWith('v')
                      ? transaction.group.promptVersion
                      : `v${transaction.group.promptVersion}`
                    : 'v1.0.0'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
