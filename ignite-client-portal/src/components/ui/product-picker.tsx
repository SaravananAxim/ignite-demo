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

interface PickerProduct {
  id: string;
  name: string;
  product_id: string;
  product_line: string | null;
  primary_pillar: string | null;
  price_monthly: number | null;
}

interface ProductPickerProps {
  selectedProductIds: string[];
  onAdd: (productIds: string[]) => void;
  onRemove: (productId: string) => void;
}

export function ProductPicker({ selectedProductIds, onAdd, onRemove }: ProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeLine, setActiveLine] = useState('__all__');
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set());

  const { data: allProducts = [] } = useQuery<PickerProduct[]>({
    queryKey: ['products-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,product_id,product_line,primary_pillar,price_monthly')
        .order('name');
      if (error) throw error;
      return data as PickerProduct[];
    },
    staleTime: Infinity,
  });

  const productById = useMemo(
    () => new Map(allProducts.map((p) => [p.id, p])),
    [allProducts],
  );

  const productLines = useMemo(
    () =>
      Array.from(new Set(allProducts.map((p) => p.product_line).filter(Boolean))).sort() as string[],
    [allProducts],
  );

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allProducts
      .filter((p) => {
        if (activeLine !== '__all__' && p.product_line !== activeLine) return false;
        if (q) {
          const matches =
            p.name.toLowerCase().includes(q) ||
            p.product_id.toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      })
      .slice(0, 50);
  }, [allProducts, search, activeLine]);

  const handleOpen = () => {
    setDraftSelected(new Set(selectedProductIds));
    setSearch('');
    setActiveLine('__all__');
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
    const existing = new Set(selectedProductIds);
    const toAdd = [...draftSelected].filter((id) => !existing.has(id));
    const toRemove = [...existing].filter((id) => !draftSelected.has(id));
    if (toAdd.length > 0) onAdd(toAdd);
    toRemove.forEach((id) => onRemove(id));
    setOpen(false);
  };

  const formatPrice = (price: number | null) =>
    price != null ? `$${price.toLocaleString()}/mo` : '—';

  return (
    <div className="space-y-2">
      {selectedProductIds.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No products added yet</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {selectedProductIds.map((id) => {
            const product = productById.get(id);
            if (!product) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-sm"
              >
                <span className="font-medium">{product.name}</span>
                <Badge variant="outline" className="px-1 font-mono text-xs">
                  {product.product_id}
                </Badge>
                {product.price_monthly != null && (
                  <span className="text-xs text-muted-foreground">
                    {formatPrice(product.price_monthly)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  className="ml-0.5 rounded-full text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Remove ${product.name}`}
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
        Add Products
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-[680px] flex-col gap-0 p-0">
          <DialogHeader className="px-4 pb-2 pt-4">
            <div className="flex items-center gap-2">
              <DialogTitle>Add Products</DialogTitle>
              {draftSelected.size > 0 && (
                <Badge variant="secondary">{draftSelected.size} selected</Badge>
              )}
            </div>
          </DialogHeader>

          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or product ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1 overflow-x-auto px-4 pb-2">
            <button
              type="button"
              onClick={() => setActiveLine('__all__')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeLine === '__all__'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              All
            </button>
            {productLines.map((line) => (
              <button
                key={line}
                type="button"
                onClick={() => setActiveLine(activeLine === line ? '__all__' : line)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  activeLine === line
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {line}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto border-t">
            {filteredProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No products found</p>
            ) : (
              <div className="divide-y">
                {filteredProducts.map((product) => {
                  const checked = draftSelected.has(product.id);
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50',
                        checked && 'bg-primary/5',
                      )}
                      onClick={() => toggleDraft(product.id)}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleDraft(product.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{product.name}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {product.product_id}
                        </span>
                      </div>
                      {product.product_line && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {product.product_line}
                        </Badge>
                      )}
                      <span className="shrink-0 font-mono text-sm text-muted-foreground">
                        {formatPrice(product.price_monthly)}
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
