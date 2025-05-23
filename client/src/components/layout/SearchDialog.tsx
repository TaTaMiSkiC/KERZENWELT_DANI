import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, X } from "lucide-react";
import { Product } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface SearchDialogProps {
  trigger?: React.ReactNode;
}

export function SearchDialog({ trigger }: SearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { t } = useLanguage();
  
  // Dohvati sve proizvode za pretraživanje
  const { data: allProducts, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: open, // Dohvati proizvode samo kad je dijalog otvoren
  });
  
  // Filtriraj proizvode prema upitu za pretraživanje
  const filteredProducts = allProducts?.filter(product => {
    if (!debouncedSearchQuery) return false;
    
    const searchTerms = debouncedSearchQuery.toLowerCase().split(' ');
    const productName = product.name.toLowerCase();
    const productDescription = product.description.toLowerCase();
    
    // Proizvod se podudara ako sadrži sve pojmove pretrage
    return searchTerms.every((term: string) => 
      productName.includes(term) || productDescription.includes(term)
    );
  });
  
  // Fokusiraj polje za pretraživanje kad se dijalog otvori
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const searchInput = document.getElementById("search-input");
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    } else {
      setSearchQuery("");
    }
  }, [open]);
  
  const navigateToProduct = (productId: number) => {
    window.location.href = `/products/${productId}`;
    setOpen(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Zatvori dijalog na Escape
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="text-text-dark hover:text-primary hover:bg-transparent">
            <Search size={20} />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('search.title') ? t('search.title') : "Pretraži proizvode"}
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="search-input"
            placeholder={t('search.placeholder') ? t('search.placeholder') : "Pretražite proizvode..."}
            className="pl-8 pr-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {searchQuery && (
            <X
              className="absolute right-2 top-3 h-4 w-4 text-muted-foreground cursor-pointer"
              onClick={() => setSearchQuery("")}
            />
          )}
        </div>
        <div className="mt-4 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !debouncedSearchQuery ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              {t('search.enterTerm') ? t('search.enterTerm') : "Unesite pojam za pretraživanje..."}
            </p>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            <div className="space-y-2">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center p-2 rounded-md cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigateToProduct(product.id)}
                >
                  <div className="w-10 h-10 rounded-md bg-muted flex-shrink-0 overflow-hidden mr-3">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <Search className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {product.description.substring(0, 60)}
                      {product.description.length > 60 ? "..." : ""}
                    </p>
                  </div>
                  <div className="ml-2 text-sm font-medium">
                    {parseFloat(String(product.price)).toFixed(2)} €
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              {t('search.noResults') ? t('search.noResults') : `Nema rezultata za "${debouncedSearchQuery}"`}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}