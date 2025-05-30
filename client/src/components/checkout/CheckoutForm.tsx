import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
// ✅ PROMJENA OVDJE: Uklonjen je useSettings jer se propovi prosljeđuju
// import { useSettings } from "@/hooks/use-settings-api";
import StripePaymentElement from "@/components/payment/StripePaymentElement";
import StripeBuyButton from "@/components/payment/StripeBuyButton";
import PayPalButton from "@/components/PayPalButton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { initiateStripeCheckout } from "@/lib/stripeCheckout";
import { useLocation } from "wouter";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, CheckCircle, Building, LoaderCircle } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

// Define a type for translation function
type TFunction = (key: string) => string;

const checkoutSchema = (t: TFunction) =>
  z.object({
    firstName: z.string().min(2, t("checkout.firstNameRequired")),
    lastName: z.string().min(2, t("checkout.lastNameRequired")),
    email: z.string().email(t("checkout.invalidEmail")),
    phone: z.string().min(8, t("checkout.phoneRequired")),
    address: z.string().min(5, t("checkout.addressRequired")),
    city: z.string().min(2, t("checkout.cityRequired")),
    postalCode: z.string().min(4, t("checkout.postalCodeRequired")),
    country: z.string().min(2, t("checkout.countryRequired")),
    customerNote: z.string().optional(),
    paymentMethod: z.enum([
      "stripe",
      "cash",
      "pickup",
      "bank",
      "paypal",
      "klarna",
      "eps",
      "sofort",
      "nachnahme", // ⬅️ dodano
    ]),
    saveAddress: z.boolean().optional(),
    sameAsBilling: z.boolean().optional(),
  });

type CheckoutFormValues = z.infer<ReturnType<typeof checkoutSchema>>;

// ✅ PROMJENA OVDJE: Dodajte props za freeShippingThreshold i standardShippingRate
interface CheckoutFormProps {
  freeShippingThreshold: number;
  standardShippingRate: number;
}

