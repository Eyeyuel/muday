import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Bot, Check, Copy, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// 1. ChatBubble (Root Wrapper)
// ---------------------------------------------------------------------------
const chatBubbleVariants = cva('flex w-full gap-3 py-1.5', {
  variants: {
    variant: {
      received: 'flex-row items-start justify-start',
      sent: 'flex-row-reverse items-start justify-start',
    },
  },
  defaultVariants: {
    variant: 'received',
  },
});

export interface ChatBubbleProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof chatBubbleVariants> {}

export const ChatBubble = React.forwardRef<HTMLDivElement, ChatBubbleProps>(
  ({ className, variant, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(chatBubbleVariants({ variant }), className)} {...props}>
        {children}
      </div>
    );
  },
);
ChatBubble.displayName = 'ChatBubble';

// ---------------------------------------------------------------------------
// 2. ChatBubbleAvatar
// ---------------------------------------------------------------------------
export interface ChatBubbleAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  fallback?: React.ReactNode;
  variant?: 'received' | 'sent';
}

export const ChatBubbleAvatar = React.forwardRef<HTMLDivElement, ChatBubbleAvatarProps>(
  ({ className, src, fallback, variant = 'received', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl text-xs font-semibold shadow-xs',
          variant === 'sent'
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
            : 'bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)]',
          className,
        )}
        {...props}
      >
        {src ? (
          <img src={src} alt="Avatar" className="h-full w-full rounded-xl object-cover" />
        ) : fallback ? (
          fallback
        ) : variant === 'sent' ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4 text-[var(--foreground)]" />
        )}
      </div>
    );
  },
);
ChatBubbleAvatar.displayName = 'ChatBubbleAvatar';

// ---------------------------------------------------------------------------
// 3. ChatBubbleMessage (Message Body Bubble)
// ---------------------------------------------------------------------------
const chatMessageVariants = cva(
  'relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs transition-colors',
  {
    variants: {
      variant: {
        received:
          'bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] rounded-tl-xs max-w-full',
        sent: 'bg-[var(--primary)] text-[var(--primary-foreground)] rounded-tr-xs font-medium w-fit max-w-full text-left inline-block whitespace-pre-wrap break-words',
      },
      isLoading: {
        true: 'flex items-center gap-1.5 py-3',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'received',
      isLoading: false,
    },
  },
);

export interface ChatBubbleMessageProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof chatMessageVariants> {
  isLoading?: boolean;
}

export const ChatBubbleMessage = React.forwardRef<HTMLDivElement, ChatBubbleMessageProps>(
  ({ className, variant, isLoading, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(chatMessageVariants({ variant, isLoading }), className)}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-1.5 py-1 text-[var(--muted-foreground)]">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--primary)] [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--primary)] [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--primary)]" />
          </div>
        ) : (
          children
        )}
      </div>
    );
  },
);
ChatBubbleMessage.displayName = 'ChatBubbleMessage';

// ---------------------------------------------------------------------------
// 4. ChatBubbleAction (Copy / Action Button)
// ---------------------------------------------------------------------------
export interface ChatBubbleActionProps {
  contentToCopy?: string;
  className?: string;
}

export function ChatBubbleAction({ contentToCopy, className }: ChatBubbleActionProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!contentToCopy) return;
    try {
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write restrictions
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-7 w-7 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0',
        copied && 'text-emerald-500 opacity-100',
        className,
      )}
      onClick={() => void handleCopy()}
      title={copied ? 'Copied to clipboard' : 'Copy message'}
      aria-label={copied ? 'Copied' : 'Copy'}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
