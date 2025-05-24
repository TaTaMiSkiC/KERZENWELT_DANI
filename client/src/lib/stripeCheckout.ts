import { apiRequest } from "./queryClient";

/**
 * Pokreće Stripe Checkout proces s točnim iznosom
 * @param amount - Iznos koji treba platiti (u eurima)
 * @param paymentMethod - Odabrana metoda plaćanja
 * @param orderId - ID narudžbe ako postoji
 * @returns Promise koji se rješava kad korisnik bude preusmjeren na Stripe Checkout
 */
export async function initiateStripeCheckout(
  amount: number, 
  paymentMethod: string = "stripe", 
  orderId?: number
): Promise<void> {
  try {
    // Trenutna lokacija za URL za povratak
    const origin = window.location.origin;
    
    // Mapiranje metoda plaćanja prema Stripe formatima
    const paymentMethodMapping: Record<string, string> = {
      stripe: "card",
      paypal: "paypal",
      klarna: "klarna",
      eps: "eps",
      sofort: "sofort"
    };
    
    // Dobivamo stripe-ov id metode plaćanja (card, paypal, klarna, itd.)
    const stripePaymentMethod = paymentMethodMapping[paymentMethod] || "card";
    
    // Kreiraj Checkout sesiju
    const response = await apiRequest("POST", "/api/create-checkout-session", {
      amount,
      orderId,
      paymentMethod: stripePaymentMethod, // Dodajemo metodu plaćanja za Stripe
      successUrl: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout?canceled=true`,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Greška pri kreiranju checkout sesije");
    }
    
    const { url } = await response.json();
    
    // Preusmjeri korisnika na Stripe Checkout
    if (url) {
      window.location.href = url;
    } else {
      throw new Error("Nije dobiven URL za Stripe Checkout");
    }
  } catch (error) {
    console.error("Greška pri pokretanju Stripe Checkout-a:", error);
    throw error;
  }
}