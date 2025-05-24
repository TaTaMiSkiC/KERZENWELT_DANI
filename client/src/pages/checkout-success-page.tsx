import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout/Layout";
import { CheckCircle } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";

// Kreiramo jednostavnu Spinner komponentu
const Spinner = ({ className = "" }: { className?: string }) => (
  <div className={`animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full ${className}`} />
);

export default function CheckoutSuccessPage() {
  const [_, setLocation] = useLocation();
  const { user } = useAuth();
  const { clearCart } = useCart();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dohvati session_id iz URL-a
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Ako nemamo session_id ili korisnik nije prijavljen, ne možemo obraditi narudžbu
    if (!sessionId || !user) {
      setError("Podaci o plaćanju ili korisniku nisu dostupni.");
      setLoading(false);
      return;
    }
    
    // Ovdje ćemo obraditi uspješno plaćanje i kreirati narudžbu
    const processPayment = async () => {
      try {
        // Pozovi backend da završi narudžbu i zabilježi plaćanje
        const response = await fetch("/api/process-stripe-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: sessionId }),
        });
        
        if (!response.ok) {
          throw new Error("Greška pri obradi plaćanja.");
        }
        
        const data = await response.json();
        
        // Očisti košaricu nakon uspješne narudžbe
        clearCart();
        
        // Prikaži poruku o uspjehu
        toast({
          title: "Plaćanje uspješno",
          description: "Vaša narudžba je uspješno kreirana i plaćena."
        });
        
        // Preusmjeri korisnika na stranicu s detaljima narudžbe
        setLocation(`/order-success?orderId=${data.orderId}`);
      } catch (err) {
        console.error("Greška pri obradi plaćanja:", err);
        setError("Došlo je do greške pri obradi vašeg plaćanja. Molimo kontaktirajte podršku.");
        setLoading(false);
      }
    };
    
    processPayment();
  }, [sessionId, user, setLocation, clearCart, toast]);
  
  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-8 text-center">
          <div className="max-w-md mx-auto bg-card p-8 rounded-lg shadow-md">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">Obrađujemo vaše plaćanje</h1>
            <p className="text-muted-foreground mb-6">
              Molimo pričekajte dok obradimo vašu narudžbu...
            </p>
            <Spinner className="mx-auto" />
          </div>
        </div>
      </Layout>
    );
  }
  
  if (error) {
    return (
      <Layout>
        <div className="container mx-auto p-8 text-center">
          <div className="max-w-md mx-auto bg-card p-8 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-4">Došlo je do greške</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <p className="text-sm text-muted-foreground">
              Ako ste već platili, a narudžba nije zabilježena, molimo kontaktirajte našu podršku.
            </p>
          </div>
        </div>
      </Layout>
    );
  }
  
  // Ako dođemo ovdje, vjerojatno se još uvijek učitava ili preusmjerava
  return (
    <Layout>
      <div className="container mx-auto p-8 text-center">
        <div className="max-w-md mx-auto bg-card p-8 rounded-lg shadow-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Hvala na vašoj narudžbi!</h1>
          <p className="text-muted-foreground mb-6">
            Preusmjeravamo vas na stranicu s detaljima narudžbe...
          </p>
          <Spinner className="mx-auto" />
        </div>
      </div>
    </Layout>
  );
}