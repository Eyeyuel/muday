import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChatMessageListProps extends React.HTMLAttributes<HTMLDivElement> {
  autoScroll?: boolean;
}

export const ChatMessageList = React.forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ className, autoScroll = true, children, ...props }, forwardedRef) => {
    const internalRef = React.useRef<HTMLDivElement>(null);
    const containerRef = (forwardedRef as React.RefObject<HTMLDivElement | null>) || internalRef;

    React.useEffect(() => {
      if (autoScroll && containerRef.current) {
        if (typeof containerRef.current.scrollTo === 'function') {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: 'smooth',
          });
        } else {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }
    }, [children, autoScroll, containerRef]);

    return (
      <div
        ref={containerRef}
        className={cn(
          'flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6 scroll-smooth',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ChatMessageList.displayName = 'ChatMessageList';