export default function CheckoutForm({
  freeShippingThreshold,
  standardShippingRate,
}: CheckoutFormProps) {
  const { user } = useAuth();
  const { cartItems, cartTotal } = useCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  // ✅ PROMJENA OVDJE: Uklonjen je useSettings() poziv jer se postavke prosljeđuju kao propovi
  // const { getSetting } = useSettings();
  const { t, translateText } = useLanguage();
  const schema = checkoutSchema(t);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>("stripe");
  const [stripePaymentComplete, setStripePaymentComplete] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [showStripeForm, setShowStripeForm] = useState(false);

  // ✅ PROMJENA OVDJE: Više ne dohvaćamo postavke, koristimo propove
  // const { data: freeShippingThresholdSetting } = getSetting(
  //   "freeShippingThreshold",
  // );
  // const { data: standardShippingRateSetting } = getSetting(
  //   "standardShippingRate",
  // );

  // ✅ PROMJENA OVDJE: Uklonjeno dohvaćanje iz localStorage i API-ja, koristimo propove
  // const localFreeShippingThreshold =
  //   typeof window !== "undefined"
  //     ? localStorage.getItem("freeShippingThreshold")
  //     : null;
  // const localStandardShippingRate =
  //   typeof window !== "undefined"
  //     ? localStorage.getItem("standardShippingRate")
  //     : null;

  // ✅ PROMJENA OVDJE: Vrijednosti se sada dobivaju iz propova
  // const freeShippingThreshold = parseFloat(
  //   localFreeShippingThreshold || freeShippingThresholdSetting?.value || "50",
  // );
  // const standardShippingRate = parseFloat(
  //   localStandardShippingRate || standardShippingRateSetting?.value || "5",
  // );

  // Check if user has a valid discount
  // PREMJEŠTENO OVDJE DA BUDE DOSTUPNO NA RAZINI KOMPONENTE
  const hasDiscount =
    user &&
    user.discountAmount &&
    parseFloat(user.discountAmount) > 0 &&
    user.discountExpiryDate &&
    new Date(user.discountExpiryDate) > new Date();

  // Check if order meets minimum requirement for discount
  // PREMJEŠTENO OVDJE
  const meetsMinimumOrder =
    !user?.discountMinimumOrder ||
    parseFloat(user.discountMinimumOrder || "0") <= cartTotal;

  // Apply discount if valid
  // PREMJEŠTENO OVDJE
  const discountAmount =
    hasDiscount && meetsMinimumOrder
      ? (user as any)?.discountType === "percentage"
        ? (cartTotal * parseFloat(user.discountAmount || "0")) / 100
        : parseFloat(user.discountAmount || "0")
      : 0;

  // Calculate shipping and total
  const isFreeShipping =
    standardShippingRate === 0 || // ✅ KORISTIMO standardShippingRate IZ PROPOVA
    (cartTotal >= freeShippingThreshold && freeShippingThreshold > 0); // ✅ KORISTIMO freeShippingThreshold IZ PROPOVA
  const shipping = isFreeShipping ? 0 : standardShippingRate;
  const total = Math.max(0, cartTotal + shipping - discountAmount); // AŽURIRANO: oduzmi popust

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(schema), // ✅ ispravljen resolver
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
      city: user?.city || "",
      postalCode: user?.postalCode || "",
      country: user?.country || "Österreich",
      customerNote: "",
      paymentMethod: "stripe",
      saveAddress: true,
      sameAsBilling: true,
    },
  });

  // Helper function to submit orders from different payment methods
  const submitOrder = async (data: any, paymentMethod: string = "unknown") => {
    try {
      setIsSubmitting(true);

      // Get the cart items to create order items
      const orderItems =
        cartItems?.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.product.price,
          scentId: item.scentId,
          colorId: item.colorId,
          colorIds: item.colorIds,
          hasMultipleColors: item.hasMultipleColors,
        })) || [];

      // Add shipping cost if necessary
      const isFreeShipping =
        standardShippingRate === 0 || // ✅ KORISTIMO standardShippingRate IZ PROPOVA
        (cartTotal >= freeShippingThreshold && freeShippingThreshold > 0); // ✅ KORISTIMO freeShippingThreshold IZ PROPOVA
      const shippingCost = isFreeShipping ? 0 : standardShippingRate;

      // Apply discount if valid - handle percentage vs fixed discounts
      let discountAmount = 0;
      if (hasDiscount && meetsMinimumOrder) {
        const discountValue = parseFloat(user.discountAmount || "0");
        const discountType = (user as any).discountType || "fixed";

        if (discountType === "percentage") {
          // For percentage discounts, calculate the actual discount amount
          discountAmount = (cartTotal * discountValue) / 100;
          console.log(
            `Frontend: Applied ${discountValue}% discount = ${discountAmount.toFixed(2)}€ on cart total ${cartTotal}€`,
          );
        } else {
          // For fixed discounts, use the amount directly
          discountAmount = Math.min(discountValue, cartTotal);
          console.log(
            `Frontend: Applied fixed discount = ${discountAmount.toFixed(2)}€`,
          );
        }
      }

      // Create final order data
      const orderData = {
        ...data,
        total: (cartTotal + shippingCost - discountAmount).toString(),
        subtotal: cartTotal.toString(),
        discountAmount: discountAmount.toString(),
        discountType:
          hasDiscount && meetsMinimumOrder
            ? (user as any).discountType || "fixed"
            : "fixed",
        discountPercentage:
          hasDiscount &&
          meetsMinimumOrder &&
          (user as any).discountType === "percentage"
            ? parseFloat(user.discountAmount || "0").toString()
            : "0",
        shippingCost: shippingCost.toString(),
        items: orderItems,
        paymentMethod: paymentMethod || data.paymentMethod,
      };

      console.log("Submitting order with payment method:", paymentMethod);
      console.log("Order data:", orderData);

      // Submit order to API
      const response = await apiRequest("POST", "/api/orders", orderData);

      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}: ${await response.text()}`,
        );
      }

      const order = await response.json();

      // Clear cart after successful order
      await queryClient.invalidateQueries({ queryKey: ["/api/cart"] });

      // Update user address if saveAddress is checked
      if (data.saveAddress && user) {
        await apiRequest("PATCH", `/api/users/${user.id}`, {
          address: data.address,
          city: data.city,
          postalCode: data.postalCode,
          country: data.country,
        });
      }

      // Navigate to success page
      navigate(`/order-success/${order.id}`);

      return order;
    } catch (error) {
      console.error("Error submitting order:", error);
      toast({
        title: "Fehler",
        description:
          "Beim Erstellen Ihrer Bestellung ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: CheckoutFormValues) => {
    // ... (provjere za nachnahme i praznu košaricu) ...

    setIsSubmitting(true);

    try {
      // 1. Kreiraj PRED-NARUDŽBU u vašoj bazi sa statusom 'pending'
      const orderItems =
        cartItems?.map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          scentId: item.scentId || null,
          scentName: item.scent?.name || null,
          colorId: item.colorId || null,
          colorName: item.colorName || null,
          colorIds: item.colorIds || null,
          hasMultipleColors: item.hasMultipleColors || false,
        })) || [];

      // Calculate any discounts
      const hasDiscount =
        user &&
        user.discountAmount &&
        parseFloat(user.discountAmount) > 0 &&
        user.discountExpiryDate &&
        new Date(user.discountExpiryDate) > new Date();

      const meetsMinimumOrder =
        !user?.discountMinimumOrder ||
        parseFloat(user.discountMinimumOrder || "0") <= cartTotal;

      // Apply discount if valid - handle percentage vs fixed discounts (same logic as submitOrder)
      let discountAmount = 0;
      if (hasDiscount && meetsMinimumOrder) {
        const discountValue = parseFloat(user.discountAmount || "0");
        const discountType = (user as any).discountType || "fixed";

        if (discountType === "percentage") {
          // For percentage discounts, calculate the actual discount amount
          discountAmount = (cartTotal * discountValue) / 100;
          console.log(
            `Frontend onSubmit: Applied ${discountValue}% discount = ${discountAmount.toFixed(2)}€ on cart total ${cartTotal}€`,
          );
        } else {
          // For fixed discounts, use the amount directly
          discountAmount = Math.min(discountValue, cartTotal);
          console.log(
            `Frontend onSubmit: Applied fixed discount = ${discountAmount.toFixed(2)}€`,
          );
        }
      }

      const shippingCost = isFreeShipping ? 0 : standardShippingRate; // ✅ KORISTIMO isFreeShipping i standardShippingRate IZ PROPOVA
      const orderTotal = Math.max(0, cartTotal + shippingCost - discountAmount);

      const orderData = {
        total: orderTotal.toString(),
        subtotal: cartTotal.toString(),
        discountAmount: discountAmount.toString(),
        discountType:
          hasDiscount && meetsMinimumOrder
            ? (user as any).discountType || "fixed"
            : "fixed",
        discountPercentage:
          hasDiscount &&
          meetsMinimumOrder &&
          (user as any).discountType === "percentage"
            ? parseFloat(user.discountAmount || "0").toString()
            : "0",
        shippingCost: shippingCost.toString(),
        paymentMethod: data.paymentMethod,
        paymentStatus: "pending",
        shippingAddress: data.address,
        shippingCity: data.city,
        shippingPostalCode: data.postalCode,
        shippingCountry: data.country,
        customerNote: data.customerNote,
        items: orderItems,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        saveAddress: data.saveAddress,
      };

      // Obradi metode plaćanja
      if (
        data.paymentMethod === "stripe" ||
        data.paymentMethod === "paypal" ||
        data.paymentMethod === "klarna" ||
        data.paymentMethod === "eps" ||
        data.paymentMethod === "sofort"
      ) {
        // Za Stripe plaćanje - NE kreiraj narudžbu odmah!
        // Pohrani podatke u sessionStorage za Stripe webhook
        window.sessionStorage.setItem(
          "stripeOrderData",
          JSON.stringify(orderData),
        );

        // Iniciraj Stripe checkout bez kreiranja narudžbe
        await initiateStripeCheckout(
          total,
          data.paymentMethod,
          undefined, // Nema orderId jer narudžba još nije kreirana
        );
        return; // Stripe preuzima kontrolu
      } else {
        // Za ostale metode plaćanja - kreiraj narudžbu odmah
        console.log("Kreiram narudžbu za metodu plaćanja:", data.paymentMethod);
        const orderResponse = await apiRequest(
          "POST",
          "/api/orders",
          orderData,
        );
        const order = await orderResponse.json();

        if (!order.id) {
          throw new Error("Nije uspjelo kreiranje narudžbe.");
        }

        // Očisti košaricu
        await queryClient.invalidateQueries({ queryKey: ["/api/cart"] });

        // Ažuriraj korisnikovu adresu ako je potrebno
        if (data.saveAddress && user) {
          await apiRequest("PUT", "/api/user", {
            firstName: data.firstName,
            lastName: data.lastName,
            address: data.address,
            city: data.city,
            postalCode: data.postalCode,
            country: data.country,
            phone: data.phone,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }

        navigate(`/order-success?orderId=${order.id}`);
      }
    } catch (error) {
      console.error(
        "Greška pri kreiranju narudžbe ili iniciranju plaćanja:",
        error,
      );
      toast({
        title: "Fehler",
        description:
          "Beim Erstellen der Bestellung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false); // Ovo će se izvršiti samo ako nema preusmjeravanja
    }
  };

  const watchPaymentMethod = form.watch("paymentMethod");

  // Stripe handleri
  const handleStripeSuccess = async (paymentIntent: any) => {
    console.log("Stripe payment successful", paymentIntent);
    setStripePaymentComplete(true);
    setIsSubmitting(true);

    try {
      // Preuzmite vrijednosti obrasca
      const formData = form.getValues();

      // Kreirajte narudžbu na temelju podataka obrasca i Stripe odgovora
      const orderItems =
        cartItems?.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.product.price,
          scentId: item.scentId || null,
          scentName: item.scent?.name || null,
          colorId: item.colorId || null,
          colorName: item.colorName || null,
          colorIds: item.colorIds || null,
          hasMultipleColors: item.hasMultipleColors || false,
        })) || [];

      // Kreirajte podatke narudžbe
      const orderData = {
        total: total.toString(),
        paymentMethod: "stripe",
        paymentStatus: "completed", // Stripe uspješno plaćanje
        shippingAddress: formData.address,
        shippingCity: formData.city,
        shippingPostalCode: formData.postalCode,
        shippingCountry: formData.country,
        customerNote: formData.customerNote,
        items: orderItems,
        stripePaymentIntentId: paymentIntent.id,
      };

      const response = await apiRequest("POST", "/api/orders", orderData);
      const order = await response.json();

      // Osvježi košaricu (očisti ju)
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });

      // Updejtaj korisnikovu adresu ako je označeno
      if (formData.saveAddress && user) {
        await apiRequest("PUT", "/api/user", {
          firstName: formData.firstName,
          lastName: formData.lastName,
          address: formData.address,
          city: formData.city,
          postalCode: formData.postalCode,
          country: formData.country,
          phone: formData.phone,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      }

      // Poruka o uspjehu
      toast({
        title: "Bestellung erfolgreich erstellt",
        description: `Ihre Bestellung #${order.id} wurde erfolgreich empfangen. Vielen Dank für Ihre Zahlung..`,
      });

      // Preusmjeravanje na stranicu uspjeha
      navigate(`/order-success?orderId=${order.id}`);
    } catch (error) {
      console.error("Error creating order after Stripe payment:", error);
      toast({
        title: "Fehler beim Erstellen der Bestellung",
        description:
          "Die Zahlung war erfolgreich, jedoch ist beim Erstellen der Bestellung ein Fehler aufgetreten. Kontaktieren Sie uns, wenn Sie Hilfe benötigen.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStripeError = (error: any) => {
    console.error("Stripe payment error", error);
    toast({
      title: "Zahlungsfehler",
      description:
        "Bei der Zahlungsabwicklung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
      variant: "destructive",
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Billing information */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {t("checkout.personalInfo")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("checkout.firstName")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("checkout.firstName")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("checkout.lastName")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("checkout.lastName")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("checkout.email")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("checkout.email")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("checkout.phone")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("checkout.phone")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>{t("checkout.address")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("checkout.address")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("checkout.city")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("checkout.city")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("checkout.postalCode")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("checkout.postalCode")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("checkout.country")} *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("checkout.country")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Kroatien">Kroatien</SelectItem>
                      <SelectItem value="Slovenien">Slovenien</SelectItem>
                      <SelectItem value="Österreich">Österreich</SelectItem>
                      <SelectItem value="Deutschland">Deutschland</SelectItem>
                      <SelectItem value="Italien">Italien</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Polje za napomenu kupca */}
          <div className="mt-4 col-span-2">
            <FormField
              control={form.control}
              name="customerNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("checkout.orderNotes")}</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder={t("checkout.orderNotesPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {/* {t("checkout.orderNotesDescription")} */}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="mt-4">
            <FormField
              control={form.control}
              name="saveAddress"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t("checkout.saveAddress")}</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Payment method */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {t("checkout.paymentMethod")}
          </h2>

          <FormField
            control={form.control}
            name="paymentMethod"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={(value: string) => {
                      field.onChange(value);
                      setSelectedPaymentMethod(value);
                    }}
                    className="flex flex-col space-y-2"
                  >
                    {/* Kreditna kartica (Stripe) */}
                    <div
                      className={`flex items-center space-x-2 border rounded-lg p-4 ${field.value === "stripe" ? "border-primary bg-accent bg-opacity-10" : "border-gray-200"}`}
                    >
                      <RadioGroupItem value="stripe" id="stripe" />
                      <label
                        htmlFor="stripe"
                        className="flex items-center cursor-pointer w-full"
                      >
                        <CreditCard className="mr-2 h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <span className="font-medium">Online Banking</span>
                          <p className="text-sm text-gray-500">
                            Visa, Mastercard, American Express
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg"
                            alt="Visa"
                            className="h-6"
                          />
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg"
                            alt="Mastercard"
                            className="h-6"
                          />
                        </div>
                      </label>
                    </div>

                    {/* PayPal */}
                    <div
                      className={`flex items-center space-x-2 border rounded-lg p-4 ${field.value === "paypal" ? "border-primary bg-accent bg-opacity-10" : "border-gray-200"}`}
                    >
                      <RadioGroupItem value="paypal" id="paypal" />
                      <label
                        htmlFor="paypal"
                        className="flex items-center cursor-pointer w-full"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-2 text-primary"
                        >
                          <rect width="20" height="14" x="2" y="5" rx="2" />
                          <line x1="2" x2="22" y1="10" y2="10" />
                        </svg>
                        <div className="flex-1">
                          <span className="font-medium">PayPal</span>
                          <p className="text-sm text-gray-500">
                            Bezahlen Sie schnell und sicher mit PayPal
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <img
                            src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg"
                            alt="PayPal"
                            className="h-6"
                          />
                        </div>
                      </label>
                    </div>

                    {/* Klarna */}
                    <div
                      className={`flex items-center space-x-2 border rounded-lg p-4 ${field.value === "klarna" ? "border-primary bg-accent bg-opacity-10" : "border-gray-200"}`}
                    >
                      <RadioGroupItem value="klarna" id="klarna" />
                      <label
                        htmlFor="klarna"
                        className="flex items-center cursor-pointer w-full"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-2 text-primary"
                        >
                          <rect width="20" height="14" x="2" y="5" rx="2" />
                          <line x1="2" x2="22" y1="10" y2="10" />
                        </svg>
                        <div className="flex-1">
                          <span className="font-medium">Klarna</span>
                          <p className="text-sm text-gray-500">
                            Bezahlen Sie mit Klarna
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/4/40/Klarna_Payment_Badge.svg"
                            alt="Klarna"
                            className="h-6"
                          />
                        </div>
                      </label>
                    </div>

                    {/* EPS Online Banking */}
                    <div
                      className={`flex items-center space-x-2 border rounded-lg p-4 ${field.value === "eps" ? "border-primary bg-accent bg-opacity-10" : "border-gray-200"}`}
                    >
                      <RadioGroupItem value="eps" id="eps" />
                      <label
                        htmlFor="eps"
                        className="flex items-center cursor-pointer w-full"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-2 text-primary"
                        >
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        <div className="flex-1">
                          <span className="font-medium">EPS</span>
                          <p className="text-sm text-gray-500">
                            Online Banking (Österreich)
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Eps-%C3%9Cberweisung_Logo.svg/1200px-Eps-%C3%9Cberweisung_Logo.svg.png"
                            alt="EPS"
                            className="h-6"
                          />
                        </div>
                      </label>
                    </div>

                    {/* Online Banking */}
                    {/* <div
                      className={`flex items-center space-x-2 border rounded-lg p-4 ${field.value === "sofort" ? "border-primary bg-accent bg-opacity-10" : "border-gray-200"}`}
                    >
                      <RadioGroupItem value="sofort" id="sofort" />
                      <label
                        htmlFor="sofort"
                        className="flex items-center cursor-pointer w-full"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-2 text-primary"
                        >
                          <path d="M6 9h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
                          <path d="M18 4H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                        </svg>
                        <div className="flex-1">
                          <span className="font-medium">Online Banking</span>
                          <p className="text-sm text-gray-500">
                            Sofortüberweisung
                          </p>
                        </div>
                      </label>
                    </div> */}

                    {/* Bankovna transakcija */}
                    {/* <div
                      className={`flex items-center space-x-2 border rounded-lg p-4 ${field.value === "bank" ? "border-primary bg-accent bg-opacity-10" : "border-gray-200"}`}
                    >
                      <RadioGroupItem value="bank" id="bank" />
                      <label
                        htmlFor="bank"
                        className="flex items-center cursor-pointer w-full"
                      >
                        <Building className="mr-2 h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <span className="font-medium">Banküberweisung</span>
                          <p className="text-sm text-gray-500">
                            Zahlen Sie per Überweisung
                          </p>
                        </div>
                      </label>
                    </div> */}

                    {/* Gotovina */}
                    {form.watch("country") === "Österreich" && (
                      <div
                        className={`flex items-center space-x-2 border rounded-lg p-4 ${
                          field.value === "nachnahme"
                            ? "border-primary bg-accent bg-opacity-10"
                            : "border-gray-200"
                        }`}
                      >
                        <RadioGroupItem value="nachnahme" id="nachnahme" />
                        <label
                          htmlFor="nachnahme"
                          className="flex items-center cursor-pointer w-full"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-2 text-primary"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l3 3" />
                          </svg>
                          <div className="flex-1">
                            <span className="font-medium">Nachnahme</span>
                            <p className="text-sm text-gray-500">
                              Bezahlung bei Lieferung (nur in Österreich)
                            </p>
                          </div>
                        </label>
                      </div>
                    )}

                    {/* Preuzimanje u trgovini */}
                    {/* <div
                      className={`flex items-center space-x-2 border rounded-lg p-4 ${field.value === "pickup" ? "border-primary bg-accent bg-opacity-10" : "border-gray-200"}`}
                    >
                      <RadioGroupItem value="pickup" id="pickup" />
                      <label
                        htmlFor="pickup"
                        className="flex items-center cursor-pointer w-full"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-2 text-primary"
                        >
                          <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
                          <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
                          <path d="M12 3v6" />
                        </svg>
                        <div className="flex-1">
                          <span className="font-medium">
                            {t("checkout.paymentMethods.pickup.title")}
                          </span>
                          <p className="text-sm text-gray-500">
                            {t("checkout.paymentMethods.pickup.description")}
                          </p>
                        </div>
                      </label>
                    </div> */}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Payment method specific forms */}
          <div className="mt-4">
            {
              watchPaymentMethod === "stripe" ||
                watchPaymentMethod === "paypal" ||
                watchPaymentMethod === "klarna" ||
                watchPaymentMethod === "eps" ||
                watchPaymentMethod === "sofort"
              // <div className="space-y-4">
              //   <div className="mt-4">
              //     {watchPaymentMethod === "paypal" && (
              //       <PayPalButton
              //         amount={total.toFixed(2)}
              //         currency="EUR"
              //         intent="CAPTURE"
              //         onPaymentSuccess={(data) => {
              //           console.log("PayPal payment successful", data);
              //           toast({
              //             title: "Zahlung erfolgreich",
              //             description:
              //               "Ihre Bestellung wurde erfolgreich aufgegeben.",
              //           });

              //           // Get the form values
              //           const formValues = form.getValues();

              //           // Create order with PayPal payment info
              //           const orderData = {
              //             ...formValues,
              //             paymentMethod: "paypal",
              //             paymentStatus: "paid",
              //             paypalOrderId: data.id,
              //           };

              //           // Submit order
              //           submitOrder(orderData, "paypal").then((result) => {
              //             if (result && result.id) {
              //               // Navigate to success page with order ID
              //               navigate(
              //                 `/order-success/${result.id}?paymentMethod=paypal`,
              //               );
              //             }
              //           });
              //         }}
              //         onPaymentError={(error) => {
              //           console.error("PayPal payment error", error);
              //           toast({
              //             title: "Fehler",
              //             description:
              //               "Bei der Verarbeitung Ihrer PayPal-Zahlung ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
              //             variant: "destructive",
              //           });
              //         }}
              //       />
              //     )}
              //   </div>
              // </div>
            }

            {watchPaymentMethod === "cash" && (
              <div className="border rounded-lg p-4 bg-neutral">
                <p className="text-sm mb-4">
                  {t("checkout.paymentMethods.cash.description")}
                </p>
                <div className="bg-background rounded-md p-4">
                  <p className="text-sm font-medium">
                    {t("checkout.paymentMethods.cash.instructions")}
                  </p>
                </div>
              </div>
            )}

            {watchPaymentMethod === "pickup" && (
              <div className="border rounded-lg p-4 bg-neutral">
                <p className="text-sm mb-4">
                  {t("checkout.paymentMethods.pickup.description")}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium w-32">
                      {t("admin.shopName")}:
                    </span>
                    <span>Kerzenwelt by Dani</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium w-32">
                      {t("checkout.address")}:
                    </span>
                    <span>Ossiacher Zeile 30, 9500 Villach, Österreich</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium w-32">
                      {t("checkout.mondayToFriday")}:
                    </span>
                    <span>
                      13:00 - 18:00
                      {/* <br />
                      {t("checkout.saturday")}: 9:00 - 13:00 */}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {watchPaymentMethod === "bank" && (
              <div className="border rounded-lg p-4 bg-neutral">
                <p className="text-sm mb-4">
                  {t("checkout.paymentMethods.bank.description")}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium w-32">
                      {t("checkout.recipient")}:
                    </span>
                    <span>Kerzenwelt by Dani</span>
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
                    <span>[broj narudžbe]</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium w-32">Opis plaćanja:</span>
                    <span>Kerzenwelt narudžba</span>
                  </div>
                </div>
                <p className="text-sm mt-4">
                  Narudžba će biti poslana nakon što primimo uplatu.
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Summary and submit */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {t("cart.orderSummary")}
          </h2>

          <div className="bg-neutral rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">{t("checkout.subtotal")}:</span>
              <span>{cartTotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Versand:</span>
              <span>
                {shipping === 0
                  ? t("cart.shippingFree")
                  : `${shipping.toFixed(2)} €`}
              </span>
            </div>

            {/* DODANI DIO ZA POPUST */}
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="font-medium">
                  {t("cart.discount")} {/* Koristi prevođenje za "Rabatt" */}
                </span>
                <span className="font-medium">
                  -{discountAmount.toFixed(2)} €
                </span>
              </div>
            )}
            {/* KRAJ DODANOG DIJELA */}

            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>{t("orders.itemTotal")}:</span>
              <span>{total.toFixed(2)} €</span>
            </div>
          </div>

          <div className="mt-6">
            <FormField
              control={form.control}
              name="sameAsBilling"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Ich stimme zu{" "}
                      <a href="/terms" className="text-primary hover:underline">
                        Nutzungsbedingungen
                      </a>{" "}
                      und{" "}
                      <a
                        href="/privacy"
                        className="text-primary hover:underline"
                      >
                        Datenschutzrichtlinie
                      </a>
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            className="w-full mt-6"
            size="lg"
            disabled={isSubmitting || !form.getValues("sameAsBilling")}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Laden...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-5 w-5" />
                {t("checkout.placeOrder")}
              </>
            )}
          </Button>

          <p className="text-sm text-gray-500 text-center mt-4">
            {t("checkout.securePaymentDescription")}
          </p>
        </div>
      </form>
    </Form>
  );
}
