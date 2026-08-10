import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NetworkStatusProps {
  className?: string;
}

export function NetworkStatus({ className }: NetworkStatusProps) {
  const { isOnline, isReconnecting } = useNetworkStatus();

  if (isOnline && !isReconnecting) {
    return null;
  }

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-[max(0.75rem,env(safe-area-inset-left,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))] z-50 flex justify-center',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-auto flex max-w-full items-center gap-2 rounded-full px-4 py-2',
          'bg-destructive text-destructive-foreground',
          'shadow-lg animate-in fade-in slide-in-from-bottom-2',
        )}
        role="alert"
        aria-live="polite"
      >
        {isReconnecting ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span className="text-sm font-medium">Reconnecting...</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">You&apos;re offline</span>
          </>
        )}
      </div>
    </div>
  );
}
