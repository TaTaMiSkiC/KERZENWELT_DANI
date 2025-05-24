import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CreditCard, Wallet, BanknoteIcon, CreditCardIcon } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

interface PaymentSetting {
  id: number;
  key: string;
  value: string;
  description: string;
  category: string;
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  
  // Dohvati postavke načina plaćanja
  const { data: paymentSettings, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/settings/payment'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/settings/payment");
      const data = await response.json();
      return data as PaymentSetting[];
    }
  });
  
  const [localSettings, setLocalSettings] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    if (paymentSettings) {
      const settingsObj: Record<string, boolean> = {};
      paymentSettings.forEach(setting => {
        settingsObj[setting.key] = setting.value === "true";
      });
      setLocalSettings(settingsObj);
    }
  }, [paymentSettings]);
  
  const handleToggleChange = async (key: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;
      setLocalSettings(prev => ({ ...prev, [key]: newValue }));
      
      await apiRequest("PUT", `/api/settings/${key}`, {
        value: newValue.toString()
      });
      
      toast({
        title: t("admin.settings.updateSuccess") || "Postavke ažurirane",
        description: t("admin.settings.changesSaved") || "Promjene su uspješno spremljene",
      });
    } catch (error) {
      console.error("Greška pri ažuriranju postavki:", error);
      toast({
        title: t("admin.settings.updateError") || "Greška",
        description: t("admin.settings.changesNotSaved") || "Promjene nisu spremljene",
        variant: "destructive"
      });
      
      // Vrati lokalnu vrijednost natrag
      setLocalSettings(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };
  
  // Testiranje Stripe plaćanja iz admin panela
  const handleTestStripePayment = async () => {
    try {
      // Kreiraj test session direktno kroz API
      const response = await apiRequest("POST", "/api/create-test-session", {});
      const data = await response.json();
      
      if (data && data.url) {
        // Otvori Stripe checkout dirketno
        window.location.href = data.url;
      } else {
        throw new Error("Nedostaje URL za Stripe test session");
      }
    } catch (error) {
      console.error("Greška pri testiranju Stripe plaćanja:", error);
      toast({
        title: "Greška",
        description: "Nije moguće pokrenuti testno plaćanje",
        variant: "destructive"
      });
    }
  };
  
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-4">Načini plaćanja</h1>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </AdminLayout>
    );
  }
  
  if (error) {
    return (
      <AdminLayout>
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-4">Načini plaćanja</h1>
          <p className="text-red-500">Greška pri učitavanju postavki plaćanja.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <>
      <Helmet>
        <title>Načini plaćanja | Admin Panel</title>
      </Helmet>
      
      <AdminLayout>
        <div className="container py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Načini plaćanja</h1>
              <p className="text-muted-foreground">Upravljajte dostupnim načinima plaćanja u trgovini</p>
            </div>
            <Button onClick={handleTestStripePayment}>
              Testiraj plaćanje
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stripe - Kreditna kartica */}
            <Card>
              <CardHeader className="flex flex-row items-center space-x-4">
                <CreditCard className="h-6 w-6" />
                <div>
                  <CardTitle>Kreditna kartica (Stripe)</CardTitle>
                  <CardDescription>Visa, MasterCard, American Express, itd.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="stripe-toggle">Omogućeno</Label>
                  <Switch 
                    id="stripe-toggle" 
                    checked={localSettings["payment_stripe_enabled"] || false}
                    onCheckedChange={() => handleToggleChange("payment_stripe_enabled", localSettings["payment_stripe_enabled"] || false)}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* PayPal */}
            <Card>
              <CardHeader className="flex flex-row items-center space-x-4">
                <Wallet className="h-6 w-6" />
                <div>
                  <CardTitle>PayPal</CardTitle>
                  <CardDescription>Brzo i sigurno plaćanje putem PayPal-a</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="paypal-toggle">Omogućeno</Label>
                  <Switch 
                    id="paypal-toggle" 
                    checked={localSettings["payment_paypal_enabled"] || false}
                    onCheckedChange={() => handleToggleChange("payment_paypal_enabled", localSettings["payment_paypal_enabled"] || false)}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Klarna */}
            <Card>
              <CardHeader className="flex flex-row items-center space-x-4">
                <CreditCardIcon className="h-6 w-6" />
                <div>
                  <CardTitle>Klarna</CardTitle>
                  <CardDescription>Platite kasnije putem Klarne</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="klarna-toggle">Omogućeno</Label>
                  <Switch 
                    id="klarna-toggle" 
                    checked={localSettings["payment_klarna_enabled"] || false}
                    onCheckedChange={() => handleToggleChange("payment_klarna_enabled", localSettings["payment_klarna_enabled"] || false)}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* EPS - Online Banking (Austrija) */}
            <Card>
              <CardHeader className="flex flex-row items-center space-x-4">
                <BanknoteIcon className="h-6 w-6" />
                <div>
                  <CardTitle>EPS / Online Banking</CardTitle>
                  <CardDescription>Online banking za austrijske banke</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="eps-toggle">Omogućeno</Label>
                  <Switch 
                    id="eps-toggle" 
                    checked={localSettings["payment_eps_enabled"] || false}
                    onCheckedChange={() => handleToggleChange("payment_eps_enabled", localSettings["payment_eps_enabled"] || false)}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Bankovna doznaka */}
            <Card>
              <CardHeader className="flex flex-row items-center space-x-4">
                <BanknoteIcon className="h-6 w-6" />
                <div>
                  <CardTitle>Bankovna doznaka</CardTitle>
                  <CardDescription>Plaćanje direktno na bankovni račun</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="bank-toggle">Omogućeno</Label>
                  <Switch 
                    id="bank-toggle" 
                    checked={localSettings["payment_bank_transfer_enabled"] || false}
                    onCheckedChange={() => handleToggleChange("payment_bank_transfer_enabled", localSettings["payment_bank_transfer_enabled"] || false)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}