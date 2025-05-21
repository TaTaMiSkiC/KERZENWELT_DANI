import { Loader2, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/hooks/use-language";
import type { Collection, Product } from "@/types";

export default function CollectionBanner() {
  const { t } = useLanguage();

  // Dohvati "featured" kolekcije
  const { data: featuredCollections, isLoading: isLoadingCollections } =
    useQuery<Collection[]>({
      queryKey: ["/api/collections/featured"],
    });

  // Uzmemo prvu featured kolekciju ako postoji
  const collection =
    featuredCollections && featuredCollections.length > 0
      ? featuredCollections[0]
      : null;

  // Dohvati proizvode za kolekciju ako postoji
  const { data: collectionProducts, isLoading: isLoadingProducts } = useQuery<
    Product[]
  >({
    queryKey: ["/api/collections", collection?.id, "products"],
    queryFn: () => {
      if (!collection) return Promise.resolve([]);
      return fetch(`/api/collections/${collection.id}/products`).then((res) =>
        res.json(),
      );
    },
    enabled: !!collection,
  });

  // Prikaži loader dok se kolekcije učitavaju
  if (isLoadingCollections) {
    return (
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  // Ako nema niti jedne featured kolekcije — ne prikazuj ništa
  if (!collection) {
    return null;
  }

  // Prikaži kolekciju iz baze
  return (
    <section
      className="py-16 bg-cover bg-center relative"
      style={{
        backgroundImage: `url('${collection.imageUrl || "https://pixabay.com/get/g8e2f0ab9fd933a4f95a13e49fdf8085b52ca4a5bedcb5ce350d22dc4ea759bff5b101615776d64d0ace352b4ee82b8d59b79a7333527cda411e43f4a66b85e42_1280.jpg"}')`,
      }}
    >
      <div className="absolute inset-0 bg-primary bg-opacity-60"></div>
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-lg bg-card p-10 rounded-lg shadow-lg ml-auto">
          <h2 className="heading text-3xl font-bold text-foreground mb-4">
            {collection.name}
          </h2>
          <p className="text-muted-foreground mb-6">{collection.description}</p>

          {isLoadingProducts ? (
            <div className="flex justify-center mb-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ul className="mb-8 text-foreground">
              {collectionProducts && collectionProducts.length > 0 ? (
                collectionProducts.slice(0, 4).map((product) => (
                  <li key={product.id} className="flex items-center mb-2">
                    <Check size={16} className="text-primary mr-2" />
                    <span>{product.name}</span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">
                  {t("home.noProducts")}
                </li>
              )}
            </ul>
          )}

          <Link to={`/products?collection=${collection.id}`}>
            <Button size="lg">{t("home.viewCollection")}</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
