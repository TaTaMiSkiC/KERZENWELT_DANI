import React, { useState } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { LoaderCircle, CheckCircle } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface StripeCheckoutFormProps {
  onSuccess: (paymentIntent: any) => void;
  onError: (error: any) => void;
}

const StripeCheckoutForm = ({
  onSuccess,
  onError,
}: StripeCheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const { t } = useLanguage();
  const orderId = window.sessionStorage.getItem("currentOrderId");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      // 1. Potvrdi plaćanje
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-success`,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("Stripe error:", error);
        setErrorMessage(error.message);
        onError(error);
        setIsLoading(false);
        return;
      }

      // 2. Uspješno plaćanje
      if (paymentIntent && paymentIntent.status === "succeeded") {
        console.log("Plaćanje uspjelo:", paymentIntent);

        // 3. Učitaj podatke o narudžbi iz sessionStorage
        const pendingData = window.sessionStorage.getItem("pendingOrderData");

        if (!pendingData) {
          console.error("Nema spremljenih podataka o narudžbi.");
          setErrorMessage("Podaci o narudžbi nisu pronađeni.");
          setIsLoading(false);
          return;
        }

        const parsedOrder = JSON.parse(pendingData);

        // 4. Pošalji narudžbu na backend
        const response = await fetch("/api/process-stripe-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: paymentIntent.id,
            orderData: parsedOrder,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.orderId) {
          throw new Error("Neuspjelo spremanje narudžbe.");
        }

        // 5. Očisti podatke
        window.sessionStorage.removeItem("pendingOrderData");
        window.sessionStorage.removeItem("currentOrderId");

        // 6. Osvježi košaricu
        const { queryClient } = await import("@/lib/queryClient");
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });

        // 7. Preusmjeri na potvrdu
        window.location.href = `/order-success?orderId=${result.orderId}`;
      }
    } catch (err) {
      console.error("Greška:", err);
      setErrorMessage("Dogodila se greška pri plaćanju.");
      onError(err);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: "tabs",
          defaultValues: {
            billingDetails: {
              name: "Kerzenwelt by Dani Kunde",
            },
          },
        }}
      />

      {errorMessage && (
        <div className="text-red-500 text-sm mt-2">{errorMessage}</div>
      )}

      <Button type="submit" disabled={!stripe || isLoading} className="w-full">
        {isLoading ? (
          <>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            {t("checkout.processing")}
          </>
        ) : (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            {t("checkout.pay")}
          </>
        )}
      </Button>
    </form>
  );
};

interface StripePaymentElementProps {
  clientSecret: string;
  onSuccess: (paymentIntent: any) => void;
  onError: (error: any) => void;
}

export default function StripePaymentElement({
  clientSecret,
  onSuccess,
  onError,
}: StripePaymentElementProps) {
  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center p-4">
        <LoaderCircle className="animate-spin h-6 w-6 text-primary" />
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeCheckoutForm onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
}
