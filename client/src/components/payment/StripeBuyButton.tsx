import { useEffect, useRef } from 'react';

interface StripeBuyButtonProps {
  buyButtonId: string;
  publishableKey: string;
  amount: number;
}

const StripeBuyButton = ({ buyButtonId, publishableKey, amount }: StripeBuyButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Load the Stripe Buy Button script
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/buy-button.js';
    script.async = true;
    document.body.appendChild(script);
    
    // Once the script is loaded, create the button
    script.onload = () => {
      if (containerRef.current && window.customElements && window.customElements.get('stripe-buy-button')) {
        // Clear the container first
        containerRef.current.innerHTML = '';
        
        // Create a direct link to Stripe checkout with the correct amount
        const stripeButtonLink = document.createElement('a');
        stripeButtonLink.href = `https://buy.stripe.com/6oUcMX9ruazGaBr92v?amount=${Math.round(amount * 100)}&currency=eur&locale=de`;
        stripeButtonLink.className = "stripe-button-link";
        stripeButtonLink.target = "_blank";
        
        // Create a styled button that looks like a Stripe button
        const button = document.createElement('button');
        button.className = "w-full py-3 px-4 bg-[#635bff] hover:bg-[#544dff] text-white font-medium rounded-md transition-colors";
        button.innerHTML = `Mit Karte bezahlen (${amount.toFixed(2)} €)`;
        
        stripeButtonLink.appendChild(button);
        containerRef.current.appendChild(stripeButtonLink);
        
        // Add a note about secure checkout
        const secureNote = document.createElement('div');
        secureNote.className = "text-xs text-center mt-2 text-gray-500";
        secureNote.innerHTML = "Sicherer Bezahlvorgang über Stripe";
        containerRef.current.appendChild(secureNote);
      }
    };
    
    return () => {
      // Clean up
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [buyButtonId, publishableKey, amount]);
  
  return <div ref={containerRef} className="stripe-buy-button-container"></div>;
};

export default StripeBuyButton;