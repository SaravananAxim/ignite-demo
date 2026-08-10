import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
}

interface BrandCardProps {
  brand: Brand;
  isSelected: boolean;
  onSelect: () => void;
}

export function BrandCard({ brand, isSelected, onSelect }: BrandCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const hasValidLogo = brand.logo_url && !imageError;

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-300 cursor-pointer bg-card',
        'shadow-card hover:shadow-elevated hover:-translate-y-1',
        'border border-border rounded-lg',
        isSelected && 'ring-2 ring-primary border-primary'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Select ${brand.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10 animate-scale-in">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      <CardContent className="p-6">
        {/* Logo container */}
        <div className="aspect-[16/10] rounded-lg bg-muted/30 flex items-center justify-center mb-5 overflow-hidden">
          {hasValidLogo ? (
            <>
              {imageLoading && (
                <div className="absolute inset-0 bg-muted animate-pulse rounded-lg" />
              )}
              <img
                src={brand.logo_url!}
                alt={`${brand.name} logo`}
                className={cn(
                  'max-w-[80%] max-h-[80%] object-contain transition-opacity duration-300',
                  imageLoading ? 'opacity-0' : 'opacity-100'
                )}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-4">
              <Building2 className="w-10 h-10 mb-3 text-muted-foreground/60" />
              <span className="text-section-header text-foreground text-center">
                {brand.name}
              </span>
            </div>
          )}
        </div>

        {/* Brand name (shown below logo if logo exists) */}
        {hasValidLogo && (
          <h3 className="text-section-header text-foreground text-center mb-4">
            {brand.name}
          </h3>
        )}

        {/* Select button */}
        <Button
          variant={isSelected ? 'default' : 'outline'}
          className={cn(
            'w-full h-10 rounded-md font-medium transition-all duration-200',
            !isSelected && 'group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Selected
            </>
          ) : (
            'Select Brand'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
