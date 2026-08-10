import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Search, Store, UserCheck2 } from 'lucide-react';

interface AdminGlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RESULT_LIMIT = 8;

export function AdminGlobalSearch({ open, onOpenChange }: AdminGlobalSearchProps) {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedInput = useDebounce(inputValue.trim(), 250);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-global-search', searchTerm],
    enabled: open && searchTerm.length > 1,
    queryFn: async () => {
      const like = `%${searchTerm}%`;
      const [franchiseesResult, portalsResult, brandsResult] = await Promise.all([
        supabase
          .from('franchisees')
          .select('id,name,email,address,legal_business_name,franchise_location_name,status')
          .or(`name.ilike.${like},email.ilike.${like},address.ilike.${like},legal_business_name.ilike.${like},franchise_location_name.ilike.${like}`)
          .eq('status', 'completed')
          .limit(RESULT_LIMIT),
        supabase.from('portals').select('id,name,subdomain').or(`name.ilike.${like},subdomain.ilike.${like}`).limit(RESULT_LIMIT),
        supabase.from('brands').select('id,name,portal_id').ilike('name', like).limit(RESULT_LIMIT),
      ]);

      return {
        completedSignups: franchiseesResult.error ? [] : (franchiseesResult.data ?? []),
        portals: portalsResult.error ? [] : (portalsResult.data ?? []),
        brands: brandsResult.error ? [] : (brandsResult.data ?? []),
      };
    },
  });

  const completedSignups = useMemo(() => data?.completedSignups ?? [], [data]);
  const portals = useMemo(() => data?.portals ?? [], [data]);
  const brands = useMemo(() => data?.brands ?? [], [data]);

  const runSearch = () => setSearchTerm(debouncedInput);

  const goTo = (route?: string) => {
    if (!route) return;
    onOpenChange(false);
    navigate(route);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="mx-auto w-[min(96vw,1100px)] overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-2xl">
        <div className="border-b border-border/60 bg-background/95 p-4 sm:p-5">
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3 py-2">
            <div className="min-w-0 flex-1">
              <CommandInput
                value={inputValue}
                onValueChange={setInputValue}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    runSearch();
                  }
                }}
                placeholder="Search completed signups, portals, brands..."
                className="h-12 border-0 text-base"
              />
            </div>
            <Button onClick={runSearch} disabled={debouncedInput.length < 2} className="h-11 shrink-0 gap-2 rounded-xl px-5">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">Press Enter or click Search to run results.</p>
        </div>

        <CommandList className="max-h-[70vh] overflow-x-hidden overflow-y-auto p-4 sm:p-5">
          <CommandEmpty>{searchTerm.length <= 1 ? 'Type 2+ characters, then press Search.' : 'No results found.'}</CommandEmpty>

          <CommandGroup heading="Completed Signups" className="mb-4 rounded-xl border border-border/60 bg-card/70 p-2 sm:p-3">
            {isLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading completed signups...</div>}
            {!isLoading && searchTerm.length > 1 && completedSignups.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No completed signups found.</div>}
            {completedSignups.map((item) => (
              <CommandItem key={`signup-${item.id}`} value={`signup-${item.name ?? ''}-${item.email ?? ''}`} onSelect={() => goTo(item.id ? `/admin/franchisees/${item.id}` : undefined)} disabled={!item.id} className="flex items-start gap-3 rounded-xl px-3 py-3">
                <UserCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name || item.legal_business_name || 'Unnamed signup'}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.email || item.franchise_location_name || item.address || 'No context available'}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Portals" className="mb-4 rounded-xl border border-border/60 bg-card/70 p-2 sm:p-3">
            {isLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading portals...</div>}
            {!isLoading && searchTerm.length > 1 && portals.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No portals found.</div>}
            {portals.map((portal) => (
              <CommandItem key={`portal-${portal.id ?? portal.subdomain}`} value={`portal-${portal.name ?? ''}-${portal.subdomain ?? ''}`} onSelect={() => goTo(portal.id ? `/portals/${portal.id}` : undefined)} disabled={!portal.id} className="flex items-start gap-3 rounded-xl px-3 py-3">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{portal.name || 'Unnamed portal'}</p>
                  <p className="truncate text-xs text-muted-foreground">{portal.subdomain || 'No subdomain'}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Brands" className="mb-4 rounded-xl border border-border/60 bg-card/70 p-2 sm:p-3">
            {isLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading brands...</div>}
            {!isLoading && searchTerm.length > 1 && brands.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No brands found.</div>}
            {brands.map((brand) => (
              <CommandItem key={`brand-${brand.id ?? brand.name}`} value={`brand-${brand.name ?? ''}`} onSelect={() => goTo(brand.id && brand.portal_id ? `/portals/${brand.portal_id}/brands/${brand.id}` : undefined)} disabled={!brand.id || !brand.portal_id} className="flex items-start gap-3 rounded-xl px-3 py-3">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{brand.name || 'Unnamed brand'}</p>
                  <p className="truncate text-xs text-muted-foreground">{brand.portal_id ? `Portal ID: ${brand.portal_id}` : 'Missing portal context'}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Fourth Group (Pending Product Confirmation)" className="rounded-xl border border-border/60 bg-card/70 p-2 sm:p-3">
            <CommandItem disabled className="rounded-xl px-3 py-3 text-muted-foreground">Planned source table + route will be wired once product confirms the fourth dataset.</CommandItem>
          </CommandGroup>
        </CommandList>
      </div>
    </CommandDialog>
  );
}
