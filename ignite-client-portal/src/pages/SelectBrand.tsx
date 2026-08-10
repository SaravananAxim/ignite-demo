import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PortalGate } from '@/components/PortalGate';
import { BrandCard } from '@/components/brands/BrandCard';
import { BrandCardSkeleton } from '@/components/brands/BrandCardSkeleton';
import { ResumeOnboardingBanner } from '@/components/onboarding/ResumeOnboardingBanner';
import { AlertCircle, Building2 } from 'lucide-react';

export default function SelectBrand() {
  const { portal } = usePortal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(
    searchParams.get('selected') || null
  );
  const { data: brands, isLoading, error } = useQuery({
    queryKey: ['portal-brands', portal?.portal_id],
    queryFn: async () => {
      if (!portal?.portal_id) return [];
      
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, logo_url')
        .eq('portal_id', portal.portal_id)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!portal?.portal_id,
  });

  // Preserve portal query parameter when navigating
  const portalParam = searchParams.get('portal');
  const buildSelectPlanUrl = useCallback((brandId: string) => {
    const params = new URLSearchParams({ brand_id: brandId });
    if (portalParam) params.set('portal', portalParam);
    return `/select-plan?${params.toString()}`;
  }, [portalParam]);

  // Auto-skip brand selection when the portal only has one brand.
  useEffect(() => {
    if (!isLoading && brands?.length === 1) {
      navigate(buildSelectPlanUrl(brands[0].id), { replace: true });
    }
  }, [brands, isLoading, navigate, buildSelectPlanUrl]);

  const handleSelectBrand = (brandId: string) => {
    setSelectedBrandId(brandId);
    navigate(buildSelectPlanUrl(brandId));
  };

  // Don't render if auto-skipping
  if (!isLoading && brands?.length === 1) {
    return null;
  }

  return (
    <PortalGate>
      <PortalLayout 
        showBackButton={false}
        infoBannerText="Select the brand you'd like to partner with to begin your franchise journey."
      >
        <div className="animate-fade-in">
          {/* Resume Banner */}
          <ResumeOnboardingBanner className="mb-6" />

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-page-title text-foreground mb-3">
              Choose Your Brand
            </h1>
            <p className="text-body text-muted-foreground max-w-xl mx-auto">
              Each brand offers unique opportunities. Select the one that aligns with your business goals.
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <BrandCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-section-header text-foreground mb-2">
                Unable to Load Brands
              </h2>
              <p className="text-body text-muted-foreground">
                Please try refreshing the page. If the problem persists, contact support.
              </p>
            </div>
          )}

          {/* Zero Brands State */}
          {!isLoading && !error && brands?.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-section-header text-foreground mb-2">
                Portal Setup in Progress
              </h2>
              <p className="text-body text-muted-foreground max-w-md mx-auto">
                This portal is currently being configured. Please check back soon or contact your administrator for more information.
              </p>
            </div>
          )}

          {/* Brands Grid */}
          {!isLoading && !error && brands && brands.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {brands.map((brand, index) => (
                <div 
                  key={brand.id} 
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <BrandCard
                    brand={brand}
                    isSelected={selectedBrandId === brand.id}
                    onSelect={() => handleSelectBrand(brand.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </PortalLayout>
    </PortalGate>
  );
}
