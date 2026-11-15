import * as React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

export function TypewriterMessage({
  content,
  animate = false,
  onComplete,
}: {
  content: string;
  animate?: boolean;
  onComplete?: () => void;
}) {
  const [displayedLength, setDisplayedLength] = React.useState(animate ? 0 : content.length);
  const isTyping = animate && displayedLength < content.length;

  React.useEffect(() => {
    if (!animate) {
      setDisplayedLength(content.length);
      return;
    }

    const step = Math.max(6, Math.floor(content.length / 35));
    const interval = setInterval(() => {
      setDisplayedLength((prev) => Math.min(prev + step, content.length));
    }, 16);

    return () => clearInterval(interval);
  }, [content, animate]);

  React.useEffect(() => {
    if (animate && displayedLength >= content.length) {
      onComplete?.();
    }
  }, [animate, displayedLength, content.length, onComplete]);

  const displayedText = isTyping ? content.slice(0, displayedLength) : content;

  return (
    <div className="relative w-full">
      <MarkdownRenderer content={displayedText} />
      {isTyping ? (
        <span className="inline-block h-3.5 w-1.5 ml-0.5 align-middle bg-[var(--primary)] animate-pulse" />
      ) : null}
    </div>
  );
}
