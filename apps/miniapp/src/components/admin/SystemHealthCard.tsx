import { useEffect, useState } from 'react';
import { CheckCircle2, Cpu, Database, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { fetchAdminSystemHealth } from '../../api/admin-api';
import type { AdminSystemHealth } from '../../api/admin-types';

export function SystemHealthCard() {
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchAdminSystemHealth();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check system health');
    } finally {
      setLoading(false);
    }
  };

  const setErrorMsg = (msg: string | null) => setError(msg);

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <section className="flex flex-col overflow-hidden rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink-charcoal)]">
            Infrastructure Diagnostics
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
            Live health and latency pings for Postgres, Redis, Gemini AI & Telegram Webhook
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadHealth()}
          disabled={loading}
          className="flex size-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] transition-colors cursor-pointer"
          title="Ping infrastructure"
        >
          <RefreshCw
            className={`size-3.5 ${loading ? 'animate-spin text-[var(--electric-cobalt)]' : ''}`}
          />
        </button>
      </div>

      <div className="space-y-4">
        {error ? (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        {health ? (
          <div className="space-y-4">
            {/* Overall Status Pill */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5ecf9a] opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-[#2f9e6e]" />
                </span>
                <span className="font-semibold text-[var(--ink-charcoal)]">
                  Overall Infrastructure:
                </span>
                <span className="text-[var(--slate-gray)]">
                  All backend microservices operational
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#5ecf9a]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#2f9e6e]">
                <CheckCircle2 className="size-3" />
                <span>{health.status}</span>
              </span>
            </div>

            {/* Individual Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* PostgreSQL */}
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-charcoal)]">
                    <Database className="size-3.5 text-[var(--electric-cobalt)]" />
                    <span>{health.services.database.name}</span>
                  </div>
                  <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-1.5 py-0.2 text-[10px] font-semibold text-[var(--electric-cobalt)]">
                    {health.services.database.status}
                  </span>
                </div>
                <div className="text-[18px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
                  {health.services.database.latencyMs ?? 0}{' '}
                  <span className="text-xs font-normal text-[var(--slate-gray)]">ms</span>
                </div>
                <p className="text-[10px] text-[var(--steel-gray)]">PostgreSQL query ping</p>
              </div>

              {/* Redis Cache */}
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-charcoal)]">
                    <Server className="size-3.5 text-[var(--electric-cobalt)]" />
                    <span>{health.services.redis.name}</span>
                  </div>
                  <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-1.5 py-0.2 text-[10px] font-semibold text-[var(--electric-cobalt)]">
                    {health.services.redis.status}
                  </span>
                </div>
                <div className="text-[18px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
                  {health.services.redis.latencyMs ?? 0}{' '}
                  <span className="text-xs font-normal text-[var(--slate-gray)]">ms</span>
                </div>
                <p className="text-[10px] text-[var(--steel-gray)]">Redis cache & BullMQ ping</p>
              </div>

              {/* Gemini AI */}
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-charcoal)]">
                    <Cpu className="size-3.5 text-[var(--electric-cobalt)]" />
                    <span>{health.services.gemini.name}</span>
                  </div>
                  <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-1.5 py-0.2 text-[10px] font-semibold text-[var(--electric-cobalt)]">
                    {health.services.gemini.status}
                  </span>
                </div>
                <div className="text-[18px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
                  {health.services.gemini.latencyMs ?? 0}{' '}
                  <span className="text-xs font-normal text-[var(--slate-gray)]">ms</span>
                </div>
                <p className="text-[10px] text-[var(--steel-gray)]">Gemini 2.5 Flash API ping</p>
              </div>

              {/* Telegram Webhook */}
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-charcoal)]">
                    <ShieldCheck className="size-3.5 text-[var(--electric-cobalt)]" />
                    <span>{health.services.telegram.name}</span>
                  </div>
                  <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-1.5 py-0.2 text-[10px] font-semibold text-[var(--electric-cobalt)]">
                    {health.services.telegram.status}
                  </span>
                </div>
                <div className="text-[18px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
                  {health.services.telegram.latencyMs ?? 0}{' '}
                  <span className="text-xs font-normal text-[var(--slate-gray)]">ms</span>
                </div>
                <p className="text-[10px] text-[var(--steel-gray)]">Telegram bot webhook status</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
