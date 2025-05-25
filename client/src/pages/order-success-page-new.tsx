import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Package,
  Clock,
  ArrowRight,
  ShoppingBag,
  AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/hooks/use-language";

export default function OrderSuccessPageNew() {
  const [location] = useLocation();
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { language } = useLanguage();
  
  // Extract parameters from URL
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const orderId = searchParams.get("orderId");
  const sessionId = searchParams.get("session_id");
  const userId = searchParams.get("user_id");
  const urlLang = searchParams.get("lang");
  
  // Ako jezik dolazi iz URL-a, možemo ga koristiti umjesto trenutnog jezika
  // Ovo omogućuje da korisnik dobije stranicu na istom jeziku koji je koristio prilikom plaćanja
  useEffect(() => {
    if (urlLang && ['de', 'en', 'hr', 'it'].includes(urlLang)) {
      // Ovdje bismo mogli postaviti jezik, ali za sada samo logiramo
      console.log(`Jezik iz URL-a: ${urlLang}`);
    }
  }, [urlLang]);

  console.log("URL parametri:", { orderId, sessionId, userId, urlLang, language, location });
  
  // Višejezični tekstovi
  const translations = {
    pageTitle: {
      de: "Bestellung erfolgreich | Kerzenwelt by Dani",
      en: "Order Successful | Kerzenwelt by Dani",
      hr: "Narudžba uspješna | Kerzenwelt by Dani",
      it: "Ordine riuscito | Kerzenwelt by Dani"
    },
    pageDescription: {
      de: "Ihre Bestellung wurde erfolgreich aufgenommen.",
      en: "Your order has been successfully received.",
      hr: "Vaša narudžba je uspješno zaprimljena.",
      it: "Il tuo ordine è stato ricevuto con successo."
    },
    loading: {
      de: "Wir verarbeiten Ihre Bestellung...",
      en: "We are processing your order...",
      hr: "Obrađujemo Vašu narudžbu...",
      it: "Stiamo elaborando il tuo ordine..."
    },
    waitMessage: {
      de: "Bitte warten Sie, während wir Ihre Zahlung verarbeiten und Ihre Bestellung vorbereiten.",
      en: "Please wait while we process your payment and prepare your order.",
      hr: "Molimo pričekajte dok obradimo Vaše plaćanje i pripremimo narudžbu.",
      it: "Attendere mentre elaboriamo il pagamento e prepariamo l'ordine."
    },
    errorTitle: {
      de: "Fehler bei der Bearbeitung der Bestellung",
      en: "Error processing order",
      hr: "Greška pri obradi narudžbe",
      it: "Errore durante l'elaborazione dell'ordine"
    },
    orderNotFound: {
      de: "Bestellung nicht gefunden",
      en: "Order not found",
      hr: "Narudžba nije pronađena",
      it: "Ordine non trovato"
    },
    orderNotFoundDesc: {
      de: "Wir konnten keine Informationen zu Ihrer Bestellung finden.",
      en: "We could not find information about your order.",
      hr: "Nismo mogli pronaći informacije o vašoj narudžbi.",
      it: "Non abbiamo potuto trovare informazioni sul tuo ordine."
    },
    browseProducts: {
      de: "Produkte durchsuchen",
      en: "Browse products",
      hr: "Pregledajte proizvode",
      it: "Sfoglia i prodotti"
    },
    orderSuccessTitle: {
      de: "Bestellung erfolgreich aufgenommen!",
      en: "Order successfully received!",
      hr: "Narudžba uspješno zaprimljena!",
      it: "Ordine ricevuto con successo!"
    },
    thankYouMessage: {
      de: "Vielen Dank für Ihre Bestellung. Wir haben eine Bestätigung an Ihre E-Mail-Adresse gesendet.",
      en: "Thank you for your order. We have sent a confirmation to your email address.",
      hr: "Hvala vam na vašoj narudžbi. Poslali smo potvrdu na vašu email adresu.",
      it: "Grazie per il tuo ordine. Abbiamo inviato una conferma al tuo indirizzo email."
    },
    orderDetails: {
      de: "Bestelldetails",
      en: "Order details",
      hr: "Detalji narudžbe",
      it: "Dettagli dell'ordine"
    },
    orderNumber: {
      de: "Bestellnummer",
      en: "Order number",
      hr: "Broj narudžbe",
      it: "Numero d'ordine"
    },
    date: {
      de: "Datum",
      en: "Date",
      hr: "Datum",
      it: "Data"
    },
    total: {
      de: "Gesamt",
      en: "Total",
      hr: "Ukupno",
      it: "Totale"
    },
    paymentMethod: {
      de: "Zahlungsmethode",
      en: "Payment method",
      hr: "Način plaćanja",
      it: "Metodo di pagamento"
    },
    status: {
      de: "Status",
      en: "Status",
      hr: "Status",
      it: "Stato"
    },
    completed: {
      de: "Abgeschlossen",
      en: "Completed",
      hr: "Završeno",
      it: "Completato"
    },
    processing: {
      de: "In Bearbeitung",
      en: "Processing",
      hr: "U obradi",
      it: "In lavorazione"
    },
    pending: {
      de: "Ausstehend",
      en: "Pending",
      hr: "Na čekanju",
      it: "In attesa"
    },
    products: {
      de: "Produkte in der Bestellung",
      en: "Products in order",
      hr: "Proizvodi u narudžbi",
      it: "Prodotti nell'ordine"
    },
    loadingProducts: {
      de: "Produkte werden geladen...",
      en: "Loading products...",
      hr: "Učitavanje proizvoda...",
      it: "Caricamento prodotti..."
    },
    quantity: {
      de: "Menge",
      en: "Quantity",
      hr: "Količina",
      it: "Quantità"
    },
    scent: {
      de: "Duft",
      en: "Scent",
      hr: "Miris",
      it: "Profumo"
    },
    color: {
      de: "Farbe",
      en: "Color",
      hr: "Boja",
      it: "Colore"
    },
    paymentInfo: {
      de: "Zahlungsinformationen",
      en: "Payment information",
      hr: "Podaci za plaćanje",
      it: "Informazioni di pagamento"
    },
    recipient: {
      de: "Empfänger",
      en: "Recipient",
      hr: "Primatelj",
      it: "Destinatario"
    },
    model: {
      de: "Modell",
      en: "Model",
      hr: "Model",
      it: "Modello"
    },
    reference: {
      de: "Referenznummer",
      en: "Reference",
      hr: "Poziv na broj",
      it: "Riferimento"
    },
    amount: {
      de: "Betrag",
      en: "Amount",
      hr: "Iznos",
      it: "Importo"
    },
    paymentDescription: {
      de: "Zahlungsbeschreibung",
      en: "Payment description",
      hr: "Opis plaćanja",
      it: "Descrizione del pagamento"
    },
    myOrders: {
      de: "Meine Bestellungen",
      en: "My orders",
      hr: "Moje narudžbe",
      it: "I miei ordini"
    },
    continueShopping: {
      de: "Einkauf fortsetzen",
      en: "Continue shopping",
      hr: "Nastavite kupovinu",
      it: "Continua lo shopping"
    },
    stripePayment: {
      de: "Kreditkarte",
      en: "Credit card",
      hr: "Kreditna kartica",
      it: "Carta di credito"
    },
    paypalPayment: {
      de: "PayPal",
      en: "PayPal",
      hr: "PayPal",
      it: "PayPal"
    },
    bankTransfer: {
      de: "Banküberweisung",
      en: "Bank transfer",
      hr: "Bankovni prijenos",
      it: "Bonifico bancario"
    }
  };

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Ako imamo Stripe session ID, prvo pokušavamo procesirati plaćanje
        if (sessionId) {
          console.log("Obrađujem Stripe sesiju:", sessionId);
          
          // Formiramo podatke za API poziv
          const requestData: any = { 
            sessionId,
            language // Dodajemo jezik za kasnije korištenje
          };
          
          // Ako imamo ID korisnika, dodajemo ga
          if (userId) {
            requestData.userId = userId;
          }
          
          // Poziv API-ja za procesiranje Stripe sesije i stvaranje narudžbe
          const createOrderResponse = await apiRequest("POST", "/api/process-stripe-session", requestData);
          
          if (!createOrderResponse.ok) {
            const errorData = await createOrderResponse.json();
            console.error("Server odgovorio s greškom:", errorData);
            setError(errorData.error || "Neuspješno stvaranje narudžbe iz Stripe sesije");
            setLoading(false);
            return;
          }
          
          const newOrderData = await createOrderResponse.json();
          console.log("Dobiveni podaci o narudžbi:", newOrderData);
          
          // Postavljamo ID nove narudžbe
          if (newOrderData && newOrderData.orderId) {
            console.log("Narudžba uspješno kreirana:", newOrderData.orderId);
            
            if (newOrderData.order) {
              setOrder(newOrderData.order);
            } else {
              // Dohvati detalje narudžbe ako nisu uključeni u odgovoru
              const orderResponse = await apiRequest("GET", `/api/orders/${newOrderData.orderId}`);
              const orderData = await orderResponse.json();
              setOrder(orderData);
            }
            
            // Dohvati stavke narudžbe ako ih imamo
            if (newOrderData.orderItems && newOrderData.orderItems.length > 0) {
              console.log("Postavljam stavke narudžbe iz odgovora:", newOrderData.orderItems);
              setOrderItems(newOrderData.orderItems);
            } else {
              // Dohvati stavke narudžbe standardnim putem
              console.log("Dohvaćam stavke za narudžbu:", newOrderData.orderId);
              const itemsResponse = await apiRequest("GET", `/api/orders/${newOrderData.orderId}/items`);
              const itemsData = await itemsResponse.json();
              console.log("Dohvaćene stavke narudžbe:", itemsData);
              setOrderItems(itemsData);
            }
            
            setLoading(false);
            return;
          } else {
            console.error("Dobiveni podaci nemaju orderId:", newOrderData);
            setError("Nedostaje ID narudžbe u odgovoru");
            setLoading(false);
            return;
          }
        }
        
        // Standardna logika za dohvaćanje postojeće narudžbe po ID-u
        if (orderId) {
          try {
            // Fetch order details
            const orderResponse = await apiRequest("GET", `/api/orders/${orderId}`);
            const orderData = await orderResponse.json();
            setOrder(orderData);
            
            // Fetch order items with product, scent, and color details
            const itemsResponse = await apiRequest("GET", `/api/orders/${orderId}/items`);
            const itemsData = await itemsResponse.json();
            setOrderItems(itemsData);
            
            setLoading(false);
          } catch (error) {
            console.error("Error fetching order:", error);
            setError("Greška pri dohvaćanju narudžbe");
            setLoading(false);
          }
          return;
        }
        
        // Ako nemamo ni orderId ni sessionId, prikazujemo pogrešku
        setError("Nedostaje ID narudžbe ili sesije");
        setLoading(false);
      } catch (error) {
        console.error("Greška pri obradi narudžbe:", error);
        setError("Neočekivana greška pri obradi narudžbe");
        setLoading(false);
      }
    };
    
    processPayment();
  }, [orderId, sessionId, userId]);
  
  // Pomoćna funkcija za dohvat prijevoda - koristimo urlLang ako postoji, inače language iz contexta
  const t = (key: string) => {
    const currentLanguage = (urlLang && ['de', 'en', 'hr', 'it'].includes(urlLang)) ? urlLang : language;
    const translation = translations[key as keyof typeof translations];
    if (!translation) return key;
    return translation[currentLanguage as keyof typeof translation] || translation.de;
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="animate-spin h-12 w-12 mx-auto border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                <h1 className="text-2xl font-bold mb-2">{t('loading')}</h1>
                <p className="text-gray-500 mb-4">
                  {t('waitMessage')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }
  
  if (error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">{t('errorTitle')}</h1>
                <p className="text-gray-500 mb-4">
                  {error}
                </p>
                <Button asChild>
                  <Link href="/products">
                    <ShoppingBag className="mr-2 h-5 w-5" />
                    {t('browseProducts')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }
  
  if (!order) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <Clock className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">{t('orderNotFound')}</h1>
                <p className="text-gray-500 mb-4">
                  {t('orderNotFoundDesc')}
                </p>
                <Button asChild>
                  <Link href="/products">
                    <ShoppingBag className="mr-2 h-5 w-5" />
                    {t('browseProducts')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <Helmet>
        <title>{t('pageTitle')}</title>
        <meta name="description" content={t('pageDescription')} />
      </Helmet>
      
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-3xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h1 className="text-2xl font-bold mb-2">{t('orderSuccessTitle')}</h1>
              <p className="text-gray-500">
                {t('thankYouMessage')}
              </p>
            </div>
            
            <Separator className="my-6" />
            
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">{t('orderDetails')}</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">{t('orderNumber')}</p>
                  <p className="font-medium">#{order.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('date')}</p>
                  <p className="font-medium">
                    {new Date(order.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'hr-HR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('total')}</p>
                  <p className="font-medium">{parseFloat(order.total).toFixed(2)} €</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('paymentMethod')}</p>
                  <p className="font-medium">
                    {order.paymentMethod === "paypal" ? t('paypalPayment') : 
                     order.paymentMethod === "stripe" ? t('stripePayment') : 
                     t('bankTransfer')}
                  </p>
                </div>
              </div>
              
              <div className="bg-neutral rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium mb-2">{t('status')}</h3>
                <div className="flex items-center">
                  {order.status === "completed" ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <span className="font-medium">{t('completed')}</span>
                    </>
                  ) : order.status === "processing" ? (
                    <>
                      <Package className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="font-medium">{t('processing')}</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5 text-yellow-500 mr-2" />
                      <span className="font-medium">{t('pending')}</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Order items list */}
              <div className="border rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium mb-3">{t('products')}</h3>
                <div className="space-y-3">
                  {orderItems.length === 0 ? (
                    <p className="text-sm text-gray-500">{t('loadingProducts')}</p>
                  ) : (
                    orderItems.map((item) => (
                      <div key={item.id} className="flex items-start border-b pb-3 last:border-b-0 last:pb-0">
                        <div className="w-12 h-12 rounded overflow-hidden mr-3 bg-neutral flex-shrink-0">
                          {item.product?.imageUrl && (
                            <img 
                              src={item.product.imageUrl} 
                              alt={item.productName || item.product?.name} 
                              className="w-full h-full object-cover" 
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{item.productName || item.product?.name}</p>
                              <p className="text-xs text-gray-500">{t('quantity')}: {item.quantity}</p>
                              
                              {/* Scent info */}
                              {item.scent && (
                                <p className="text-xs text-muted-foreground">
                                  {t('scent')}: <span className="font-medium">{item.scent.name}</span>
                                </p>
                              )}
                              
                              {/* Color info */}
                              {item.color && (
                                <div className="flex items-center mt-1">
                                  <span className="text-xs text-muted-foreground mr-1">{t('color')}:</span>
                                  <div 
                                    className="w-3 h-3 rounded-full mr-1 border"
                                    style={{ backgroundColor: item.color.hexValue }}
                                  ></div>
                                  <span className="text-xs font-medium">{item.color.name}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{parseFloat(item.price).toFixed(2)} €</p>
                              <p className="text-xs text-gray-500">
                                {t('total')}: {(parseFloat(item.price) * item.quantity).toFixed(2)} €
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {order.paymentMethod === "bank_transfer" && (
                <div className="border rounded-lg p-4 bg-neutral mb-4">
                  <h3 className="text-sm font-medium mb-2">{t('paymentInfo')}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex">
                      <span className="font-medium w-32">{t('recipient')}:</span>
                      <span>Kerzenwelt by Dani d.o.o.</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">IBAN:</span>
                      <span>HR1234567890123456789</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">{t('model')}:</span>
                      <span>HR00</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">{t('reference')}:</span>
                      <span>{order.id}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">{t('amount')}:</span>
                      <span>{parseFloat(order.total).toFixed(2)} €</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">{t('paymentDescription')}:</span>
                      <span>Kerzenwelt {t('orderNumber')} #{order.id}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <Separator className="my-6" />
            
            <div className="flex justify-between">
              <Button asChild variant="outline">
                <Link href="/account/orders">
                  {t('myOrders')}
                </Link>
              </Button>
              
              <Button asChild>
                <Link href="/products">
                  {t('continueShopping')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}