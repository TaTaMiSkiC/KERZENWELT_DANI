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
  orderId?: number,
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
    };

    // Dobivamo stripe-ov id metode plaćanja (card, paypal, klarna, itd.)
    const stripePaymentMethod = paymentMethodMapping[paymentMethod] || "card";

    // Dohvaćamo podatke o korisniku
    let userId = undefined;
    try {
      const userResponse = await apiRequest("GET", "/api/user");
      if (userResponse.ok) {
        const userData = await userResponse.json();
        userId = userData.id;
      }
    } catch (error) {
      console.warn("Nije moguće dohvatiti podatke o korisniku:", error);
    }

    // Kreiraj Checkout sesiju
    // Dohvaćamo trenutni odabrani jezik
    const currentLanguage = document.documentElement.lang || 'de';
    
    const response = await apiRequest("POST", "/api/create-checkout-session", {
      amount,
      orderId,
      userId, // Dodajemo ID korisnika za praćenje
      language: currentLanguage, // Dodajemo informaciju o jeziku
      paymentMethod: stripePaymentMethod, // Dodajemo metodu plaćanja za Stripe
      // Wir stellen sicher, dass alle wichtigen Parameter in der Erfolgs-URL enthalten sind
      successUrl: `${origin}/order-success-new?session_id={CHECKOUT_SESSION_ID}&user_id=${userId || ''}&lang=${currentLanguage || 'de'}&email={CUSTOMER_EMAIL}`,
      cancelUrl: `${origin}/checkout?canceled=true`,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || "Greška pri kreiranju checkout sesije",
      );
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
