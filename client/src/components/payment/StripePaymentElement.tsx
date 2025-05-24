import React, { useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { LoaderCircle, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface StripeCheckoutFormProps {
  onSuccess: (paymentIntent: any) => void;
  onError: (error: any) => void;
}

const StripeCheckoutForm = ({ onSuccess, onError }: StripeCheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const { t } = useLanguage();
  const orderId = window.sessionStorage.getItem('currentOrderId');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message);
      onError(error);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      {errorMessage && (
        <div className="text-red-500 text-sm mt-2">{errorMessage}</div>
      )}
      
      <Button 
        type="submit" 
        disabled={!stripe || isLoading} 
        className="w-full"
      >
        {isLoading ? (
          <>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            {t('checkout.processing')}
          </>
        ) : (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            {t('checkout.pay')}
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
  onError 
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