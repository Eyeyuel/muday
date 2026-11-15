import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChatInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onEnterSubmit?: () => void;
}

export const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({ className, onEnterSubmit, onKeyDown, onChange, rows = 1, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onEnterSubmit?.();
      }
      onKeyDown?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const target = e.target;
      target.style.height = 'auto';
      target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
      onChange?.(e);
    };

    return (
      <textarea
        ref={(node) => {
          textareaRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref && 'current' in ref) {
            ref.current = node;
          }
        }}
        rows={rows}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        className={cn(
          'flex min-h-[44px] max-h-[180px] w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 transition-all',
          className,
        )}
        {...props}
      />
    );
  },
);
ChatInput.displayName = 'ChatInput';
