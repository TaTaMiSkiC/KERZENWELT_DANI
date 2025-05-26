import { useState, useEffect } from "react";
import { ShoppingBag, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Product, Scent, Color } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/use-cart";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import Image from "@/components/ui/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/hooks/use-language";

interface ProductViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export default function ProductViewModal({
  isOpen,
  onClose,
  product,
}: ProductViewModalProps) {
  const { toast } = useToast();
  const { addToCart } = useCart();
  const { t } = useLanguage();
  const [selectedScentId, setSelectedScentId] = useState<number | null>(null);
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null);
  const [selectedColorIds, setSelectedColorIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  // Fetch product scents
  const { data: productScents = [] } = useQuery<Scent[]>({
    queryKey: ["/api/products", product.id, "scents"],
    enabled: isOpen,
    // Ispravljeno - zahtjev mora biti potpun path sa /, inače Vite server pogrešno interpretira
    queryFn: async () => {
      const res = await fetch(`/api/products/${product.id}/scents`);
      if (!res.ok) throw new Error("Failed to fetch scents");
      return res.json();
    },
  });

  // Fetch product colors - uvijek dohvaćamo boje, neovisno o hasColorOptions
  const { data: productColors = [] } = useQuery<Color[]>({
    queryKey: ["/api/products", product.id, "colors"],
    enabled: isOpen, // Uklonjeno product.hasColorOptions, uvijek dohvaćamo boje
    // Ispravljeno - zahtjev mora biti potpun path sa /, inače Vite server pogrešno interpretira
    queryFn: async () => {
      const res = await fetch(`/api/products/${product.id}/colors`);
      if (!res.ok) throw new Error("Failed to fetch colors");
      return res.json();
    },
  });

  // Reset selections when modal is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedScentId(null);
      setSelectedColorId(null);
      setSelectedColorIds([]);
      setQuantity(1);
      setAddedToCart(false);
    }
  }, [isOpen]);

  // Isključivo se oslanjamo na postojanje boja, zanemarujemo hasColorOptions
  const isColorSelectionRequired = productColors && productColors.length > 0;
  const isScentSelectionRequired = productScents && productScents.length > 0;

  // Za debugging - logiraj podatke o mirisima
  useEffect(() => {
    if (isOpen) {
      console.log("ProductScents:", productScents);
      console.log("ProductColors:", productColors);
    }
  }, [isOpen, productScents, productColors]);

  // Check if all required options are selected
  // Check if the product allows multiple colors
  const useMultipleColorSelection =
    product.hasColorOptions && product.allowMultipleColors;

  // Validate if we can add to cart based on color selection type
  const isColorSelectionValid = useMultipleColorSelection
    ? !isColorSelectionRequired || selectedColorIds.length > 0
    : !isColorSelectionRequired || selectedColorId !== null;

  const canAddToCart =
    (!isScentSelectionRequired || selectedScentId !== null) &&
    isColorSelectionValid;

  const handleAddToCart = async () => {
    if (!canAddToCart) return;

    try {
      if (useMultipleColorSelection && selectedColorIds.length > 0) {
        // Ako je omogućen višestruki odabir boja, dodaj proizvod s više boja
        console.log("Dodajem proizvod s više boja u košaricu:", {
          productId: product.id,
          productName: product.name,
          quantity: quantity,
          scentId: selectedScentId,
          scentName: selectedScentId
            ? productScents.find((s) => s.id === selectedScentId)?.name
            : null,
          selectedColors: selectedColorIds.map((id) => ({
            id,
            name: productColors.find((c) => c.id === id)?.name,
          })),
        });

        // Pretvaramo sve odabrane boje u string za prikaz
        const colorNames = selectedColorIds
          .map((id) => productColors.find((c) => c.id === id)?.name)
          .filter(Boolean)
          .join(", ");

        // Pripremi podatke za dodavanje u košaricu s više boja
        const cartData = {
          productId: product.id,
          quantity: quantity,
          scentId: selectedScentId === null ? undefined : selectedScentId,
          colorId: undefined, // Ne koristimo pojedinačnu boju
          colorIds:
            selectedColorIds.length > 0
              ? JSON.stringify(selectedColorIds)
              : undefined, // Šaljemo listu ID-jeva boja kao JSON string
          colorName: colorNames, // Šaljemo spojene nazive boja
          hasMultipleColors: true, // Označavamo da koristimo višestruke boje
        };

        console.log(
          "Dodajem proizvod s višestrukim bojama u košaricu:",
          cartData,
        );

        await addToCart.mutateAsync(cartData);
      } else {
        // Standardni način dodavanja u košaricu s jednom bojom
        console.log("Dodajem proizvod u košaricu:", {
          productId: product.id,
          productName: product.name,
          quantity: quantity,
          scentId: selectedScentId,
          scentName: selectedScentId
            ? productScents.find((s) => s.id === selectedScentId)?.name
            : null,
          colorId: selectedColorId,
          colorName: selectedColorId
            ? productColors.find((c) => c.id === selectedColorId)?.name
            : null,
        });

        await addToCart.mutateAsync({
          productId: product.id,
          quantity: quantity,
          scentId: selectedScentId === null ? undefined : selectedScentId,
          colorId: selectedColorId === null ? undefined : selectedColorId,
        });
      }

      setAddedToCart(true);

      // Dohvati trenutnu košaricu nakon dodavanja
      try {
        await queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      } catch (invalidateError) {
        console.warn("Greška pri osvježavanju košarice:", invalidateError);
      }

      const selectedScentName = selectedScentId
        ? productScents.find((s) => s.id === selectedScentId)?.name
        : null;

      const selectedColorName = selectedColorId
        ? productColors.find((c) => c.id === selectedColorId)?.name
        : null;

      // Prikaži detaljniju poruku s mirisima i bojama
      let successMessage = `${product.name}`;
      if (selectedScentName || selectedColorName) {
        successMessage += " (";
        if (selectedScentName)
          successMessage += `${t("product.scent") || "Duft"}: ${selectedScentName}`;
        if (selectedScentName && selectedColorName) successMessage += ", ";
        if (selectedColorName)
          successMessage += `${t("product.color") || "Farbe"}: ${selectedColorName}`;
        successMessage += ")";
      }

      toast({
        title:
          t("product.addedToCartTitle") || "Produkt zum Warenkorb hinzugefügt",
        description: (
          t("product.addedToCartDesc") ||
          `{product} wurde erfolgreich zu Ihrem Warenkorb hinzugefügt.`
        ).replace("{product}", successMessage),
      });

      // Close the modal after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error(
        "Greška pri dodavanju u košaricu:",
        error instanceof Error ? error.message : "Nepoznata greška",
      );
      toast({
        title: t("product.errorTitle") || "Fehler",
        description:
          t("product.errorAddingToCart") ||
          "Das Hinzufügen zum Warenkorb ist fehlgeschlagen. Bitte versuchen Sie es erneut. Oder melden Sie sich an",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {t("product.selectOptions") || "Odaberite opcije"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-180px)] pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
            {/* Product image */}
            <div className="bg-card rounded-lg overflow-hidden">
              <Image
                src={product.imageUrl || "/placeholder.png"}
                alt={product.name}
                className="w-full h-[250px] object-cover"
              />
            </div>

            {/* Product info and options */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{product.name}</h3>
                <p className="text-primary text-xl font-bold">
                  {new Intl.NumberFormat("hr-HR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(parseFloat(product.price))}
                </p>
              </div>

              {/* Scent options */}
              {isScentSelectionRequired && (
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    {t("product.scent") || "Duft"}{" "}
                    <span className="text-destructive">*</span>
                  </h4>
                  <RadioGroup
                    value={selectedScentId?.toString()}
                    onValueChange={(value) =>
                      setSelectedScentId(parseInt(value))
                    }
                    className="grid grid-cols-1 gap-2"
                  >
                    {productScents.map((scent) => (
                      <div
                        key={scent.id}
                        className={`flex items-center border rounded-md p-2 transition-colors cursor-pointer
                          ${
                            selectedScentId === scent.id
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-input hover:border-primary/50 hover:bg-muted/30"
                          }`}
                        onClick={() => setSelectedScentId(scent.id)}
                      >
                        <RadioGroupItem
                          value={scent.id.toString()}
                          id={`modal-scent-${scent.id}`}
                          className="mr-2"
                        />
                        <Label
                          htmlFor={`modal-scent-${scent.id}`}
                          className="cursor-pointer flex-1 text-sm"
                        >
                          {scent.name}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* Color options */}
              {isColorSelectionRequired && (
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    {t("product.color") || "Farbe"}{" "}
                    <span className="text-destructive">*</span>
                    {useMultipleColorSelection && (
                      <span className="text-xs ml-1 text-muted-foreground">
                        {t("product.multipleColorsHint") ||
                          "(Sie können mehr auswählen)"}
                      </span>
                    )}
                  </h4>

                  {useMultipleColorSelection ? (
                    // Prikaz za višestruki odabir boja
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2">
                      {productColors.map((color) => {
                        const isSelected = selectedColorIds.includes(color.id);
                        return (
                          <div
                            key={color.id}
                            className={`flex items-center border rounded-md p-2 transition-colors cursor-pointer
                              ${
                                isSelected
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-input hover:border-primary/50 hover:bg-muted/30"
                              }`}
                            onClick={() => {
                              if (isSelected) {
                                // Ukloni boju iz odabira
                                setSelectedColorIds((prev) =>
                                  prev.filter((id) => id !== color.id),
                                );
                              } else {
                                // Dodaj boju u odabir
                                setSelectedColorIds((prev) => [
                                  ...prev,
                                  color.id,
                                ]);
                              }
                            }}
                          >
                            <div className="flex items-center justify-center w-5 h-5 mr-2">
                              <div
                                className={`w-4 h-4 rounded-full border border-muted`}
                                style={{ backgroundColor: color.hexValue }}
                              ></div>
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 absolute text-primary" />
                              )}
                            </div>
                            <span className="text-xs">{color.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Standardni prikaz za odabir jedne boje
                    <RadioGroup
                      value={selectedColorId?.toString()}
                      onValueChange={(value) =>
                        setSelectedColorId(parseInt(value))
                      }
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2"
                    >
                      {productColors.map((color) => (
                        <div
                          key={color.id}
                          className={`flex items-center border rounded-md p-2 transition-colors cursor-pointer
                            ${
                              selectedColorId === color.id
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-input hover:border-primary/50 hover:bg-muted/30"
                            }`}
                          onClick={() => setSelectedColorId(color.id)}
                        >
                          <div
                            className={`w-5 h-5 mr-2 rounded-full border ${selectedColorId === color.id ? "border-primary" : "border-muted"}`}
                            style={{ backgroundColor: color.hexValue }}
                          ></div>
                          <RadioGroupItem
                            value={color.id.toString()}
                            id={`modal-color-${color.id}`}
                            className="sr-only"
                          />
                          <Label
                            htmlFor={`modal-color-${color.id}`}
                            className="cursor-pointer text-xs"
                          >
                            {color.name}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </div>
              )}

              {/* Quantity */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t("product.quantity") || "Menge"}
                </h4>
                <div className="flex items-center border border-input rounded-md w-[120px]">
                  <button
                    type="button"
                    className="w-10 h-10 flex items-center justify-center bg-muted hover:bg-muted/80 transition"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <span className="sr-only">
                      {t("product.decrease") || "Reduzieren Sie es"}
                    </span>
                    <span className="font-medium">-</span>
                  </button>
                  <input
                    type="number"
                    className="w-12 h-10 text-center border-x border-input focus:outline-none focus:ring-0 bg-transparent"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0 && val <= product.stock) {
                        setQuantity(val);
                      }
                    }}
                    min={1}
                    max={product.stock}
                  />
                  <button
                    type="button"
                    className="w-10 h-10 flex items-center justify-center bg-muted hover:bg-muted/80 transition"
                    onClick={() =>
                      setQuantity(Math.min(product.stock, quantity + 1))
                    }
                    disabled={quantity >= product.stock}
                  >
                    <span className="sr-only">
                      {t("product.increase") || "Vergröseren Sie es"}
                    </span>
                    <span className="font-medium">+</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="sm:justify-start mt-4">
          {addedToCart ? (
            <Button
              className="w-full py-6 text-base"
              variant="default"
              disabled
            >
              <CheckCircle size={20} className="mr-2" />
              {t("cart.addedToCart") || "Zum Warenkorb hinzugefügt"}
            </Button>
          ) : (
            <Button
              className="w-full py-6 text-base font-medium"
              onClick={handleAddToCart}
              disabled={!canAddToCart || addToCart.isPending}
            >
              <ShoppingBag size={20} className="mr-2" />
              {addToCart.isPending
                ? t("cart.adding") || "Hinzufügen..."
                : t("cart.addToCart") ||
                  "Fügen Sie es zu Ihrem Warenkorb hinzu"}
            </Button>
          )}
          {!canAddToCart && !addedToCart && (
            <p className="text-xs text-destructive text-center w-full mt-2">
              {t("product.selectRequiredOptions") ||
                "Molimo odaberite sve obavezne opcije prije dodavanja u košaricu"}
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
