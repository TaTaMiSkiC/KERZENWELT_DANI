import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import {
  useSettings, // Behalten wir, um Ladezustand zu erhalten
  useSettingValue, // Behalten wir
} from "@/hooks/use-settings-api";
import { useLanguage } from "@/hooks/use-language";
import { useTax } from "@/hooks/use-tax";
import { Helmet } from "react-helmet";
import Layout from "@/components/layout/Layout";
import CartItem from "@/components/cart/CartItem";
import {
  ShippingCostCalculator,
  FreeShippingProgress,
} from "@/components/ShippingCostCalculator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingBag,
  ChevronRight,
  CreditCard,
  RefreshCw,
  Truck,
  Info,
  AlertTriangle,
  ShoppingBasket,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function CartPage() {
  const {
    cartItems,
    cartTotal,
    clearCart,
    isLoading: isLoadingCart,
  } = useCart();
  const { user } = useAuth();
  const { t, translateText } = useLanguage();
  const { formatPriceWithTax, shouldShowTax, calculateGrossPrice, calculateTax } = useTax();
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);

  // Total nach Popust
  const totalAfterDiscount = cartTotal - discount;

  // ✅ KORREKTUR: useEffect block for fetching delivery settings (ONLY ONCE on mount)
  // Entfernen Sie die `setInterval` Zeile vollständig.
  // Die Werte `freeShippingThreshold` und `standardShippingRate` werden weiterhin über `shippingSettings` und `useSettingValue` abgeleitet.

  const [shippingSettings, setShippingSettings] = useState<{
    freeShippingThreshold: string;
    standardShippingRate: string;
  } | null>(null);
  const [isDirectlyLoadingSettings, setIsDirectlyLoadingSettings] =
    useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsDirectlyLoadingSettings(true);
        const freeThresholdResponse = await fetch(
          "/api/settings/freeShippingThreshold",
        );
        const freeThresholdData = await freeThresholdResponse.json();

        const standardRateResponse = await fetch(
          "/api/settings/standardShippingRate",
        );
        const standardRateData = await standardRateResponse.json();

        console.log("Direkt dohvaćene postavke u cart-page (einmalig):", {
          // Log angepasst
          freeShippingThreshold: freeThresholdData.value,
          standardShippingRate: standardRateData.value,
        });

        setShippingSettings({
          freeShippingThreshold: freeThresholdData.value,
          standardShippingRate: standardRateData.value,
        });

        localStorage.setItem("freeShippingThreshold", freeThresholdData.value);
        localStorage.setItem("standardShippingRate", standardRateData.value);

        // queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        // queryClient.invalidateQueries({
        //   queryKey: ["/api/settings", "freeShippingThreshold"],
        // });
        // queryClient.invalidateQueries({
        //   queryKey: ["/api/settings", "standardShippingRate"],
        // });
      } catch (error) {
        console.error("Greška pri dohvaćanju postavki:", error);
        setShippingSettings(null);
      } finally {
        setIsDirectlyLoadingSettings(false);
      }
    };

    fetchSettings();

    // ✅ REMOVED: No more setInterval here.
    // return () => clearInterval(intervalId); // Cleanup is not needed if no interval
  }, []); // Empty dependency array means it runs only once on mount

  // ✅ KORISTIMO useSettingValue kao fallback ako direktno dohvaćanje nije uspjelo ili se još učitava
  const queryFreeShippingThresholdValue = useSettingValue(
    "freeShippingThreshold",
    "50",
  );
  const queryStandardShippingRateValue = useSettingValue(
    "standardShippingRate",
    "5",
  );

  // ✅ LOGIKA PRIORITIZACIJE: Direktno dohvaćeno (shippingSettings) > React Query (useSettingValue) > Default
  let freeShippingThreshold = parseFloat(
    shippingSettings?.freeShippingThreshold ||
      queryFreeShippingThresholdValue ||
      "50",
  );
  if (isNaN(freeShippingThreshold)) {
    freeShippingThreshold = 50; // Fallback to default if NaN
  }

  let standardShippingRate = parseFloat(
    shippingSettings?.standardShippingRate ||
      queryStandardShippingRateValue ||
      "5",
  );
  if (isNaN(standardShippingRate)) {
    standardShippingRate = 5; // Fallback to default if NaN
  }

  // Ako je standardShippingRate 0, dostava je uvijek besplatna
  const isFreeShipping =
    standardShippingRate === 0 ||
    (totalAfterDiscount >= freeShippingThreshold && freeShippingThreshold > 0);
  const shippingCost = isFreeShipping ? 0 : standardShippingRate;

  // Ukupan iznos s dostavom
  const totalWithShipping = totalAfterDiscount + shippingCost;

  const handleApplyCoupon = () => {
    if (couponCode.toLowerCase() === "dobrodosli") {
      setDiscount(cartTotal * 0.1); // 10% popusta
    } else {
      setDiscount(0);
    }
  };

  // ✅ AŽURIRANA LOGIKA UČITAVANJA: Jetzt nur noch isLoadingCart und isDirectlyLoadingSettings
  const isLoadingCartData = isLoadingCart || isDirectlyLoadingSettings;

  if (isLoadingCartData) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <h1 className="heading text-3xl font-bold mb-8 text-center">
            {t("cart.loading")}
          </h1>
        </div>
      </Layout>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <Layout>
        <Helmet>
          <title>{`${t("cart.title")} | Kerzenwelt by Dani`}</title>
          <meta name="description" content={t("cart.metaDescription")} />
        </Helmet>

        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <ShoppingBasket size={64} className="mx-auto mb-6 text-gray-300" />
            <h1 className="heading text-3xl font-bold mb-4">
              {t("cart.empty")}
            </h1>
            <p className="text-gray-500 mb-8">{t("cart.emptyMessage")}</p>
            <Button size="lg" asChild>
              <Link href="/products">{t("cart.browseProducts")}</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>{`${t("cart.title")} (${cartItems.length}) | Kerzenwelt by Dani`}</title>
        <meta name="description" content={t("cart.metaDescription")} />
      </Helmet>

      <div className="bg-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="heading text-3xl font-bold mb-2">{t("cart.title")}</h1>
          <div className="flex items-center text-sm text-gray-500 mb-8">
            <Link href="/" className="hover:text-primary">
              {t("breadcrumbs.home")}
            </Link>
            <ChevronRight size={14} className="mx-2" />
            <span className="text-gray-800 font-medium">{t("cart.title")}</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Cart items */}
            <div className="w-full lg:w-2/3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>{t("cart.itemsInCart")}</CardTitle>
                  <CardDescription>
                    {cartItems.length} {t("cart.productsCount")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {cartItems.map((item) => (
                    <CartItem key={item.id} item={item} />
                  ))}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => clearCart.mutate()}
                    disabled={clearCart.isPending}
                  >
                    {clearCart.isPending
                      ? t("cart.clearing")
                      : t("cart.clearCart")}
                  </Button>
                  <Button asChild>
                    <Link href="/products">{t("cart.continueShopping")}</Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Order summary */}
            <div className="w-full lg:w-1/3">
              <Card>
                <CardHeader>
                  <CardTitle>{t("cart.orderSummary")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">
                        {t("cart.subtotal")}
                      </span>
                      <span>{cartTotal.toFixed(2)} €</span>
                    </div>

                    {discount > 0 && (
                      <div className="flex justify-between text-success">
                        <span>{t("cart.discount")}</span>
                        <span>-{discount.toFixed(2)} €</span>
                      </div>
                    )}

                    {/* Dinamički izračun dostave */}
                    <ShippingCostCalculator
                      subtotal={totalAfterDiscount}
                      freeShippingThreshold={freeShippingThreshold} // Prosljeđujemo direktno
                      standardShippingRate={standardShippingRate} // Prosljeđujemo direktno
                    />

                    <Separator />

                    {/* Traka napretka do besplatne dostave */}
                    <FreeShippingProgress
                      subtotal={totalAfterDiscount}
                      freeShippingThreshold={freeShippingThreshold} // Prosljeđujemo direktno
                    />

                    {/* Ukupno - uključuje dostavu */}
                    <div className="flex justify-between font-bold text-lg">
                      <span>{t("cart.total")}</span>
                      <span>{totalWithShipping.toFixed(2)} €</span>
                    </div>

                    {/* Coupon code input */}
                    <div className="mt-6">
                      <div className="flex space-x-2">
                        <Input
                          type="text"
                          placeholder={t("cart.couponCode")}
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                        />
                        <Button
                          variant="outline"
                          onClick={handleApplyCoupon}
                          disabled={!couponCode}
                        >
                          {t("cart.applyCoupon")}
                        </Button>
                      </div>
                      {couponCode === "dobrodosli" && discount > 0 && (
                        <p className="text-success text-sm mt-2">
                          {t("cart.couponApplied")}
                        </p>
                      )}
                    </div>

                    <Button className="w-full mt-6" size="lg" asChild>
                      <Link
                        href={user ? "/checkout" : "/auth?redirect=checkout"}
                        className="flex items-center justify-center"
                      >
                        <CreditCard size={18} className="mr-2" />
                        {t("cart.proceedToCheckout")}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
                <CardFooter>
                  <div className="flex items-center text-sm text-gray-500">
                    <Truck size={14} className="mr-2" />
                    <span>
                      {standardShippingRate === 0
                        ? t("cart.freeShippingForAll")
                        : freeShippingThreshold > 0
                          ? translateText(
                              t("cart.freeShippingMessage").replace(
                                "{amount}",
                                freeShippingThreshold.toFixed(2),
                              ),
                            )
                          : `${t("cart.shippingCost")}: ${standardShippingRate.toFixed(2)}€`}
                    </span>
                  </div>
                </CardFooter>
              </Card>

              {/* Additional info */}
              <div className="mt-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="shipping">
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center">
                        <Info size={16} className="mr-2" />
                        {t("cart.shippingInfo")}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-gray-500">
                      <p className="mb-2">{t("cart.shippingInfoText1")}</p>
                      <p className="mb-2">{t("cart.shippingInfoText2")}</p>
                      <p>
                        {standardShippingRate === 0
                          ? t("cart.freeShippingForAll")
                          : freeShippingThreshold > 0
                            ? translateText(
                                t("cart.shippingInfoText3")
                                  .replace(
                                    "{amount}",
                                    freeShippingThreshold.toFixed(2),
                                  )
                                  .replace(
                                    "{shipping}",
                                    standardShippingRate.toFixed(2),
                                  ),
                              )
                            : translateText(
                                t("cart.shippingInfoText4").replace(
                                  "{shipping}",
                                  standardShippingRate.toFixed(2),
                                ),
                              )}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="payment">
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center">
                        <CreditCard size={16} className="mr-2" />
                        {t("cart.paymentMethods")}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-gray-500">
                      <p className="mb-2">{t("cart.paymentMethodsText")}</p>
                      <ul className="list-disc list-inside">
                        <li>{t("cart.paymentMethod1")}</li>
                        <li>{t("cart.paymentMethod2")}</li>
                        <li>{t("cart.paymentMethod3")}</li>
                        <li>{t("cart.paymentMethod4")}</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
