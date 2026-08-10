import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function BrandCardSkeleton() {
  return (
    <Card className="overflow-hidden border border-border rounded-lg shadow-card">
      <CardContent className="p-6">
        {/* Logo skeleton */}
        <Skeleton className="aspect-[16/10] rounded-lg mb-5" />
        
        {/* Name skeleton */}
        <Skeleton className="h-7 w-3/4 mx-auto mb-4" />
        
        {/* Button skeleton */}
        <Skeleton className="h-10 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}
