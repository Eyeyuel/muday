import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { fetchAdminVoiceErrors } from '../../api/admin-api';
import type { AdminVoiceErrorItem } from '../../api/admin-types';

export function VoiceErrorDebuggerCard() {
  const [errors, setErrors] = useState<AdminVoiceErrorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadErrors = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchAdminVoiceErrors();
      setErrors(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load voice error logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadErrors();
  }, []);

  return (
    <section className="flex flex-col overflow-hidden rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink-charcoal)]">
            Extraction Failure Logs
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
            Recent failed audio recordings & OCR events with failure codes
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadErrors()}
          disabled={loading}
          className="flex size-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] transition-colors cursor-pointer"
          title="Refresh error log"
        >
          <RefreshCw
            className={`size-3.5 ${loading ? 'animate-spin text-[var(--electric-cobalt)]' : ''}`}
          />
        </button>
      </div>

      <div className="space-y-4">
        {errorMsg ? (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-600">
            {errorMsg}
          </div>
        ) : null}

        {loading && errors.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-xs text-[var(--slate-gray)] gap-2">
            <span className="size-4 border-2 border-[var(--electric-cobalt)] border-t-transparent rounded-full animate-spin" />
            <span>Fetching error logs…</span>
          </div>
        ) : null}

        {!loading && errors.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-[var(--border-hairline)] space-y-1.5">
            <CheckCircle2 className="size-6 text-[#2f9e6e]" />
            <p className="text-xs font-semibold text-[var(--ink-charcoal)]">
              No recent processing errors logged
            </p>
            <span className="text-[11px] text-[var(--slate-gray)]">
              All audio conversions and LLM extractions are executing cleanly.
            </span>
          </div>
        ) : null}

        {errors.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead>
                <tr className="bg-[var(--surface-ivory)] text-[11px] font-semibold tracking-[0.04em] text-[var(--slate-gray)] uppercase border-b border-[var(--border-hairline)]">
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Event Type</th>
                  <th className="p-2.5">User ID</th>
                  <th className="p-2.5">Failure Reason / Details</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e) => {
                  const rawCode = e.metadata?.failureCode ?? e.metadata?.reason;
                  const failureCode = typeof rawCode === 'string' ? rawCode : 'UNKNOWN';
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-[var(--border-hairline)] last:border-0 hover:bg-[var(--surface-ivory)] transition-colors"
                    >
                      <td className="p-2.5 text-xs text-[var(--slate-gray)] tabular-nums whitespace-nowrap">
                        {e.occurredAt.replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="p-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                          <AlertCircle className="size-3" />
                          {e.eventType}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-xs text-[var(--slate-gray)]">
                        {e.userId.slice(0, 8)}…
                      </td>
                      <td className="p-2.5 text-xs font-medium text-red-600">{failureCode}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
