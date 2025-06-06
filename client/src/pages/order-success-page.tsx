import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Package,
  Clock,
  ArrowRight,
  ShoppingCart, // Icona za "Continue shopping" button
  LoaderCircle,
} from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { format } from "date-fns"; // Dodano za formatiranje datuma

export default function OrderSuccessPage() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]); // Stavke narudžbe
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const searchParams = new URLSearchParams(location.split("?")[1]);
  let orderIdFromUrl = searchParams.get("orderId");
  const sessionId = searchParams.get("session_id");

  // POKUŠAJ DOHVATITI orderId IZ SESSION STORAGE AKO NIJE U URL-u
  const storedOrderId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("lastProcessedOrderId")
      : null;
  console.log(
    "Pokušavam dohvatiti orderId iz sessionStorage (na početku page-a):",
    storedOrderId,
  );
  if (!orderIdFromUrl && storedOrderId) {
    orderIdFromUrl = storedOrderId;
    console.log(
      "Dohvaćen orderId iz sessionStorage i postavljen kao orderIdFromUrl:",
      orderIdFromUrl,
    );
    // Nakon što ga upotrijebimo, možemo ga obrisati iz sessionStorage
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("lastProcessedOrderId");
      console.log("Obrisan orderId iz sessionStorage.");
    }
  }

  console.log("OrderSuccessPage učitan.");
  console.log("Trenutna lokacija:", location);
  console.log(
    "Dohvaćen orderIdFromUrl (nakon provjere sessionStorage):",
    orderIdFromUrl,
  );
  console.log("Dohvaćen sessionId:", sessionId);

  useEffect(() => {
    console.log("🔥🔥🔥 useEffect u OrderSuccessPage pokrenut!");
    console.log("🔥🔥🔥 sessionId unutar useEffect:", sessionId);
    console.log("🔥🔥🔥 orderIdFromUrl unutar useEffect:", orderIdFromUrl);

    const processOrder = async () => {
      setLoading(true);
      setError(null);

      if (orderIdFromUrl) {
        console.log(
          "Dohvaćam narudžbu po orderIdFromUrl (iz URL-a ili sessionStorage):",
          orderIdFromUrl,
        );
        try {
          // Dohvati osnovne podatke o narudžbi
          const orderDetailsResponse = await apiRequest(
            "GET",
            `/api/orders/${orderIdFromUrl}`,
          );
          const orderDetails = await orderDetailsResponse.json();

          // Dohvati stavke narudžbe
          const orderItemsResponse = await apiRequest(
            "GET",
            `/api/orders/${orderIdFromUrl}/items`,
          );
          const items = await orderItemsResponse.json();

          setOrder(orderDetails);
          setOrderItems(items || []);

          // Automatski pozovi postojeću funkcionalnost za generiranje PDF-a iz order details
          if (orderDetails && orderDetails.id) {
            try {
              console.log(
                "🔥 CLIENT - Početak automatskog slanja PDF-a za narudžbu:",
                orderDetails.id,
              );

              console.log(
                "📞 CLIENT - Pozivam endpoint:",
                `/api/orders/${orderDetails.id}/generate-pdf`,
              );

              const pdfResponse = await fetch(
                `/api/orders/${orderDetails.id}/generate-pdf`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  credentials: "include",
                },
              );

              console.log("📨 CLIENT - Response status:", pdfResponse.status);
              console.log("📨 CLIENT - Response ok:", pdfResponse.ok);

              if (pdfResponse.ok) {
                const responseData = await pdfResponse.json();
                console.log(
                  "✅ CLIENT - PDF račun je uspešno generiran i poslan na email:",
                  responseData,
                );
              } else {
                const errorData = await pdfResponse.text();
                console.warn(
                  "❌ CLIENT - PDF račun se nije mogao generirati:",
                  errorData,
                );
              }
            } catch (invoiceError) {
              console.error(
                "❌ CLIENT - Greška pri generiranju PDF računa:",
                invoiceError,
              );
            }
          }
        } catch (err: any) {
          console.error(
            "Fehler beim Abrufen der Bestelldaten (Frontend):",
            err,
          );
          setError(
            t("orderSuccessPage.orderRetrievalError") +
              (err.message ? ` (${err.message})` : ""),
          );
          setOrder(null);
        }
      } else {
        // Ako nema orderId u URL-u, pokušavamo dohvatiti zadnju narudžbu korisnika
        console.log(
          "🔍 CLIENT - Nema orderId u URL-u. Pokušavam dohvatiti zadnju narudžbu korisnika.",
        );
        console.log("🔍 CLIENT - user?.id:", user?.id);
        if (user?.id) {
          try {
            console.log("🔍 CLIENT - Šaljem zahtev za narudžbe...");
            const response = await fetch("/api/orders", {
              method: "GET",
              credentials: "include",
            });
            const userOrders = await response.json();
            console.log("🔍 CLIENT - Odgovor sa narudžbama:", userOrders);
            if (userOrders && userOrders.length > 0) {
              const latestOrder = userOrders[0]; // Uzmi zadnju narudžbu (prva u nizu jer su sortirane po datumu)
              console.log(
                "✅ CLIENT - Dohvaćena zadnja narudžba:",
                latestOrder,
              );
              setOrder(latestOrder);

              // Dohvati stavke narudžbe
              const orderItemsResponse = await apiRequest(
                "GET",
                `/api/orders/${latestOrder.id}/items`,
              );
              const items = await orderItemsResponse.json();
              setOrderItems(items || []);

              // Automatski generiraj i pošalji PDF račun na email
              if (latestOrder && latestOrder.id) {
                try {
                  console.log(
                    "🔥 CLIENT - Početak automatskog slanja PDF-a za zadnju narudžbu:",
                    latestOrder.id,
                  );

                  console.log(
                    "📞 CLIENT - Pozivam endpoint:",
                    `/api/orders/${latestOrder.id}/generate-pdf`,
                  );

                  const pdfResponse = await fetch(
                    `/api/orders/${latestOrder.id}/generate-pdf`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      credentials: "include",
                    },
                  );

                  console.log(
                    "📨 CLIENT - Response status:",
                    pdfResponse.status,
                  );
                  console.log("📨 CLIENT - Response ok:", pdfResponse.ok);

                  if (pdfResponse.ok) {
                    const responseData = await pdfResponse.json();
                    console.log(
                      "✅ CLIENT - PDF račun je uspešno generiran i poslan na email:",
                      responseData,
                    );
                  } else {
                    const errorData = await pdfResponse.text();
                    console.warn(
                      "❌ CLIENT - PDF račun se nije mogao generirati:",
                      errorData,
                    );
                  }
                } catch (invoiceError) {
                  console.error(
                    "❌ CLIENT - Greška pri generiranju PDF računa:",
                    invoiceError,
                  );
                }
              }
            } else {
              setError(
                t("orderSuccessPage.noOrderInfo") ||
                  "Nema informacija o narudžbi.",
              );
              setOrder(null);
            }
          } catch (err: any) {
            console.error("Greška pri dohvaćanju zadnje narudžbe:", err);
            setError(
              t("orderSuccessPage.orderRetrievalError") +
                (err.message ? ` (${err.message})` : ""),
            );
            setOrder(null);
          }
        } else {
          // Korisnik nije prijavljen i nema orderId u URL-u
          setError(
            t("orderSuccessPage.noOrderInfo") ||
              "Nema informacija o narudžbi. Molimo prijavite se.",
          );
          setOrder(null);
        }
      }
      setLoading(false);
    };

    processOrder();
  }, [orderIdFromUrl, user?.id, t]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoaderCircle className="animate-spin h-8 w-8 text-primary" />
          <p className="ml-3">{t("orderSuccessPage.loadingOrder")}</p>
        </div>
      </Layout>
    );
  }

  // Prikaz greške ako postoji
  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center text-red-500">
          <p className="text-xl font-semibold mb-4">
            {t("orderSuccessPage.errorTitle")}
          </p>
          <p className="text-lg">{error}</p>
          <Button asChild className="mt-6">
            <Link href="/products">
              {t("orderSuccessPage.continueShopping")}
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  // Dohvati formatirane iznose za prikaz
  const orderTotal = parseFloat(order.total || 0).toFixed(2);
  const orderSubtotal = parseFloat(order.subtotal || 0).toFixed(2);
  const orderShippingCost = parseFloat(order.shippingCost || 0).toFixed(2);
  const orderDiscountAmount = parseFloat(order.discountAmount || 0).toFixed(2);

  // Funkcija za prevođenje načina plaćanja (kopirana iz order-details-page)
  const getPaymentMethodText = (method: string | undefined) => {
    if (!method) return t("orders.notDefined");
    switch (method) {
      case "cash":
        return t("orders.cash");
      case "bank":
        return t("orders.bankTransfer"); // Ako ti je bank transfer 'bank' u bazi
      case "paypal":
        return t("orders.paypal");
      case "stripe":
        return t("orders.creditCard"); // Ako StripePaymentElement šalje 'stripe'
      case "nachnahme":
        return t("checkout.paymentMethods.cash.title"); // Za Nachnahme
      case "pickup":
        return t("checkout.paymentMethods.pickup.title"); // Za Selbstabholung
      default:
        return method.charAt(0).toUpperCase() + method.slice(1);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>{t("orderSuccessPage.title")} | Kerzenwelt by Dani</title>
      </Helmet>
      <div className="container mx-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="p-6 md:p-8">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  {t("orderSuccessPage.orderConfirmed")}
                </h1>
                <p className="text-gray-600 mb-6">
                  {t("orderSuccessPage.thankYou")}
                </p>
              </div>
              {order && (
                <div className="mt-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    {t("orderSuccessPage.orderDetails")}
                  </h2>

                  {/* Basic Order Information */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">
                          {t("orderSuccessPage.orderNumber")}
                        </p>
                        <p className="font-semibold">#{order.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          {t("orderSuccessPage.total")}
                        </p>
                        {/* OVDJE JE KLJUČNO: KORISTIMO orderTotal KOJI JE 7.64€ */}
                        <p className="font-semibold">{orderTotal} €</p>
                        {/* UKLONJENO PRERAČUNAVANJE POPUSTA OVDJE, SAMO PRIKAZ AKO ŽELIŠ */}
                        {/* orderDiscountAmount je već 0.85 ako postoji popust */}
                        {/* Ako želiš ovdje prikazati liniju "Rabatt: -0.85€", možeš dodati: */}
                        {/* {parseFloat(orderDiscountAmount) > 0 && (
                          <p className="text-sm text-green-600">
                            Rabatt: -{orderDiscountAmount} €
                          </p>
                        )} */}
                      </div>
                      {order.status && (
                        <div>
                          <p className="text-sm text-gray-600">Status</p>
                          <p className="font-semibold capitalize">
                            {order.status}
                          </p>
                        </div>
                      )}
                      {order.createdAt && (
                        <div>
                          <p className="text-sm text-gray-600">
                            {t("orderSuccessPage.orderDate")}
                          </p>
                          <p className="font-semibold">
                            {format(
                              new Date(order.createdAt),
                              "dd.MM.yyyy. HH:mm",
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items - ovaj dio je ostao nepromijenjen, samo se prikazuje */}
                  {orderItems.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">
                        {t("orderSuccessPage.orderedItems")}
                      </h3>
                      {orderItems.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between border-b pb-2"
                        >
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-sm text-gray-500">
                              {item.quantity} x{" "}
                              {parseFloat(item.price).toFixed(2)} €
                            </p>
                            {item.scentName && (
                              <p className="text-sm text-gray-500">
                                {t("orderSuccessPage.scent")}: {item.scentName}
                              </p>
                            )}
                            {item.colorName && (
                              <p className="text-sm text-gray-500">
                                {t("orderSuccessPage.color")}: {item.colorName}
                              </p>
                            )}
                          </div>
                          <p className="font-medium">
                            {(item.quantity * parseFloat(item.price)).toFixed(
                              2,
                            )}{" "}
                            €
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Dodajte detalje za Stripe plaćanja */}
              {order && order.paymentMethod === "stripe" && (
                <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="text-xl font-semibold text-green-800 mb-3 flex items-center">
                    <CheckCircle className="h-6 w-6 mr-2" />
                    {t("orderSuccessPage.stripePaymentSuccess")}
                  </h3>
                  <p className="text-green-700 mb-4">
                    {t("orderSuccessPage.stripeThankYou")}
                  </p>
                  <div className="space-y-2 text-green-700">
                    <p>• {t("orderSuccessPage.stripeConfirmation")}</p>
                    <p>• {t("orderSuccessPage.stripeProcessing")}</p>
                    <p>• {t("orderSuccessPage.stripeContact")}</p>
                  </div>
                  <div className="mt-4 p-3 bg-green-100 rounded-md">
                    <p className="text-sm text-green-800 font-medium">
                      {t("orderSuccessPage.stripeNextSteps")}
                    </p>
                  </div>
                </div>
              )}
              {/* Dodajte detalje za "Selbstabholung" ako je to plaćanje */}
              {order && order.paymentMethod === "pickup" && (
                <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="text-xl font-semibold text-yellow-800 mb-3 flex items-center">
                    <Package className="h-6 w-6 mr-2" />
                    {t("orderSuccessPage.pickupDetails")}
                  </h3>
                  <p className="text-yellow-700 mb-2">
                    {t("orderSuccessPage.pickupAddress")}:
                  </p>
                  <p className="text-yellow-700">
                    {t("orderSuccessPage.companyName")}
                    <br />
                    {t("orderSuccessPage.addressLine1")}
                    <br />
                    {t("orderSuccessPage.addressLine2")}
                  </p>
                  <p className="text-yellow-700 mt-2">
                    {t("orderSuccessPage.pickupContact")}:{" "}
                    {t("orderSuccessPage.contactEmail")}
                  </p>
                  <p className="text-yellow-700 mt-2">
                    {t("orderSuccessPage.pickupNotice")}
                  </p>
                </div>
              )}
              {/* Dodajte detalje za plaćanje virmanom (Bank transfer) ako je potrebno */}
              {order && order.paymentMethod === "bankTransfer" && (
                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-xl font-semibold text-blue-800 mb-3">
                    {t("orderSuccessPage.bankTransferDetails")}
                  </h3>
                  <div className="text-blue-700 space-y-1">
                    <div className="flex">
                      <span className="font-medium w-32">
                        {t("orderSuccessPage.bankName")}:
                      </span>
                      <span>{t("orderSuccessPage.bankNameValue")}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">IBAN:</span>
                      <span>{t("orderSuccessPage.ibanValue")}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">BIC:</span>
                      <span>{t("orderSuccessPage.bicValue")}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">
                        {t("orderSuccessPage.accountHolder")}:
                      </span>
                      <span>{t("orderSuccessPage.accountHolderValue")}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">
                        {t("orderSuccessPage.referenceModel")}:
                      </span>
                      <span>HR00</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">
                        {t("orderSuccessPage.referenceNumber")}:
                      </span>
                      <span>{order.id}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">
                        {t("orderSuccessPage.amount")}:
                      </span>
                      <span>{parseFloat(order.total).toFixed(2)} €</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-32">
                        {t("orderSuccessPage.paymentDescription")}:
                      </span>
                      <span>
                        Kerzenwelt {t("orderSuccessPage.order")} #{order.id}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <Separator className="my-6" />
              <div className="flex justify-between">
                <Button asChild variant="outline">
                  <Link href="/orders">{t("orderSuccessPage.myOrders")}</Link>
                </Button>

                <Button asChild>
                  <Link href="/products">
                    {t("orderSuccessPage.continueShoppingButton")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
