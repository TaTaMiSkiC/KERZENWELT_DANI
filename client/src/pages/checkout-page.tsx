import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import {
  useSettings, // Behalten wir, um Ladezustand zu erhalten
  useSettingValue, // Behalten wir
} from "@/hooks/use-settings-api";
import { useLanguage } from "@/hooks/use-language";
import { useTax } from "@/hooks/use-tax";
// import { queryClient } from "@/lib/queryClient"; // queryClient wird nicht mehr direkt im useEffect benötigt, da setInterval entfernt wird
import { Helmet } from "react-helmet";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Lock, ChevronRight, ShoppingBag } from "lucide-react";
import { Link } from "wouter";

export default function CheckoutPage() {
  const { cartItems, cartTotal, isLoading: isLoadingCart } = useCart();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const { t, translateText } = useLanguage();
  const { formatPriceWithTax, shouldShowTax, calculateGrossPrice, calculateTax, calculateNetPrice } = useTax();

  // ✅ VRAĆENO: State za direktno dohvaćene vrijednosti postavki dostave
  const [shippingSettings, setShippingSettings] = useState<{
    freeShippingThreshold: string;
    standardShippingRate: string;
  } | null>(null);
  // ✅ VRAĆENO: State za praćenje učitavanja direktnih API poziva
  const [isDirectlyLoadingSettings, setIsDirectlyLoadingSettings] =
    useState(true);

  // Total nakon popusta
  const totalAfterDiscount = cartTotal;

  // ✅ KORREKTUR: useEffect block for fetching delivery settings (ONLY ONCE on mount)
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsDirectlyLoadingSettings(true); // Set to true before fetching
        const freeThresholdResponse = await fetch(
          "/api/settings/freeShippingThreshold",
        );
        const freeThresholdData = await freeThresholdResponse.json();

        const standardRateResponse = await fetch(
          "/api/settings/standardShippingRate",
        );
        const standardRateData = await standardRateResponse.json();

        console.log("Direktno dohvaćene postavke u checkout-page (einmalig):", {
          // Log angepasst
          freeShippingThreshold: freeThresholdData.value,
          standardShippingRate: standardRateData.value,
        });

        // Update state and localStorage
        setShippingSettings({
          freeShippingThreshold: freeThresholdData.value,
          standardShippingRate: standardRateData.value,
        });

        localStorage.setItem("freeShippingThreshold", freeThresholdData.value);
        localStorage.setItem("standardShippingRate", standardRateData.value);

        // React Query cache invalidation (still good practice if useQuery is used elsewhere)
        // queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        // queryClient.invalidateQueries({
        //   queryKey: ["/api/settings", "freeShippingThreshold"],
        // });
        // queryClient.invalidateQueries({
        //   queryKey: ["/api/settings", "standardShippingRate"],
        // });
      } catch (error) {
        console.error("Greška pri dohvaćanju postavki u checkout-page:", error);
        setShippingSettings(null);
      } finally {
        setIsDirectlyLoadingSettings(false);
      }
    };

    // Fetch data immediately when component mounts
    fetchSettings();

    // ✅ REMOVED: No more setInterval here. The settings will only be fetched once.
    // return () => clearInterval(intervalId); // This cleanup is now unnecessary for settings, but keep if other intervals exist
  }, []); // Empty dependency array means it runs only once on mount

  // ✅ KORISTIMO useSettingValue kao fallback ako direktno dohvaćanje nije uspjelo ili se još učitava
  // Values from useSettingValue (React Query)
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

  // Check if user has a valid discount
  const hasDiscount =
    user &&
    user.discountAmount &&
    parseFloat(user.discountAmount) > 0 &&
    user.discountExpiryDate &&
    new Date(user.discountExpiryDate) > new Date();

  // Check if order meets minimum requirement for discount
  const meetsMinimumOrder =
    !user?.discountMinimumOrder ||
    parseFloat(user.discountMinimumOrder || "0") <= cartTotal;

  // Apply discount if valid
  const discountAmount =
    hasDiscount && meetsMinimumOrder
      ? (user as any)?.discountType === "percentage"
        ? (cartTotal * parseFloat(user.discountAmount || "0")) / 100
        : parseFloat(user.discountAmount || "0")
      : 0;

  // Calculate shipping and total
  const isFreeShipping =
    standardShippingRate === 0 ||
    (cartTotal >= freeShippingThreshold && freeShippingThreshold > 0);
  const shipping = isFreeShipping ? 0 : standardShippingRate;
  const total = Math.max(0, cartTotal + shipping - discountAmount);

  // Redirect to cart if cart is empty
  useEffect(() => {
    if (!isLoadingCart && (!cartItems || cartItems.length === 0)) {
      navigate("/cart");
    }
  }, [cartItems, isLoadingCart, navigate]);

  // ✅ UPDATED LOADING LOGIC: Now also includes isDirectlyLoadingSettings (initial direct fetch)
  const isLoadingPage = isLoadingCart || isDirectlyLoadingSettings; // Keep this until initial fetch is done

  if (isLoadingPage) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <h1 className="heading text-3xl font-bold mb-8 text-center">
            {t("newsletter.loading")}
          </h1>
        </div>
      </Layout>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <h1 className="heading text-3xl font-bold mb-8 text-center">
            {t("cart.empty")}
          </h1>
          <div className="text-center">
            <Button asChild>
              <Link href="/products">{t("orders.browseProducts")}</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>{t("admin.payment")} | Kerzenwelt by Dani</title>
        <meta name="description" content={t("checkout.metaDescription")} />
      </Helmet>

      <div className="bg-neutral py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="heading text-3xl font-bold">
              {t("admin.payment")}{" "}
            </h1>
            <div className="flex items-center text-sm text-gray-500">
              <Link href="/" className="hover:text-primary">
                {t("nav.home")}
              </Link>
              <ChevronRight size={14} className="mx-2" />
              <Link href="/cart" className="hover:text-primary">
                {t("nav.cart")}
              </Link>
              <ChevronRight size={14} className="mx-2" />
              <span className="text-gray-800 font-medium">
                {t("admin.payment")}
              </span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Checkout form */}
            <div className="w-full lg:w-2/3">
              <Card>
                <CardContent className="pt-6">
                  {/* ✅ PROSLJEĐUJEMO PROPOVE CheckoutForm-u */}
                  <CheckoutForm
                    freeShippingThreshold={freeShippingThreshold}
                    standardShippingRate={standardShippingRate}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Order summary */}
            <div className="w-full lg:w-1/3">
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center">
                    <ShoppingBag size={20} className="mr-2" />
                    {t("cart.orderSummary")}
                  </h2>

                  {/* Product list */}
                  <div className="divide-y">
                    {cartItems.map((item) => (
                      <div key={item.id} className="py-3 flex justify-between">
                        <div className="flex">
                          <div className="w-16 h-16 mr-4 rounded overflow-hidden">
                            <img
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <h3 className="font-medium">{item.product.name}</h3>
                            <p className="text-sm text-gray-500">
                              {t("orders.quantity")}: {item.quantity}
                            </p>
                            {item.scent && (
                              <p className="text-xs text-muted-foreground">
                                {t("orders.scent")}:{" "}
                                <span className="font-medium">
                                  {item.scent.name}
                                </span>
                              </p>
                            )}
                            {/* Prikaz jedne boje */}
                            {item.color && !item.hasMultipleColors && (
                              <div className="flex items-center mt-1">
                                <span className="text-xs text-muted-foreground mr-1">
                                  {t("orders.color")}:
                                </span>
                                <div
                                  className="w-3 h-3 rounded-full mr-1 border"
                                  style={{
                                    backgroundColor: item.color.hexValue,
                                  }}
                                ></div>
                                <span className="text-xs font-medium">
                                  {item.color.name}
                                </span>
                              </div>
                            )}

                            {/* Prikaz višestrukih boja */}
                            {item.hasMultipleColors &&
                              item.selectedColors &&
                              item.selectedColors.length > 0 && (
                                <div className="mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {t("orders.color")}:
                                  </span>
                                  <div className="flex flex-wrap gap-1 items-center mt-1">
                                    {item.selectedColors.map((color) => (
                                      <div
                                        key={`color-${color.id}`}
                                        className="inline-flex items-center mr-1"
                                      >
                                        {color.hexValue ? (
                                          <div
                                            className="w-3 h-3 rounded-full mr-1 border"
                                            style={{
                                              backgroundColor: color.hexValue,
                                            }}
                                          ></div>
                                        ) : (
                                          <div className="w-3 h-3 rounded-full mr-1 border bg-gray-300"></div>
                                        )}
                                        <span className="text-xs font-medium">
                                          {color.name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {/* Fallback - ako nemamo selectedColors objekte, ali imamo colorName */}
                            {item.hasMultipleColors &&
                              (!item.selectedColors ||
                                item.selectedColors.length === 0) &&
                              item.colorName && (
                                <div className="mt-1">
                                  <span className="text-xs text-muted-foreground mr-1">
                                    {t("orders.color")}:
                                  </span>
                                  <span className="text-xs font-medium">
                                    {item.colorName}
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {(
                              parseFloat(item.product.price) * item.quantity
                            ).toFixed(2)}{" "}
                            €
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order totals */}
                  <div className="mt-6 pt-6 border-t space-y-3">
                    {shouldShowTax() ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Nettobetrag</span>
                          <span>{calculateNetPrice(cartTotal).toFixed(2)} €</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">MwSt. ({parseFloat(calculateTax(cartTotal) > 0 ? ((calculateTax(cartTotal) / calculateNetPrice(cartTotal)) * 100).toFixed(0) : "0")}%)</span>
                          <span>{calculateTax(cartTotal).toFixed(2)} €</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Zwischensumme (inkl. MwSt.)</span>
                          <span>{calculateGrossPrice(cartTotal).toFixed(2)} €</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Zwischensumme</span>
                        <span>{cartTotal.toFixed(2)} €</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600">Versand:</span>
                      <span className={shipping === 0 ? "text-green-600" : ""}>
                        {shipping === 0
                          ? "Kostenlos"
                          : `${shipping.toFixed(2)} €`}
                      </span>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="font-medium">
                          {t("cart.discount")}
                        </span>
                        <span className="font-medium">
                          -{discountAmount.toFixed(2)} €
                        </span>
                      </div>
                    )}

                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>{t("orders.itemTotal")}</span>
                      <span>{total.toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Discount info */}
                  {hasDiscount && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                      {meetsMinimumOrder ? (
                        <p className="text-sm text-green-700 flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {t("checkout.discountApplied")}{" "}
                          {(user as any)?.discountType === "percentage"
                            ? `${user?.discountAmount}% (${discountAmount.toFixed(2)} €)`
                            : `${discountAmount.toFixed(2)} €`}
                        </p>
                      ) : (
                        <p className="text-sm text-amber-700 flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {t("checkout.discountNotApplied")}{" "}
                          {user?.discountAmount}
                          {(user as any)?.discountType === "percentage"
                            ? "%"
                            : "€"}{" "}
                          {t("checkout.discountMinimumOrder")}{" "}
                          {parseFloat(
                            user?.discountMinimumOrder || "0",
                          ).toFixed(2)}{" "}
                          €!
                        </p>
                      )}
                    </div>
                  )}

                  {/* Security note */}
                  <div className="mt-6 pt-4 border-t text-sm text-gray-500">
                    <div className="flex items-center mb-2">
                      <Lock size={14} className="mr-2" />
                      <span>{t("checkout.securePayment")}</span>
                    </div>
                    <p>{t("checkout.securePaymentDescription")}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
