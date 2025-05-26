import { useState, useEffect } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { CartItemWithProduct, SelectedColorInfo } from "@shared/schema";
import { useCart } from "@/hooks/use-cart";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface CartItemProps {
  item: CartItemWithProduct;
}

export default function CartItem({ item }: CartItemProps) {
  const { updateCartItem, removeFromCart } = useCart();
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState(item.quantity);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const { id, product, scentId, colorId } = item;
  const { name, price, imageUrl, stock } = product;
  
  // Debug logging
  useEffect(() => {
    console.log("Cart item details:", {
      id,
      productId: product.id,
      productName: product.name,
      scentId: item.scentId,
      scentInfo: item.scent,
      colorId: item.colorId,
      colorInfo: item.color,
      hasMultipleColors: item.hasMultipleColors,
      selectedColors: item.selectedColors
    });
  }, [id, product, item.scentId, item.scent, item.colorId, item.color, item.hasMultipleColors, item.selectedColors]);
  
  // Format price
  const formattedPrice = parseFloat(price).toFixed(2);
  const totalPrice = (parseFloat(price) * quantity).toFixed(2);
  
  // Handle quantity change
  const handleQuantityChange = (value: number) => {
    if (value < 1 || value > stock) return;
    
    setQuantity(value);
    setIsUpdating(true);
    
    // Debounce the API call to avoid multiple requests
    const timer = setTimeout(() => {
      updateCartItem.mutate(
        { id, quantity: value },
        {
          onSettled: () => {
            setIsUpdating(false);
          },
        }
      );
    }, 500);
    
    return () => clearTimeout(timer);
  };
  
  const handleIncrement = () => {
    if (quantity < stock) {
      handleQuantityChange(quantity + 1);
    }
  };
  
  const handleDecrement = () => {
    if (quantity > 1) {
      handleQuantityChange(quantity - 1);
    }
  };
  
  const handleRemove = () => {
    removeFromCart.mutate(id);
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 border-b">
      <div className="flex items-center flex-1">
        <div className="w-16 h-16 mr-4 rounded overflow-hidden">
          <img
            src={item.product.imageUrl}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <Link href={`/products/${product.id}`}>
            <h3 className="font-medium text-text-dark hover:text-primary transition cursor-pointer">
              {name}
              {/* Dodaj miris i boju u naslov proizvoda */}
              {(item.scent || item.color || (item.hasMultipleColors && item.selectedColors?.length)) && (
                <span className="text-muted-foreground ml-1">
                  {item.hasMultipleColors && item.selectedColors && item.selectedColors.length > 0 ? (
                    `(${item.scent?.name ? `${item.scent.name}, ` : ''}${item.selectedColors.length} ${item.selectedColors.length > 1 ? 'boje' : 'boja'})`
                  ) : (
                    item.scent && item.color 
                      ? `(${item.scent.name}, ${item.color.name})`
                      : item.scent 
                        ? `(${item.scent.name})` 
                        : item.color ? `(${item.color.name})` : ''
                  )}
                </span>
              )}
            </h3>
          </Link>
          <p className="text-sm text-gray-500">
            {stock > 10 ? (
              <span className="text-success">{t('cart.inStock')}</span>
            ) : (
              <span className="text-warning">Dostupno: {stock} kom</span>
            )}
          </p>
          
          {/* Detaljni prikaz odabranog mirisa i boje u zasebnom bloku */}
          {(item.scent || item.color || (item.hasMultipleColors && item.selectedColors?.length)) && (
            <div className="mt-1 p-1.5 bg-muted/40 rounded-md text-xs">
              {item.scent && (
                <p className="text-muted-foreground">
                  <span className="font-medium">{t('cart.scent')}</span> {item.scent.name}
                </p>
              )}
              
              {/* Prikaz jedne odabrane boje */}
              {item.color && !item.hasMultipleColors && (
                <div className="flex items-center mt-1">
                  <span className="font-medium mr-1">{t('product.selectColor')}:</span>
                  {item.color.hexValue ? (
                    <div 
                      className="w-3 h-3 rounded-full mr-1 border"
                      style={{ backgroundColor: item.color.hexValue }}
                    ></div>
                  ) : (
                    <div 
                      className="w-3 h-3 rounded-full mr-1 border bg-gray-300"
                    ></div>
                  )}
                  <span>{item.color.name}</span>
                </div>
              )}
              
              {/* Prikaz višestruko odabranih boja */}
              {(() => {
                // Uklonimo dodatni log jer opterećuje konzolu
                if (item.hasMultipleColors && item.selectedColors && item.selectedColors.length > 0) {
                  return (
                    <div className="mt-1">
                      <span className="font-medium mr-1">{t('cart.colors')}:</span>
                      <div className="flex flex-wrap gap-2 items-center mt-1">
                        {item.selectedColors.map((color, index) => (
                          <div key={`color-${color.id}`} className="inline-flex items-center">
                            {color.hexValue ? (
                              <div 
                                className="w-3 h-3 rounded-full mr-1 border"
                                style={{ backgroundColor: color.hexValue }}
                              ></div>
                            ) : (
                              <div 
                                className="w-3 h-3 rounded-full mr-1 border bg-gray-300"
                              ></div>
                            )}
                            <span>{color.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } else if (item.hasMultipleColors && item.colorName) {
                  // Fallback - ako nemamo selectedColors objekte, ali imamo colorName
                  return (
                    <div className="mt-1">
                      <span className="font-medium mr-1">{t('cart.colors')}:</span> {item.colorName}
                    </div>
                  );
                }
                
                return null;
              })()}
            </div>
          )}
          
          <p className="text-sm font-medium text-primary mt-1">
            {formattedPrice} €
          </p>
        </div>
      </div>
      
      <div className="flex items-center space-x-4 mt-4 sm:mt-0">
        <div className="flex items-center border rounded-md overflow-hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0 rounded-none"
            onClick={handleDecrement}
            disabled={quantity <= 1 || isUpdating}
          >
            <Minus size={14} />
          </Button>
          
          <input
            type="number"
            min="1"
            max={stock}
            className="w-12 text-center border-none focus:ring-0 text-sm h-8 px-0"
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) {
                handleQuantityChange(val);
              }
            }}
          />
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0 rounded-none"
            onClick={handleIncrement}
            disabled={quantity >= stock || isUpdating}
          >
            <Plus size={14} />
          </Button>
        </div>
        
        <div className="w-24 text-right font-medium">
          {isUpdating ? (
            <span className="text-sm text-gray-400">{t('cart.clearing')}</span>
          ) : (
            <span>{totalPrice} €</span>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-destructive"
          onClick={handleRemove}
          disabled={removeFromCart.isPending}
        >
          <Trash2 size={18} />
        </Button>
      </div>
    </div>
  );
}
