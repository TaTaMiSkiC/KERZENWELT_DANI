import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ShoppingBag, Eye, Heart, Star, StarHalf } from "lucide-react";
import { Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import ProductViewModal from "@/components/product/ProductViewModal";
import { useLanguage } from "@/hooks/use-language";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { t, translateText } = useLanguage();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [isHovered, setIsHovered] = useState(false);
  const [productViewModalOpen, setProductViewModalOpen] = useState(false);

  // Prevedi naziv proizvoda i ostala tekstualna svojstva
  const { id, price, imageUrl = "", categoryId } = product;
  const name = translateText(product.name, "de");

  // Ovdje ćemo dohvatiti stvarne ocjene proizvoda (ako ih ima)
  const [reviews, setReviews] = useState<any[]>([]);
  const [hasReviews, setHasReviews] = useState(false);

  useEffect(() => {
    // U pravoj implementaciji, ovdje bismo dohvatili recenzije za ovaj proizvod
    // Za sada, podrazumijevamo da nema recenzija
    setHasReviews(false);
  }, [id]);

  const handleShowOptions = () => {
    setProductViewModalOpen(true);
  };

  return (
    <>
      <Card className="product-card overflow-hidden bg-card shadow-md">
        <div
          className="aspect-square overflow-hidden relative group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Link href={`/products/${id}`}>
            <img
              src={imageUrl || ""}
              alt={name}
              loading="lazy"
              decoding="async"
              width="300"
              height="300"
              className={`w-full h-full object-cover transition-transform duration-500 ${isHovered ? "scale-110" : ""}`}
            />
          </Link>

          {/* New or Sale tags */}
          {product.stock < 5 && (
            <div className="absolute top-3 left-3">
              <span className="bg-error text-white text-xs font-bold py-1 px-2 rounded">
                {translateText("ZADNJI KOMADI", "hr")}
              </span>
            </div>
          )}

          {/* Quick action buttons */}
          <div
            className={`absolute inset-0 bg-black/30 flex items-center justify-center gap-2 transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}
          >
            <Button
              size="icon"
              variant="secondary"
              className="bg-white text-primary hover:bg-primary hover:text-white rounded-full"
              asChild
            >
              <Link href={`/products/${id}`}>
                <Eye size={18} />
              </Link>
            </Button>

            <Button
              size="icon"
              variant="secondary"
              className="bg-white text-primary hover:bg-primary hover:text-white rounded-full"
              onClick={handleShowOptions}
            >
              <ShoppingBag size={18} />
            </Button>

            <Button
              size="icon"
              variant="secondary"
              className="bg-white text-primary hover:bg-primary hover:text-white rounded-full"
            >
              <Heart size={18} />
            </Button>
          </div>
        </div>

        <CardContent className="p-4">
          <Link href={`/products/${id}`}>
            <h3 className="heading text-lg font-semibold mb-1 hover:text-primary transition-colors cursor-pointer">
              {name}
            </h3>
          </Link>

          <div className="text-sm text-muted-foreground mb-2">
            {/* {categoryId === 1 ? translateText("Mirisna svijeća", "hr") : 
           categoryId === 2 ? translateText("Dekorativna svijeća", "hr") : 
           categoryId === 3 ? translateText("Personalizirana svijeća", "hr") : translateText("Svijeća", "hr")} */}
          </div>

          {/* Prikazujemo ocjene samo ako proizvod stvarno ima ocjene */}
          {hasReviews && (
            <div className="flex items-center mb-3">
              <div className="flex text-warning">
                <Star className="fill-current" size={14} />
                <Star className="fill-current" size={14} />
                <Star className="fill-current" size={14} />
                <Star className="fill-current" size={14} />
                <Star className="fill-current" size={14} />
              </div>
              <span className="text-xs text-muted-foreground ml-1">
                ({reviews.length})
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="font-accent font-medium text-primary">
              {parseFloat(price).toFixed(2)} €
            </span>
            <Button
              size="sm"
              onClick={handleShowOptions}
              className="text-sm bg-primary hover:bg-opacity-90 text-white py-1 px-3 rounded transition"
            >
              {translateText("Odaberi opcije", "hr")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modalni prozor za odabir opcija proizvoda */}
      {product && (
        <ProductViewModal
          isOpen={productViewModalOpen}
          onClose={() => setProductViewModalOpen(false)}
          product={product}
        />
      )}
    </>
  );
}
