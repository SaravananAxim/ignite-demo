import { cn } from '@/lib/utils';

interface InfoBannerProps {
  children: React.ReactNode;
  className?: string;
}

export function InfoBanner({ children, className }: InfoBannerProps) {
  return (
    <div className={cn(
      'w-full bg-[hsl(210,14%,93%)] rounded-lg py-3.5 px-4 sm:px-[18px]',
      'text-sm text-foreground text-center',
      'mb-6',
      className
    )}>
      {children}
    </div>
  );
}
