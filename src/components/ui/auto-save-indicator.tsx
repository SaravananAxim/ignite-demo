import { Check, Cloud, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface AutoSaveIndicatorProps {
  lastSavedAt: Date | null;
  isSaving?: boolean;
  className?: string;
}

export function AutoSaveIndicator({ lastSavedAt, isSaving, className }: AutoSaveIndicatorProps) {
  if (!lastSavedAt && !isSaving) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs text-muted-foreground',
        className
      )}
    >
      {isSaving ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Saving...</span>
        </>
      ) : lastSavedAt ? (
        <>
          <Cloud className="w-3 h-3" />
          <Check className="w-3 h-3 text-success" />
          <span>
            Saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}
          </span>
        </>
      ) : null}
    </div>
  );
}
