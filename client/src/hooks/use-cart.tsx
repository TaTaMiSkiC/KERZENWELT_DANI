import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { CartItemWithProduct, InsertCartItem } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "./use-auth";

type CartContextType = {
  cartItems: CartItemWithProduct[] | null;
  isLoading: boolean;
  error: Error | null;
  cartTotal: number;
  cartItemCount: number;
  addToCart: UseMutationResult<
    any,
    Error,
    {
      productId: number;
      quantity: number;
      scentId?: number;
      colorId?: number;
    }
  >;
  updateCartItem: UseMutationResult<
    any,
    Error,
    { id: number; quantity: number }
  >;
  removeFromCart: UseMutationResult<any, Error, number>;
  clearCart: UseMutationResult<any, Error, void>;
};

export const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user } = useAuth();

  const {
    data: cartItems,
    error,
    isLoading,
  } = useQuery<CartItemWithProduct[], Error>({
    queryKey: ["/api/cart"],
    enabled: !!user,
    onSuccess: (data) => {
      // Dodatno logiranje kada su podaci košarice uspješno dohvaćeni
      console.log("Dohvaćeni podaci košarice:", data);

      // Provjeri sadrže li stavke košarice potrebne informacije o mirisima i bojama
      if (data && data.length > 0) {
        data.forEach((item) => {
          console.log(`Stavka košarice ID ${item.id}:`, {
            productId: item.productId,
            productName: item.product?.name,
            scentId: item.scentId,
            scentInfo: item.scent,
            colorId: item.colorId,
            colorInfo: item.color,
            hasMultipleColors: item.hasMultipleColors,
            selectedColors: item.selectedColors,
            colorIds: item.colorIds,
          });
        });
      }
    },
  });

  const cartTotal =
    cartItems?.reduce(
      (total, item) => total + parseFloat(item.product.price) * item.quantity,
      0,
    ) || 0;

  const cartItemCount =
    cartItems?.reduce((count, item) => count + item.quantity, 0) || 0;

  const addToCart = useMutation({
    mutationFn: async (data: {
      productId: number;
      quantity: number;
      scentId?: number;
      colorId?: number;
    }) => {
      const res = await apiRequest("POST", "/api/cart", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description:
          error.message ||
          "Produkt konnte nicht zum Warenkorb hinzugefügt werden.",
        variant: "destructive",
      });
    },
  });

  const updateCartItem = useMutation({
    mutationFn: async (data: { id: number; quantity: number }) => {
      const res = await apiRequest("PUT", `/api/cart/${data.id}`, {
        quantity: data.quantity,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description:
          error.message ||
          "Produkt im Warenkorb kann nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const removeFromCart = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cart/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Aus dem Warenkorb entfernt",
        description: "Das Produkt wurde aus Ihrem Warenkorb entfernt.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description:
          error.message ||
          "Produkt kann nicht aus dem Warenkorb entfernt werden.",
        variant: "destructive",
      });
    },
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/cart");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Warenkorb geleert",
        description: "Alle Produkte wurden aus Ihrem Warenkorb entfernt.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description:
          error.message || "Einkaufswagen kann nicht geleert werden.",
        variant: "destructive",
      });
    },
  });

  return (
    <CartContext.Provider
      value={{
        cartItems: cartItems || null,
        isLoading,
        error,
        cartTotal,
        cartItemCount,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
