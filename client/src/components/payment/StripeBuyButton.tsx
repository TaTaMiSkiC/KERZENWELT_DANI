import { useEffect, useRef } from 'react';

interface StripeBuyButtonProps {
  buyButtonId: string;
  publishableKey: string;
}

const StripeBuyButton = ({ buyButtonId, publishableKey }: StripeBuyButtonProps) => {
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
        
        // Create the button element
        const button = document.createElement('stripe-buy-button');
        button.setAttribute('buy-button-id', buyButtonId);
        button.setAttribute('publishable-key', publishableKey);
        
        // Add the button to the container
        containerRef.current.appendChild(button);
      }
    };
    
    return () => {
      // Clean up
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [buyButtonId, publishableKey]);
  
  return <div ref={containerRef} className="stripe-buy-button-container"></div>;
};

export default StripeBuyButton;