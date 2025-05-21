import { Product } from "@shared/schema";
import ProductCard from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
}

export default function ProductGrid({
  products,
  isLoading = false,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-card rounded-lg overflow-hidden shadow-md"
          >
            <Skeleton className="aspect-square w-full" />
            <div className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-2/4 mb-3" />
              <Skeleton className="h-4 w-full mb-3" />
              <div className="flex justify-between">
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium text-foreground">
          Keine Produkte gefunden
        </h3>
        <p className="text-muted-foreground mt-2">
          Keine Produkte gefunden versuchen sie mit einem anderen filter
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
