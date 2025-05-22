import { useState, useEffect } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
// This key is loaded from environment variables
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CheckoutFormProps {
  amount: number;
  onPaymentSuccess: (paymentIntent: any) => void;
  onPaymentError: (error: any) => void;
}

const CheckoutForm = ({
  amount,
  onPaymentSuccess,
  onPaymentError,
}: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded.
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
      onPaymentError(error);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onPaymentSuccess(paymentIntent);
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
            Obrada...
          </>
        ) : (
          "Plati"
        )}
      </Button>
    </form>
  );
};

interface StripePaymentFormProps {
  amount: number;
  onPaymentSuccess: (paymentIntent: any) => void;
  onPaymentError: (error: any) => void;
}

export default function StripePaymentForm({
  amount,
  onPaymentSuccess,
  onPaymentError,
}: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    // Create PaymentIntent as soon as the component loads
    const createPaymentIntent = async () => {
      try {
        const response = await apiRequest('POST', '/api/create-payment-intent', {
          amount: amount,
        });
        
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error('Error creating payment intent:', error);
        onPaymentError(error);
      }
    };

    createPaymentIntent();
  }, [amount, onPaymentError]);

  return (
    <div className="mt-4">
      {clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm 
            amount={amount} 
            onPaymentSuccess={onPaymentSuccess} 
            onPaymentError={onPaymentError} 
          />
        </Elements>
      ) : (
        <div className="flex justify-center py-4">
          <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}