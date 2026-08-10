import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PickerPackage {
  id: string;
  name: string;
  package_id: string;
  product_line: string | null;
  tier: string | null;
  monthly_price: number | null;
}

interface PackagePickerProps {
  selectedPackageIds: string[];
  onAdd: (packageIds: string[]) => void;
  onRemove: (packageId: string) => void;
  role?: string;
}

function tierBadge(tier: string | null) {
  if (!tier) return null;
  if (tier === 'Best')
    return <Badge className="shrink-0 bg-green-100 text-green-800 hover:bg-green-100 text-xs">{tier}</Badge>;
  if (tier === 'Better')
    return <Badge className="shrink-0 bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">{tier}</Badge>;
  return <Badge variant="secondary" className="shrink-0 text-xs">{tier}</Badge>;
}

export function PackagePicker({ selectedPackageIds, onAdd, onRemove, role }: PackagePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeLine, setActiveLine] = useState('__all__');
  const [activeTier, setActiveTier] = useState('__all__');
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set());

  const { data: allPackages = [] } = useQuery<PickerPackage[]>({
    queryKey: ['packages-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('id,name,package_id,product_line,tier,monthly_price')
        .order('product_line');
      if (error) throw error;
      return data as PickerPackage[];
    },
    staleTime: Infinity,
  });

  const packageById = useMemo(
    () => new Map(allPackages.map((p) => [p.id, p])),
    [allPackages],
  );

  const productLines = useMemo(
    () =>
      Array.from(new Set(allPackages.map((p) => p.product_line).filter(Boolean))).sort() as string[],
    [allPackages],
  );

  const filteredPackages = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allPackages
      .filter((p) => {
        if (activeLine !== '__all__' && p.product_line !== activeLine) return false;
        if (activeTier !== '__all__' && p.tier !== activeTier) return false;
        if (q) {
          const matches =
            p.name.toLowerCase().includes(q) ||
            p.package_id.toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      })
      .slice(0, 50);
  }, [allPackages, search, activeLine, activeTier]);

  const handleOpen = () => {
    setDraftSelected(new Set(selectedPackageIds));
    setSearch('');
    setActiveLine('__all__');
    setActiveTier('__all__');
    setOpen(true);
  };

  const toggleDraft = (id: string) => {
    setDraftSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const existing = new Set(selectedPackageIds);
    const toAdd = [...draftSelected].filter((id) => !existing.has(id));
    const toRemove = [...existing].filter((id) => !draftSelected.has(id));
    if (toAdd.length > 0) onAdd(toAdd);
    toRemove.forEach((id) => onRemove(id));
    setOpen(false);
  };

  const formatPrice = (price: number | null) =>
    price != null ? `$${price.toLocaleString()}/mo` : '—';

  const filterBtn = (
    active: string,
    value: string,
    label: string,
    setActive: (v: string) => void,
  ) => (
    <button
      key={value}
      type="button"
      onClick={() => setActive(active === value ? '__all__' : value)}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
        active === value
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      {selectedPackageIds.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">No packages added yet</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {selectedPackageIds.map((id) => {
            const pkg = packageById.get(id);
            if (!pkg) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-sm"
              >
                <span className="font-medium">{pkg.name}</span>
                {role && (
                  <span className="text-xs text-muted-foreground">· {role}</span>
                )}
                {tierBadge(pkg.tier)}
                {pkg.monthly_price != null && (
                  <span className="text-xs text-muted-foreground">
                    {formatPrice(pkg.monthly_price)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  className="ml-0.5 rounded-full text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Remove ${pkg.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={handleOpen} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Add Packages
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-[680px] flex-col gap-0 p-0">
          <DialogHeader className="px-4 pb-2 pt-4">
            <div className="flex items-center gap-2">
              <DialogTitle>Add Packages</DialogTitle>
              {draftSelected.size > 0 && (
                <Badge variant="secondary">{draftSelected.size} selected</Badge>
              )}
            </div>
          </DialogHeader>

          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or package ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Product line filter */}
          {productLines.length > 0 && (
            <div className="flex flex-wrap gap-1 overflow-x-auto px-4 pb-1">
              {filterBtn(activeLine, '__all__', 'All Lines', setActiveLine)}
              {productLines.map((line) => filterBtn(activeLine, line, line, setActiveLine))}
            </div>
          )}

          {/* Tier filter */}
          <div className="flex flex-wrap gap-1 overflow-x-auto px-4 pb-2">
            {filterBtn(activeTier, '__all__', 'All Tiers', setActiveTier)}
            {(['Good', 'Better', 'Best'] as const).map((t) =>
              filterBtn(activeTier, t, t, setActiveTier),
            )}
          </div>

          <div className="flex-1 overflow-y-auto border-t">
            {filteredPackages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No packages found</p>
            ) : (
              <div className="divide-y">
                {filteredPackages.map((pkg) => {
                  const checked = draftSelected.has(pkg.id);
                  return (
                    <div
                      key={pkg.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50',
                        checked && 'bg-primary/5',
                      )}
                      onClick={() => toggleDraft(pkg.id)}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleDraft(pkg.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{pkg.name}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {pkg.package_id}
                        </span>
                      </div>
                      {tierBadge(pkg.tier)}
                      {pkg.product_line && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {pkg.product_line}
                        </Badge>
                      )}
                      <span className="shrink-0 font-mono text-sm text-muted-foreground">
                        {formatPrice(pkg.monthly_price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-3">
            <span className="text-sm text-muted-foreground">{draftSelected.size} selected</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleConfirm}>
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
