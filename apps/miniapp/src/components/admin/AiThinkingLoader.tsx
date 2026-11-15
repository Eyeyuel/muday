import * as React from 'react';
import { Database } from 'lucide-react';

const THINKING_STAGES = [
  'Analyzing inquiry...',
  'Querying database records...',
  'Calculating metrics and aggregates...',
  'Synthesizing insights...',
];

export function AiThinkingLoader() {
  const [stageIndex, setStageIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % THINKING_STAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const currentStage = THINKING_STAGES[stageIndex] ?? 'Analyzing...';

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-[var(--card)] border border-[var(--border)] px-4 py-3.5 shadow-xs max-w-md animate-in fade-in-50 duration-200">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
          <Database className="h-3.5 w-3.5 animate-pulse" />
        </div>
        <span className="text-xs font-medium text-[var(--foreground)] transition-all duration-300">
          {currentStage}
        </span>
      </div>

      <div className="flex items-center gap-1.5 pl-1 py-1">
        <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-bounce [animation-delay:-0.3s]" />
        <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-bounce [animation-delay:-0.15s]" />
        <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-bounce" />
        <span className="ml-2 text-[11px] text-[var(--muted-foreground)] font-mono">
          thinking...
        </span>
      </div>
    </div>
  );
}
