import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from 'react-router-dom';

interface StripeBuyButtonProps {
  amount: number;
  userId?: number;
  language?: string;
}

const StripeBuyButton = ({ amount, userId, language }: StripeBuyButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  // Bestimmen der Sprache für die Checkout-Session
  const sessionLanguage = language || 'de';

  const handleStripeCheckout = async () => {
    setIsLoading(true);
    
    try {
      // Vorbereiten der URL-Parameter für die Erfolgs- und Abbruchseite
      const successUrl = new URL('/order-success-new', window.location.origin);
      successUrl.searchParams.append('lang', sessionLanguage);
      if (userId) successUrl.searchParams.append('userId', userId.toString());
      
      const cancelUrl = new URL('/checkout', window.location.origin);
      cancelUrl.searchParams.append('cancel', 'true');
      
      // Checkout-Session über unser Backend erstellen
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount.toString(),
          successUrl: successUrl.toString(),
          cancelUrl: cancelUrl.toString(),
          language: sessionLanguage
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Fehler bei der Zahlung: ${response.status}`);
      }
      
      const { sessionId, url } = await response.json();
      
      if (url) {
        // Zu Stripe umleiten
        window.location.href = url;
      } else {
        throw new Error('Keine Stripe Checkout URL erhalten');
      }
    } catch (error) {
      console.error('Fehler beim Erstellen der Stripe Session:', error);
      toast({
        title: "Zahlungsfehler",
        description: "Bei der Verarbeitung Ihrer Zahlung ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="stripe-buy-button-container">
      <button
        onClick={handleStripeCheckout}
        disabled={isLoading}
        className="w-full py-3 px-4 bg-[#635bff] hover:bg-[#544dff] text-white font-medium rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Verarbeitung...
          </span>
        ) : (
          `Mit Karte bezahlen (${amount.toFixed(2)} €)`
        )}
      </button>
      <div className="text-xs text-center mt-2 text-gray-500">
        Sicherer Bezahlvorgang über Stripe
      </div>
    </div>
  );
};

export default StripeBuyButton;