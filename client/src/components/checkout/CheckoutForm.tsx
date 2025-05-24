import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings-api";
import StripePaymentElement from "@/components/payment/StripePaymentElement";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
    paymentMethod: z.enum(["stripe", "cash", "pickup", "bank"]),
    saveAddress: z.boolean().optional(),
    sameAsBilling: z.boolean().optional(),
  });

type CheckoutFormValues = z.infer<ReturnType<typeof checkoutSchema>>;

export default function CheckoutForm() {
  const { user } = useAuth();
  const { cartItems, cartTotal } = useCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { getSetting } = useSettings();
  const { t, translateText } = useLanguage();
  const schema = checkoutSchema(t);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("stripe");
  const [stripePaymentComplete, setStripePaymentComplete] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [showStripeForm, setShowStripeForm] = useState(false);

  // Dohvati postavke za dostavu
  const { data: freeShippingThresholdSetting } = getSetting(
    "freeShippingThreshold",
  );
  const { data: standardShippingRateSetting } = getSetting(
    "standardShippingRate",
  );

  // Dohvati vrijednosti iz localStorage ako postoje, inače koristi API vrijednosti
  const localFreeShippingThreshold =
    typeof window !== "undefined"
      ? localStorage.getItem("freeShippingThreshold")
      : null;
  const localStandardShippingRate =
    typeof window !== "undefined"
      ? localStorage.getItem("standardShippingRate")
      : null;

  // Prioritet imaju localStorage vrijednosti, zatim API vrijednosti, i na kraju defaultne vrijednosti
  const freeShippingThreshold = parseFloat(
    localFreeShippingThreshold || freeShippingThresholdSetting?.value || "50",
  );
  const standardShippingRate = parseFloat(
    localStandardShippingRate || standardShippingRateSetting?.value || "5",
  );

  // Calculate shipping and total
  const isFreeShipping =
    standardShippingRate === 0 ||
    (cartTotal >= freeShippingThreshold && freeShippingThreshold > 0);
  const shipping = isFreeShipping ? 0 : standardShippingRate;
  const total = cartTotal + shipping;

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

  const onSubmit = async (data: CheckoutFormValues) => {
    if (!cartItems || cartItems.length === 0) {
      toast({
        title: t("checkout.emptyCart"),
        description: t("checkout.emptyCartDescription"),
        variant: "destructive",
      });
      return;
    }

    // If Stripe is selected as payment method and payment is not complete yet
    if (data.paymentMethod === "stripe" && !stripePaymentComplete) {
      setIsSubmitting(true);
      
      try {
        // Create a preliminary order to get an order ID
        const orderItems = cartItems?.map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          hasMultipleColors: item.hasMultipleColors,
          selectedColorsCount: item.selectedColorsCount,
          colorInfo: item.colorInfo,
          scent: item.scent,
        }));

        // Calculate totals for the order
        const cartTotal = calculateCartTotal(cartItems);
        const discountAmount = calculateDiscount(cartTotal, discountCode);
        const shippingCost = isFreeShipping ? 0 : standardShippingRate;
        const orderTotal = cartTotal - discountAmount + shippingCost;
        
        // Store the order data in session to use later
        sessionStorage.setItem('pendingOrderData', JSON.stringify({
          data,
          orderItems,
          cartTotal,
          discountAmount,
          shippingCost,
          orderTotal
        }));
        
        // Create the payment intent with Stripe
        const response = await apiRequest("POST", "/api/create-payment-intent", {
          amount: orderTotal,
          orderId: 'pending' // We'll update this with the real order ID after payment
        });
        
        const responseData = await response.json();
        setClientSecret(responseData.clientSecret);
        setShowStripeForm(true);
        setIsSubmitting(false);
        
        toast({
          title: "Zahlungsinformationen",
          description: "Bitte schließen Sie den Zahlungsvorgang ab, um Ihre Bestellung zu bestätigen.",
        });
        
        return; // Exit early to wait for Stripe payment completion
      } catch (error) {
        console.error("Error creating payment intent:", error);
        toast({
          title: "Zahlungsfehler",
          description: "Bei der Verarbeitung Ihrer Zahlung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Create order items from cart items
      const orderItems = cartItems?.map((item) => ({
        productId: item.productId,
        productName: item.product.name, // Dodajemo ime proizvoda
        quantity: item.quantity,
        price: item.product.price,
        scentId: item.scentId || null, // Prenosimo ID mirisa
        scentName: item.scent?.name || null, // Prenosimo naziv mirisa iz objekta scent
        colorId: item.colorId || null, // Prenosimo ID boje
        colorName: item.colorName || null, // Prenosimo naziv boje
        colorIds: item.colorIds || null, // Prenosimo niz ID-jeva boja
        hasMultipleColors: item.hasMultipleColors || false, // Prenosimo zastavicu za višestruke boje
      }));

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
          ? parseFloat(user.discountAmount || "0")
          : 0;

      // Calculate shipping
      const isFreeShipping =
        standardShippingRate === 0 ||
        (cartTotal >= freeShippingThreshold && freeShippingThreshold > 0);
      const shippingCost = isFreeShipping ? 0 : standardShippingRate;

      // Calculate final total
      const orderTotal = Math.max(0, cartTotal + shippingCost - discountAmount);

      // Create order
      const orderData = {
        total: orderTotal.toString(),
        subtotal: cartTotal.toString(),
        discountAmount: discountAmount.toString(),
        shippingCost: shippingCost.toString(),
        paymentMethod: data.paymentMethod,
        paymentStatus:
          data.paymentMethod === "bank" || data.paymentMethod === "cash" || data.paymentMethod === "pickup" ? "pending" : "completed",
        shippingAddress: data.address,
        shippingCity: data.city,
        shippingPostalCode: data.postalCode,
        shippingCountry: data.country,
        customerNote: data.customerNote,
        items: orderItems,
      };

      const response = await apiRequest("POST", "/api/orders", orderData);
      const order = await response.json();

      // Update user address if saveAddress is checked
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

        // Invalidate user data to refresh it
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      }

      // Success message
      toast({
        title: "Narudžba uspješno kreirana",
        description: `Vaša narudžba #${order.id} je uspješno zaprimljena.`,
      });

      // Redirect to success page
      navigate(`/order-success?orderId=${order.id}`);
    } catch (error) {
      toast({
        title: "Greška",
        description:
          "Došlo je do greške prilikom kreiranja narudžbe. Pokušajte ponovno.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
        title: "Narudžba uspješno kreirana",
        description: `Vaša narudžba #${order.id} je uspješno zaprimljena. Zahvaljujemo na plaćanju.`,
      });

      // Preusmjeravanje na stranicu uspjeha
      navigate(`/order-success?orderId=${order.id}`);
    } catch (error) {
      console.error("Error creating order after Stripe payment:", error);
      toast({
        title: "Greška pri kreiranju narudžbe",
        description:
          "Plaćanje je bilo uspješno, ali došlo je do greške prilikom kreiranja narudžbe. Kontaktirajte nas za pomoć.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStripeError = (error: any) => {
    console.error("Stripe payment error", error);
    toast({
      title: "Greška pri plaćanju",
      description:
        "Došlo je do greške prilikom procesiranja plaćanja. Molimo pokušajte ponovno.",
      variant: "destructive",
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Billing information */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Podaci za dostavu</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ime *</FormLabel>
                  <FormControl>
                    <Input placeholder="Vaše ime" {...field} />
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
                  <FormLabel>Prezime *</FormLabel>
                  <FormControl>
                    <Input placeholder="Vaše prezime" {...field} />
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
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input placeholder="vasa.email@primjer.com" {...field} />
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
                  <FormLabel>Telefon *</FormLabel>
                  <FormControl>
                    <Input placeholder="Vaš telefonski broj" {...field} />
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
                  <FormLabel>Adresa *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ulica i kućni broj" {...field} />
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
                  <FormLabel>Grad *</FormLabel>
                  <FormControl>
                    <Input placeholder="Grad" {...field} />
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
                  <FormLabel>Poštanski broj *</FormLabel>
                  <FormControl>
                    <Input placeholder="Poštanski broj" {...field} />
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
                  <FormLabel>Država *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Odaberite državu" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Hrvatska">Hrvatska</SelectItem>
                      <SelectItem value="Slovenija">Slovenija</SelectItem>
                      <SelectItem value="Austrija">Austrija</SelectItem>
                      <SelectItem value="Njemačka">Njemačka</SelectItem>
                      <SelectItem value="Italija">Italija</SelectItem>
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
                  <FormLabel>Napomena (opcionalno)</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Dodajte napomenu za narudžbu (npr. specifične upute za dostavu ili dodatne zahtjeve)"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Napomena će biti vidljiva na vašoj narudžbi i računu.
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
                    <FormLabel>Spremi adresu za buduće narudžbe</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Payment method */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Način plaćanja</h2>

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
                          <span className="font-medium">Online Zahlung (Stripe)</span>
                          <p className="text-sm text-gray-500">
                            Visa, Mastercard, American Express, Klarna, PayPal, EPS, Online Banking
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

                    <div
                      className={`flex items-center space-x-2 border rounded-lg p-4 ${field.value === "cash" ? "border-primary bg-accent bg-opacity-10" : "border-gray-200"}`}
                    >
                      <RadioGroupItem value="cash" id="cash" />
                      <label
                        htmlFor="cash"
                        className="flex items-center cursor-pointer w-full"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-primary"><circle cx="12" cy="12" r="8"/><path d="M12 6v6l4 2"/></svg>
                        <div className="flex-1">
                          <span className="font-medium">{t('checkout.paymentMethods.cash.title')}</span>
                          <p className="text-sm text-gray-500">
                            {t('checkout.paymentMethods.cash.description')}
                          </p>
                        </div>
                      </label>
                    </div>

                    <div
                      className={`flex items-center space-x-2 border rounded-lg p-4 ${field.value === "pickup" ? "border-primary bg-accent bg-opacity-10" : "border-gray-200"}`}
                    >
                      <RadioGroupItem value="pickup" id="pickup" />
                      <label
                        htmlFor="pickup"
                        className="flex items-center cursor-pointer w-full"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-primary"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>
                        <div className="flex-1">
                          <span className="font-medium">{t('checkout.paymentMethods.pickup.title')}</span>
                          <p className="text-sm text-gray-500">
                            {t('checkout.paymentMethods.pickup.description')}
                          </p>
                        </div>
                      </label>
                    </div>

                    <div
                      className={`flex items-center space-x-2 border rounded-lg p-4 ${field.value === "bank" ? "border-primary bg-accent bg-opacity-10" : "border-gray-200"}`}
                    >
                      <RadioGroupItem
                        value="bank"
                        id="bank"
                      />
                      <label
                        htmlFor="bank"
                        className="flex items-center cursor-pointer w-full"
                      >
                        <Building className="mr-2 h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <span className="font-medium">
                            {t('checkout.paymentMethods.bank.title')}
                          </span>
                          <p className="text-sm text-gray-500">
                            Podaci za plaćanje bit će poslani na vaš email
                          </p>
                        </div>
                      </label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Payment method specific forms */}
          <div className="mt-4">
            {watchPaymentMethod === "stripe" && (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-neutral">
                  <div className="flex flex-wrap gap-3 mb-4">
                    <img src="https://cdn.visa.com/v2/assets/images/logos/visa/blue/logo.png" alt="Visa" className="h-8" />
                    <img src="https://www.mastercard.com/content/dam/public/mastercardcom/eu/de/logos/mc-logo-52.svg" alt="Mastercard" className="h-8" />
                    <img src="https://cdn.freebiesupply.com/logos/large/2x/american-express-logo-png-transparent.png" alt="Amex" className="h-8" />
                    <img src="https://www.klarna.com/assets/sites/5/2020/04/27140600/Klarna-LogoRGB-Black.jpg" alt="Klarna" className="h-8" />
                    <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg" alt="PayPal" className="h-8" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/EPS-payment-system-logo.svg/1280px-EPS-payment-system-logo.svg.png" alt="EPS" className="h-8" />
                  </div>
                  <p className="text-sm mb-3">Wählen Sie Ihre bevorzugte Zahlungsmethode im nächsten Schritt aus:</p>
                  <ul className="text-sm list-disc pl-5 space-y-1">
                    <li>Kreditkarte (Visa, Mastercard, American Express)</li>
                    <li>Klarna</li>
                    <li>PayPal</li>
                    <li>EPS Online Banking</li>
                    <li>Sofortüberweisung</li>
                    <li>Banküberweisung (SEPA)</li>
                  </ul>
                  <div className="bg-background rounded-md p-4 mt-4">
                    <p className="text-sm">
                      Alle Zahlungsdaten werden sicher über eine verschlüsselte Verbindung übertragen.
                    </p>
                  </div>
                </div>
                
                {showStripeForm && clientSecret && (
                  <div className="mt-4">
                    <StripePaymentElement 
                      clientSecret={clientSecret}
                      onSuccess={(paymentIntent) => {
                        setStripePaymentComplete(true);
                        // Continue with checkout form submission
                        form.handleSubmit(onSubmit)();
                      }}
                      onError={(error) => {
                        toast({
                          title: "Zahlungsfehler",
                          description: error.message,
                          variant: "destructive",
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {watchPaymentMethod === "cash" && (
              <div className="border rounded-lg p-4 bg-neutral">
                <p className="text-sm mb-4">
                  {t('checkout.paymentMethods.cash.description')}
                </p>
                <div className="bg-background rounded-md p-4">
                  <p className="text-sm font-medium">{t('checkout.paymentMethods.cash.instructions')}</p>
                </div>
              </div>
            )}

            {watchPaymentMethod === "pickup" && (
              <div className="border rounded-lg p-4 bg-neutral">
                <p className="text-sm mb-4">
                  {t('checkout.paymentMethods.pickup.description')}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium w-32">{t('checkout.storeLocation')}:</span>
                    <span>Kerzenwelt by Dani</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium w-32">{t('checkout.address')}:</span>
                    <span>Widmanngasse 37, 9500 Villach, Österreich</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium w-32">{t('checkout.businessHours')}:</span>
                    <span>
                      {t('checkout.mondayToFriday')}: 9:00 - 18:00<br />
                      {t('checkout.saturday')}: 9:00 - 13:00
                    </span>
                  </div>
                </div>
              </div>
            )}

            {watchPaymentMethod === "bank" && (
              <div className="border rounded-lg p-4 bg-neutral">
                <p className="text-sm mb-4">
                  {t('checkout.paymentMethods.bank.description')}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium w-32">{t('checkout.recipient')}:</span>
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
          <h2 className="text-xl font-semibold mb-4">Pregled narudžbe</h2>

          <div className="bg-neutral rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Međuzbroj:</span>
              <span>{cartTotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Dostava:</span>
              <span>
                {shipping === 0 ? "Besplatno" : `${shipping.toFixed(2)} €`}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Ukupno:</span>
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
                      Slažem se s{" "}
                      <a href="/terms" className="text-primary hover:underline">
                        uvjetima korištenja
                      </a>{" "}
                      i{" "}
                      <a
                        href="/privacy"
                        className="text-primary hover:underline"
                      >
                        politikom privatnosti
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
            disabled={
              isSubmitting ||
              !form.getValues("sameAsBilling")
            }
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Obrada...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-5 w-5" />
                Potvrdi narudžbu
              </>
            )}
          </Button>

          <p className="text-sm text-gray-500 text-center mt-4">
            Vaši podaci su sigurni i šifrirani. Nikada nećemo dijeliti vaše
            podatke s trećim stranama.
          </p>
        </div>
      </form>
    </Form>
  );
}
