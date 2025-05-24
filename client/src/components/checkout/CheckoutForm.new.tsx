import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings-api";
import StripePaymentElement from "@/components/payment/StripePaymentElement";
import StripeBuyButton from "@/components/payment/StripeBuyButton";
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
    paymentMethod: z.enum(["stripe", "cash", "pickup", "bank", "paypal", "klarna", "eps", "sofort"]),
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
  
  // Fetch payment settings
  const { data: paymentSettings } = useQuery({
    queryKey: ['/api/settings/payment'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/settings/payment");
      const data = await response.json();
      return data;
    }
  });
  
  // Convert settings to a simple object with keys and values
  const [paymentMethods, setPaymentMethods] = useState<Record<string, boolean>>({
    stripe: true,
    paypal: false,
    klarna: false,
    eps: false,
    bank: true,
    cash: true,
    pickup: true,
  });
  
  // Load payment settings from API
  useEffect(() => {
    if (paymentSettings) {
      const methods: Record<string, boolean> = {};
      paymentSettings.forEach((setting: any) => {
        // Convert setting names to simple keys (e.g. payment_stripe_enabled -> stripe)
        const methodKey = setting.key.replace('payment_', '').replace('_enabled', '');
        methods[methodKey] = setting.value === "true";
      });
      setPaymentMethods(methods);
      
      // If the currently selected payment method is disabled, set the first available one
      if (!methods[selectedPaymentMethod]) {
        const firstEnabled = Object.keys(methods).find(key => methods[key]);
        if (firstEnabled) {
          setSelectedPaymentMethod(firstEnabled);
        }
      }
    }
  }, [paymentSettings, selectedPaymentMethod]);

  // Get shipping settings
  const { data: freeShippingThresholdSetting } = getSetting(
    "freeShippingThreshold",
  );
  const { data: standardShippingRateSetting } = getSetting(
    "standardShippingRate",
  );

  // Get values from localStorage if they exist, otherwise use API values
  const localFreeShippingThreshold =
    typeof window !== "undefined"
      ? localStorage.getItem("freeShippingThreshold")
      : null;
  const localStandardShippingRate =
    typeof window !== "undefined"
      ? localStorage.getItem("standardShippingRate")
      : null;

  // Priority is localStorage values, then API values, then default values
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
    resolver: zodResolver(schema),
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
        title: "Warenkorb ist leer",
        description: "Bitte fügen Sie Produkte zu Ihrem Warenkorb hinzu, bevor Sie zur Kasse gehen.",
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
          scent: item.scent,
        }));

        // Calculate totals for the order
        const cartTotal = cartItems?.reduce((sum, item) => sum + (item.quantity * Number(item.product.price)), 0) || 0;
        const discountAmount = 0; // If you have discount logic, replace this
        const shippingCost = isFreeShipping ? 0 : Number(standardShippingRate);
        const orderTotal = cartTotal - discountAmount + shippingCost;
        
        // Store the order data in session to use later
        window.sessionStorage.setItem('pendingOrderData', JSON.stringify({
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
        productName: item.product.name, 
        quantity: item.quantity,
        price: item.product.price,
        scentId: item.scentId || null, 
        scentName: item.scent?.name || null, 
        colorId: item.colorId || null, 
        colorName: item.colorName || null, 
        colorIds: item.colorIds || null, 
        hasMultipleColors: item.hasMultipleColors || false, 
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

  // Stripe handlers
  const handleStripeSuccess = async (paymentIntent: any) => {
    console.log("Stripe payment successful", paymentIntent);
    setStripePaymentComplete(true);
    setIsSubmitting(true);

    try {
      // Get form values
      const formData = form.getValues();

      // Create order from form data and Stripe response
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

      // Create order data
      const orderData = {
        total: total.toString(),
        paymentMethod: "stripe",
        paymentStatus: "completed", // Stripe successful payment
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

      // Refresh cart (clear it)
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });

      // Update user address if checked
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

      // Success message
      toast({
        title: "Narudžba uspješno kreirana",
        description: `Vaša narudžba #${order.id} je uspješno zaprimljena. Zahvaljujemo na plaćanju.`,
      });

      // Redirect to success page
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
                    <Input placeholder="Ime" {...field} />
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
                    <Input placeholder="Prezime" {...field} />
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
                    <Input placeholder="email@example.com" {...field} />
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
                    <Input placeholder="+43 123 456 789" {...field} />
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
                    <Input placeholder="Ulica i broj" {...field} />
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
                <FormItem className="col-span-2">
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
                      <SelectItem value="Österreich">Österreich</SelectItem>
                      <SelectItem value="Deutschland">Deutschland</SelectItem>
                      <SelectItem value="Italien">Italien</SelectItem>
                      <SelectItem value="Kroatien">Kroatien</SelectItem>
                      <SelectItem value="Slowenien">Slowenien</SelectItem>
                      <SelectItem value="Ungarn">Ungarn</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customerNote"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Napomena (opciono)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Dodatne informacije za dostavu"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="saveAddress"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 col-span-2">
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
                  <div className="flex flex-col space-y-2">
                    {/* Stripe */}
                    {paymentMethods.stripe && (
                      <div
                        className={`flex items-center space-x-2 border rounded-lg p-4 ${
                          field.value === "stripe" 
                            ? "border-primary bg-accent bg-opacity-10" 
                            : "border-gray-200"
                        }`}
                      >
                        <input 
                          type="radio"
                          id="stripe"
                          value="stripe"
                          checked={field.value === "stripe"}
                          onChange={() => {
                            field.onChange("stripe");
                            setSelectedPaymentMethod("stripe");
                          }}
                          className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                        />
                        <label
                          htmlFor="stripe"
                          className="flex items-center cursor-pointer w-full"
                        >
                          <CreditCard className="mr-2 h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <span className="font-medium">Kreditkarte</span>
                            <p className="text-sm text-gray-500">
                              Visa, Mastercard, American Express
                            </p>
                          </div>
                        </label>
                      </div>
                    )}

                    {/* PayPal */}
                    {paymentMethods.paypal && (
                      <div
                        className={`flex items-center space-x-2 border rounded-lg p-4 ${
                          field.value === "paypal" 
                            ? "border-primary bg-accent bg-opacity-10" 
                            : "border-gray-200"
                        }`}
                      >
                        <input 
                          type="radio"
                          id="paypal"
                          value="paypal"
                          checked={field.value === "paypal"}
                          onChange={() => {
                            field.onChange("paypal");
                            setSelectedPaymentMethod("paypal");
                          }}
                          className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                        />
                        <label
                          htmlFor="paypal"
                          className="flex items-center cursor-pointer w-full"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-primary"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                          <div className="flex-1">
                            <span className="font-medium">PayPal</span>
                            <p className="text-sm text-gray-500">
                              Bezahlen Sie schnell und sicher mit PayPal
                            </p>
                          </div>
                        </label>
                      </div>
                    )}

                    {/* Bank Transfer */}
                    {paymentMethods.bank && (
                      <div
                        className={`flex items-center space-x-2 border rounded-lg p-4 ${
                          field.value === "bank" 
                            ? "border-primary bg-accent bg-opacity-10" 
                            : "border-gray-200"
                        }`}
                      >
                        <input 
                          type="radio"
                          id="bank"
                          value="bank"
                          checked={field.value === "bank"}
                          onChange={() => {
                            field.onChange("bank");
                            setSelectedPaymentMethod("bank");
                          }}
                          className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                        />
                        <label
                          htmlFor="bank"
                          className="flex items-center cursor-pointer w-full"
                        >
                          <Building className="mr-2 h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <span className="font-medium">Überweisung</span>
                            <p className="text-sm text-gray-500">
                              Bezahlen Sie per Banküberweisung
                            </p>
                          </div>
                        </label>
                      </div>
                    )}

                    {/* Cash on Delivery */}
                    {paymentMethods.cash && (
                      <div
                        className={`flex items-center space-x-2 border rounded-lg p-4 ${
                          field.value === "cash" 
                            ? "border-primary bg-accent bg-opacity-10" 
                            : "border-gray-200"
                        }`}
                      >
                        <input 
                          type="radio"
                          id="cash"
                          value="cash"
                          checked={field.value === "cash"}
                          onChange={() => {
                            field.onChange("cash");
                            setSelectedPaymentMethod("cash");
                          }}
                          className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                        />
                        <label
                          htmlFor="cash"
                          className="flex items-center cursor-pointer w-full"
                        >
                          <CheckCircle className="mr-2 h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <span className="font-medium">Nachnahme</span>
                            <p className="text-sm text-gray-500">
                              Bezahlung bei Lieferung an den Paketboten
                            </p>
                          </div>
                        </label>
                      </div>
                    )}

                    {/* In-store Pickup */}
                    {paymentMethods.pickup && (
                      <div
                        className={`flex items-center space-x-2 border rounded-lg p-4 ${
                          field.value === "pickup" 
                            ? "border-primary bg-accent bg-opacity-10" 
                            : "border-gray-200"
                        }`}
                      >
                        <input 
                          type="radio"
                          id="pickup"
                          value="pickup"
                          checked={field.value === "pickup"}
                          onChange={() => {
                            field.onChange("pickup");
                            setSelectedPaymentMethod("pickup");
                          }}
                          className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                        />
                        <label
                          htmlFor="pickup"
                          className="flex items-center cursor-pointer w-full"
                        >
                          <Building className="mr-2 h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <span className="font-medium">Abholung im Geschäft</span>
                            <p className="text-sm text-gray-500">
                              Zahlung bei Abholung in unserem Geschäft
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Payment method specific forms */}
          <div className="mt-4">
            {watchPaymentMethod === "stripe" && (
              <div className="space-y-4">
                {showStripeForm && clientSecret ? (
                  <div className="border rounded-lg p-4">
                    <StripePaymentElement
                      clientSecret={clientSecret}
                      onSuccess={handleStripeSuccess}
                      onError={handleStripeError}
                    />
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-2">
                      Sie werden nach dem Absenden des Formulars zur sicheren Zahlung weitergeleitet.
                    </p>
                  </div>
                )}
              </div>
            )}

            {(watchPaymentMethod === "bank" || watchPaymentMethod === "cash" || watchPaymentMethod === "pickup") && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  {watchPaymentMethod === "bank"
                    ? "Sie erhalten die Bankverbindung nach Bestellabschluss per E-Mail."
                    : watchPaymentMethod === "cash"
                      ? "Sie bezahlen bei Lieferung direkt an den Paketboten."
                      : "Sie bezahlen bei Abholung in unserem Geschäft."}
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Order summary */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Pregled narudžbe</h2>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Međuzbroj:</span>
              <span>{cartTotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Dostava:</span>
              <span>
                {isFreeShipping ? (
                  <span className="text-success">Besplatno</span>
                ) : (
                  `${shipping.toFixed(2)} €`
                )}
              </span>
            </div>
            <div className="flex justify-between font-medium text-lg pt-2 border-t">
              <span>Ukupno:</span>
              <span>{total.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting || (watchPaymentMethod === "stripe" && showStripeForm)}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Procesiranje...
              </>
            ) : watchPaymentMethod === "stripe" && !showStripeForm ? (
              "Nastavi na plaćanje"
            ) : (
              "Završi narudžbu"
            )}
          </Button>
          <p className="text-xs text-center mt-2 text-muted-foreground">
            Nastavkom potvrđujete da ste pročitali i slažete se s našim uvjetima
            korištenja.
          </p>
        </div>
      </form>
    </Form>
  );
}