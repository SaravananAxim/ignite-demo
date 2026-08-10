import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  monthly_price_with_media?: number | null;
  supports_paid_media: boolean;
  requires_paid_media?: boolean;
  stripe_payment_link: string;
  stripe_payment_link_with_media: string | null;
  stripe_price_id_with_media?: string | null;
}

interface PlanCardProps {
  plan: Plan;
  isSelected: boolean;
  includePaidMedia: boolean;
  onSelect: () => void;
  onTogglePaidMedia: (checked: boolean) => void;
  formatPrice: (price: number) => string;
}

export function PlanCard({
  plan,
  isSelected,
  includePaidMedia,
  onSelect,
  onTogglePaidMedia,
  formatPrice,
}: PlanCardProps) {
  // Basic sanitization for HTML
  const sanitizeDescription = (html: string): string => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  };

  const isHTML = /<[a-z][\s\S]*>/i.test(plan.description);

  const canAddPaidMedia =
    plan.supports_paid_media &&
    !!plan.stripe_price_id_with_media &&
    typeof plan.monthly_price_with_media === 'number' &&
    plan.monthly_price_with_media > 0;

  const isMediaRequired = !!plan.requires_paid_media && canAddPaidMedia;
  const effectiveIncludePaidMedia = isMediaRequired || includePaidMedia;

  // monthly_price_with_media is the ADD-ON amount, so total = base + add-on
  const mediaAddon = (plan.monthly_price_with_media as number) || 0;
  const totalMonthly = effectiveIncludePaidMedia && isSelected && canAddPaidMedia
    ? plan.monthly_price + mediaAddon
    : plan.monthly_price;

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300 cursor-pointer h-full',
        'bg-card border border-border rounded-lg shadow-card',
        'hover:shadow-elevated hover:-translate-y-1',
        isSelected && 'ring-2 ring-primary border-primary shadow-elevated'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Select ${plan.name} plan at ${formatPrice(plan.monthly_price)} per month`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-5 right-5 w-7 h-7 rounded-full bg-primary flex items-center justify-center z-10 animate-scale-in">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      <CardHeader className="p-card-padding pb-0">
        {/* Plan Name */}
        <h3 className="text-section-header text-foreground mb-2">{plan.name}</h3>
        
        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-card-headline text-foreground">
            {formatPrice(totalMonthly)}
          </span>
          <span className="text-body text-muted-foreground">/month</span>
        </div>

        {isSelected && canAddPaidMedia && (
          <p className="text-xs text-muted-foreground mt-2">
            Base {formatPrice(plan.monthly_price)} + Paid media {formatPrice(mediaAddon)}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-card-padding pt-6 space-y-6">
        {/* Description / What's Included */}
        <div className="text-body text-muted-foreground">
          {isHTML ? (
            <div 
              dangerouslySetInnerHTML={{ __html: sanitizeDescription(plan.description) }}
              className="prose prose-sm max-w-none prose-ul:my-2 prose-li:my-0.5 prose-li:marker:text-primary [&_ul]:pl-0 [&_li]:flex [&_li]:items-start [&_li]:gap-2 [&_li]:before:content-['✓'] [&_li]:before:text-primary [&_li]:before:font-bold [&_li]:list-none"
            />
          ) : (
            <p>{plan.description}</p>
          )}
        </div>

        {/* Paid Media Option */}
        {plan.supports_paid_media && (
          <div
            className={cn(
              'p-4 rounded-lg border-2 transition-all duration-300',
              effectiveIncludePaidMedia && isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border bg-muted/20 hover:border-primary/40',
              isMediaRequired && 'cursor-not-allowed'
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (isMediaRequired) return; // Can't toggle if required
              if (isSelected) {
                if (!canAddPaidMedia) return;
                onTogglePaidMedia(!includePaidMedia);
              } else {
                onSelect();
              }
            }}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                id={`paid-media-${plan.id}`}
                checked={effectiveIncludePaidMedia && isSelected}
                onCheckedChange={(checked) => {
                  if (isMediaRequired) return; // Can't toggle if required
                  if (!isSelected) {
                    onSelect();
                  }
                  if (!canAddPaidMedia) return;
                  onTogglePaidMedia(checked === true);
                }}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5"
                disabled={!canAddPaidMedia || isMediaRequired}
                aria-describedby={`paid-media-desc-${plan.id}`}
              />
              <div className="flex-1">
                <Label
                  htmlFor={`paid-media-${plan.id}`}
                  className={cn(
                    "text-body-medium text-foreground flex items-center gap-2",
                    isMediaRequired ? "cursor-not-allowed" : "cursor-pointer"
                  )}
                >
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {isMediaRequired ? 'Paid Media Program (Required)' : 'Include Paid Media Program'}
                </Label>
                <p 
                  id={`paid-media-desc-${plan.id}`}
                  className="text-sm text-muted-foreground mt-1"
                >
                  {isMediaRequired
                    ? `Paid media included (+${formatPrice(mediaAddon)}/mo)`
                    : canAddPaidMedia
                      ? `Add-on: +${formatPrice(mediaAddon)}/mo`
                      : 'Paid media add-on is not configured for this plan'
                  }
                </p>
              </div>
              <Badge 
                variant={isMediaRequired ? "default" : "secondary"} 
                className="flex-shrink-0 text-xs"
              >
                {isMediaRequired ? 'Required' : 'Add-on'}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
