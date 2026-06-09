import { Button } from '@/components/ui/button';
import { X, RotateCcw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormRecoveryBannerProps {
  onRestore: () => void;
  onDismiss: () => void;
  className?: string;
}

export function FormRecoveryBanner({ onRestore, onDismiss, className }: FormRecoveryBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-4 rounded-lg',
        'bg-accent/50 border border-accent',
        'animate-in fade-in slide-in-from-top-2',
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            We found your unsaved work
          </p>
          <p className="text-xs text-muted-foreground">
            Would you like to restore your previous form data?
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onDismiss}
          className="gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          Dismiss
        </Button>
        <Button
          size="sm"
          onClick={onRestore}
          className="gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restore
        </Button>
      </div>
    </div>
  );
}
