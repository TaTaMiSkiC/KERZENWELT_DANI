import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Package, Clock, ArrowRight, ShoppingBag } from "lucide-react";
import { Link } from "wouter";

export default function OrderSuccessPage() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Extract session ID or order ID from URL query parameter
  const searchParams = new URLSearchParams(location.split("?")[1]);
  const orderId = searchParams.get("orderId");
  const sessionId = searchParams.get("session_id");
  
  useEffect(() => {
    const processOrder = async () => {
      // Ako imamo session_id iz Stripe-a, prvo moramo stvoriti narudžbu
      if (sessionId && !orderId) {
        try {
          console.log("Obrađujem Stripe sesiju:", sessionId);
          
          // Poziv API-ja za procesiranje Stripe sesije i stvaranje narudžbe
          const createOrderResponse = await apiRequest("POST", "/api/process-stripe-session", {
            sessionId: sessionId
          });
          
          if (!createOrderResponse.ok) {
            const errorData = await createOrderResponse.json();
            console.error("Server odgovorio s greškom:", errorData);
            throw new Error(errorData.error || "Neuspješno stvaranje narudžbe iz Stripe sesije");
          }
          
          const newOrderData = await createOrderResponse.json();
          console.log("Dobiveni podaci o narudžbi:", newOrderData);
          
          // Postavljamo ID nove narudžbe
          if (newOrderData && newOrderData.orderId) {
            console.log("Postavljen novi ID narudžbe:", newOrderData.orderId);
            setOrder(newOrderData.order);
            
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
          }
        } catch (error) {
          console.error("Greška pri obradi Stripe sesije:", error);
        }
      }
      
      // Standardna logika za dohvaćanje postojeće narudžbe po ID-u
      if (!orderId) {
        setLoading(false);
        return;
      }
      
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
        setLoading(false);
      }
    };
    
    processOrder();
  }, [orderId, sessionId]);
  
  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <h1 className="heading text-3xl font-bold mb-8 text-center">Učitavanje...</h1>
        </div>
      </Layout>
    );
  }
  
  if (!orderId || !order) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <Clock className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Narudžba nije pronađena</h1>
                <p className="text-gray-500 mb-4">
                  Nismo mogli pronaći informacije o vašoj narudžbi.
                </p>
                <Button asChild>
                  <Link href="/products">
                    <ShoppingBag className="mr-2 h-5 w-5" />
                    Pregledajte proizvode
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
        <title>Narudžba uspješna | Kerzenwelt by Dani</title>
        <meta name="description" content="Vaša narudžba je uspješno zaprimljena." />
      </Helmet>
      
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-3xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h1 className="text-2xl font-bold mb-2">Narudžba uspješno zaprimljena!</h1>
              <p className="text-gray-500">
                Hvala vam na vašoj narudžbi. Poslali smo potvrdu na vašu email adresu.
              </p>
            </div>
            
            <Separator className="my-6" />
            
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Detalji narudžbe</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Broj narudžbe</p>
                  <p className="font-medium">#{order.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Datum</p>
                  <p className="font-medium">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ukupno</p>
                  <p className="font-medium">{parseFloat(order.total).toFixed(2)} €</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Način plaćanja</p>
                  <p className="font-medium">
                    {order.paymentMethod === "paypal" ? "PayPal" : "Bankovni prijenos"}
                  </p>
                </div>
              </div>
              
              <div className="bg-neutral rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium mb-2">Status narudžbe</h3>
                <div className="flex items-center">
                  {order.status === "completed" ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <span className="font-medium">Završeno</span>
                    </>
                  ) : order.status === "processing" ? (
                    <>
                      <Package className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="font-medium">U obradi</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5 text-yellow-500 mr-2" />
                      <span className="font-medium">Na čekanju</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Order items list */}
              <div className="border rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium mb-3">Proizvodi u narudžbi</h3>
                <div className="space-y-3">
                  {orderItems.length === 0 ? (
                    <p className="text-sm text-gray-500">Učitavanje proizvoda...</p>
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
                              <p className="text-xs text-gray-500">Količina: {item.quantity}</p>
                              
                              {/* Scent info */}
                              {item.scent && (
                                <p className="text-xs text-muted-foreground">
                                  Miris: <span className="font-medium">{item.scent.name}</span>
                                </p>
                              )}
                              
                              {/* Color info */}
                              {item.color && (
                                <div className="flex items-center mt-1">
                                  <span className="text-xs text-muted-foreground mr-1">Boja:</span>
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
                                Ukupno: {(parseFloat(item.price) * item.quantity).toFixed(2)} €
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
                  <h3 className="text-sm font-medium mb-2">Podaci za plaćanje</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex">
                      <span className="font-medium w-32">Primatelj:</span>
                      <span>Kerzenwelt by Dani d.o.o.</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">IBAN:</span>
                      <span>HR1234567890123456789</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">Model:</span>
                      <span>HR00</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">Poziv na broj:</span>
                      <span>{order.id}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">Iznos:</span>
                      <span>{parseFloat(order.total).toFixed(2)} €</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">Opis plaćanja:</span>
                      <span>Kerzenwelt narudžba #{order.id}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <Separator className="my-6" />
            
            <div className="flex justify-between">
              <Button asChild variant="outline">
                <Link href="/account/orders">
                  Moje narudžbe
                </Link>
              </Button>
              
              <Button asChild>
                <Link href="/products">
                  Nastavite kupovinu
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