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

interface PickerSku {
  id: string;
  source_product: string;
  product_code: string | null;
  mapped_category: string | null;
  std_list_price: number | null;
}

interface SkuPickerProps {
  selectedSkuIds: string[];
  onAdd: (skuIds: string[]) => void;
  onRemove: (skuId: string) => void;
  planId?: string;
}

export function SkuPicker({ selectedSkuIds, onAdd, onRemove }: SkuPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('__all__');
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set());

  const { data: allSkus = [] } = useQuery<PickerSku[]>({
    queryKey: ['skus-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('id,source_product,product_code,mapped_category,std_list_price')
        .order('source_product')
        .limit(2000);
      if (error) throw error;
      return data as PickerSku[];
    },
    staleTime: Infinity,
  });

  const skuById = useMemo(
    () => new Map(allSkus.map((s) => [s.id, s])),
    [allSkus],
  );

  const categories = useMemo(
    () =>
      Array.from(new Set(allSkus.map((s) => s.mapped_category).filter(Boolean))).sort() as string[],
    [allSkus],
  );

  const filteredSkus = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allSkus
      .filter((sku) => {
        if (activeCategory !== '__all__' && sku.mapped_category !== activeCategory) return false;
        if (q) {
          const matches =
            sku.source_product.toLowerCase().includes(q) ||
            (sku.product_code ?? '').toLowerCase().includes(q) ||
            (sku.mapped_category ?? '').toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      })
      .slice(0, 50);
  }, [allSkus, search, activeCategory]);

  const handleOpen = () => {
    setDraftSelected(new Set(selectedSkuIds));
    setSearch('');
    setActiveCategory('__all__');
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
    const existing = new Set(selectedSkuIds);
    const toAdd = [...draftSelected].filter((id) => !existing.has(id));
    const toRemove = [...existing].filter((id) => !draftSelected.has(id));
    if (toAdd.length > 0) onAdd(toAdd);
    toRemove.forEach((id) => onRemove(id));
    setOpen(false);
  };

  const formatPrice = (price: number | null) =>
    price != null ? `$${price.toLocaleString()}` : '—';

  return (
    <div className="space-y-2">
      {selectedSkuIds.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No SKUs added yet</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {selectedSkuIds.map((id) => {
            const sku = skuById.get(id);
            if (!sku) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-sm"
              >
                <span className="font-medium">{sku.source_product}</span>
                {sku.mapped_category && (
                  <span className="text-xs text-muted-foreground">· {sku.mapped_category}</span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Remove ${sku.source_product}`}
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
        Add SKUs
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-[680px] flex-col gap-0 p-0">
          <DialogHeader className="px-4 pb-2 pt-4">
            <div className="flex items-center gap-2">
              <DialogTitle>Add SKUs</DialogTitle>
              {draftSelected.size > 0 && (
                <Badge variant="secondary">{draftSelected.size} selected</Badge>
              )}
            </div>
          </DialogHeader>

          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, or category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1 overflow-x-auto px-4 pb-2">
            <button
              type="button"
              onClick={() => setActiveCategory('__all__')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeCategory === '__all__'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(activeCategory === cat ? '__all__' : cat)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  activeCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto border-t">
            {filteredSkus.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No SKUs found</p>
            ) : (
              <div className="divide-y">
                {filteredSkus.map((sku) => {
                  const checked = draftSelected.has(sku.id);
                  return (
                    <div
                      key={sku.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50',
                        checked && 'bg-primary/5',
                      )}
                      onClick={() => toggleDraft(sku.id)}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleDraft(sku.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{sku.source_product}</span>
                        {sku.product_code && (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {sku.product_code}
                          </span>
                        )}
                      </div>
                      {sku.mapped_category && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {sku.mapped_category}
                        </Badge>
                      )}
                      <span className="shrink-0 font-mono text-sm text-muted-foreground">
                        {formatPrice(sku.std_list_price)}
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
