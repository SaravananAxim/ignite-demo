import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function PlanCardSkeleton() {
  return (
    <Card className="overflow-hidden border border-border rounded-lg shadow-card">
      <CardHeader className="p-card-padding pb-0">
        {/* Plan name skeleton */}
        <Skeleton className="h-7 w-40 mb-2" />
        {/* Price skeleton */}
        <Skeleton className="h-12 w-32" />
      </CardHeader>

      <CardContent className="p-card-padding pt-6 space-y-6">
        {/* Description skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>

        {/* Deliverables skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Paid media option skeleton */}
        <Skeleton className="h-24 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}
