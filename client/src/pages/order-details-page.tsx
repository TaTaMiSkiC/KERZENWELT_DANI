import { useEffect, useState } from "react"; // ✅ ISPRAVLJENO OVDJE: Uklonjeno "=>" i dodano "from"
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useParams, useLocation } from "wouter";
import {
  Order,
  OrderItem as OrderItemType,
  Product,
  Scent, // Dodano za dohvaćanje mirisa
  Color, // Dodano za dohvaćanje boja
  OrderItemWithProduct,
} from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Header from "@/components/layout/Header";
import {
  Loader2,
  ArrowLeft,
  PackageCheck,
  AlertTriangle,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  FileText,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Logo import
import logoImg from "@assets/Kerzenwelt by Dani.png";

// ✅ PROMJENA OVDJE: Koristimo RELATIVNU putanju do new-invoice-generator.tsx
// Pretpostavljena lokacija: client/src/pages/admin/new-invoice-generator.tsx
import {
  generateInvoicePdf,
  getPaymentMethodText as getPaymentMethodTextFromGenerator,
} from "../pages/admin/new-invoice-generator.tsx";

// Definicija strukture fakture
interface Invoice {
  id: number;
  invoiceNumber: string;
  orderId: number;
  // ostala polja nisu nužna za ovo rješenje
}

// Odvojeni interface bez nasljeđivanja za rješavanje tipova
interface OrderWithItems {
  id: number;
  userId: number;
  status: string;
  total: string;
  createdAt: Date;
  items: OrderItemWithProduct[];
  subtotal?: string | null;
  discountAmount?: string | null;
  discountType?: string | null;
  discountPercentage?: string | null;
  shippingCost?: string | null;
  paymentMethod?: string;
  paymentStatus?: string;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  shippingFullName?: string | null;
  shippingPhone?: string | null; // ✅ DODANO: Telefonski broj
  transactionId?: string | null;
  customerNote?: string | null;
  // Dodano polje za fakturu
  invoice?: Invoice | null;
}

function OrderStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case "processing":
      return <PackageCheck className="h-5 w-5 text-blue-500" />;
    case "shipped":
      return <Truck className="h-5 w-5 text-blue-700" />;
    case "delivered":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "cancelled":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  }
}

function OrderStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";

  switch (status) {
    case "pending":
      variant = "outline";
      break;
    case "processing":
      variant = "secondary";
      break;
    case "cancelled":
      variant = "destructive";
      break;
    default:
      variant = "default";
      break;
  }

  return (
    <Badge variant={variant} className="ml-2">
      <OrderStatusIcon status={status} />
      <span className="ml-1">{getStatusText(status, t)}</span>
    </Badge>
  );
}

function getStatusText(status: string, t: (key: string) => string): string {
  switch (status) {
    case "pending":
      return t("orders.pending");
    case "processing":
      return t("orders.processing");
    case "shipped":
      return t("orders.shipped");
    case "delivered":
      return t("orders.delivered");
    case "cancelled":
      return t("orders.cancelled");
    default:
      return status;
  }
}

export default function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { language, t, setLanguage } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<
    "hr" | "en" | "de" | "it" | "sl"
  >(language as "hr" | "en" | "de" | "it" | "sl");
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // Dohvat narudžbe
  const {
    data: order,
    isLoading: isLoadingOrder,
    error: orderError,
  } = useQuery<Order>({
    queryKey: [`/api/orders/${orderId}`],
    enabled: !!user && !!orderId,
  });

  // Dohvat stavki narudžbe
  const {
    data: orderItems,
    isLoading: isLoadingItems,
    error: itemsError,
  } = useQuery<OrderItemWithProduct[]>({
    queryKey: [`/api/orders/${orderId}/items`],
    enabled: !!user && !!orderId,
  });

  // Dohvat svih proizvoda
  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!user,
  });

  // Dohvat fakture za narudžbu
  const {
    data: invoice,
    isLoading: isLoadingInvoice,
    error: invoiceError,
  } = useQuery<Invoice | null>({
    queryKey: [`/api/orders/${orderId}/invoice`],
    enabled: !!user && !!orderId,
  });

  // Kombiniranje podataka o narudžbi i stavkama
  const orderWithItems: OrderWithItems | undefined =
    order && orderItems
      ? {
          ...order,
          items: orderItems || [],
          invoice: invoice,
        }
      : undefined;

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  // Efekt koji sinkronizira globalni jezik s odabranim jezikom za PDF
  useEffect(() => {
    setSelectedLanguage(language as "hr" | "en" | "de" | "it" | "sl");
  }, [language]);

  const isLoading =
    isLoadingOrder || isLoadingItems || isLoadingProducts || isLoadingInvoice;
  const error = orderError || itemsError || invoiceError;

  // Funkcija za prevođenje načina plaćanja koristeći globalni sustav za prijevode
  // ✅ PROMJENA OVDJE: Koristimo getPaymentMethodText iz new-invoice-generator
  const getPaymentMethodText = (method: string | undefined, lang: string) => {
    // Ovdje je t funkcija iz useLanguage hooka
    return getPaymentMethodTextFromGenerator(method || "", lang, t);
  };

  // Funkcija za generiranje PDF računa
  const generateInvoice = () => {
    if (!orderWithItems || !user) return;

    setGeneratingInvoice(true);

    // Dodajmo dodatno logiranje
    console.log("Podaci o narudžbi:", JSON.stringify(orderWithItems));
    console.log(
      "Način plaćanja:",
      orderWithItems.paymentMethod || "Nije definirano",
    );

    // Sigurna provjera stavki narudžbe
    if (
      !orderWithItems.items ||
      !Array.isArray(orderWithItems.items) ||
      orderWithItems.items.length === 0
    ) {
      console.error(
        "Nema stavki narudžbe ili nije ispravan format:",
        orderWithItems.items,
      );
      toast({
        title: t("orders.invoiceGenerationError"),
        description: t("orders.noOrderItemsForInvoice"),
        variant: "destructive",
      });
      setGeneratingInvoice(false);
      return;
    }

    try {
      // Određivanje jezika računa
      const lang = selectedLanguage || "hr";

      // Priprema podataka za PDF sa svim potrebnim poljima
      const invoiceData = {
        invoiceNumber:
          orderWithItems.invoice?.invoiceNumber || `i${orderWithItems.id}`,
        createdAt: orderWithItems.createdAt,
        // PODACI O KUPCU - BITNO DA SU SVI OVDJE I SIGURNI
        customerName:
          orderWithItems.shippingFullName ||
          `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        customerEmail: user.email || "",
        customerAddress: orderWithItems.shippingAddress || user.address || "",
        customerCity: orderWithItems.shippingCity || user.city || "",
        customerPostalCode:
          orderWithItems.shippingPostalCode || user.postalCode || "",
        customerCountry: orderWithItems.shippingCountry || user.country || "",
        customerPhone: orderWithItems.shippingPhone || user.phone || "", // ✅ DODANO: Telefonski broj
        customerNote: orderWithItems.customerNote || "",
        // OSTALI PODACI
        items: orderWithItems.items, // Stavke su već obogaćene u orderWithItems
        language: lang,
        paymentMethod: orderWithItems.paymentMethod || "bank_transfer",
        paymentStatus: orderWithItems.paymentStatus || "unpaid",
        // Iznosi (total, subtotal, discount, shipping, tax)
        subtotal: parseFloat(orderWithItems.subtotal || "0"),
        shippingCost: parseFloat(orderWithItems.shippingCost || "0"),
        discountAmount: parseFloat(orderWithItems.discountAmount || "0"), // ✅ DODANO: Iznos popusta
        discountType: orderWithItems.discountType || "fixed", // ✅ DODANO: Tip popusta
        discountPercentage: parseFloat(
          orderWithItems.discountPercentage || "0",
        ), // ✅ DODANO: Postotak popusta
        tax: parseFloat(orderWithItems.taxAmount || "0"), // Koristimo taxAmount ako postoji, inače 0
        total: parseFloat(orderWithItems.total || "0"),
      };

      console.log("Preparing data for PDF:", invoiceData);
      // ✅ PROMJENA OVDJE: Pozivamo generateInvoicePdf iz new-invoice-generator
      generateInvoicePdf(invoiceData, toast);

      toast({
        title: "Uspjeh",
        description: "Račun je uspješno generiran",
      });
    } catch (error) {
      console.error("Greška pri generiranju PDF-a:", error);
      toast({
        title: "Greška pri generiranju računa",
        description:
          "Došlo je do pogreške prilikom generiranja računa. Pokušajte ponovno kasnije.",
        variant: "destructive",
      });
    } finally {
      setGeneratingInvoice(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !orderWithItems) {
    return (
      <div className="container mx-auto py-10 flex flex-col justify-center items-center min-h-[60vh]">
        {" "}
        {/* AŽURIRANO: Dodan min-h-[60vh] i centriranje */}
        <h2 className="text-2xl font-bold mb-4">
          Greška pri učitavanju narudžbe
        </h2>
        <p className="mb-4">
          Došlo je do greške prilikom učitavanja podataka o narudžbi.
        </p>
        <Button variant="outline" onClick={() => navigate("/orders")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Povratak na popis narudžbi
        </Button>
      </div>
    );
  }

  const totalItems = orderWithItems.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return (
    <>
      <Helmet>
        <title>{`Narudžba #${orderWithItems.id} | Kerzenwelt by Dani`}</title>
        <meta
          name="description"
          content={`Detalji narudžbe #${orderWithItems.id} - Kerzenwelt by Dani`}
        />
      </Helmet>

      <Header />

      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            {t("orders.order")} #{orderWithItems.id}
            <OrderStatusBadge status={orderWithItems.status} />
          </h1>

          <Button variant="outline" onClick={() => navigate("/orders")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("orders.backToOrders")}
          </Button>
        </div>

        {orderWithItems && (
          <div className="flex items-center gap-3">
            <Select
              value={selectedLanguage}
              onValueChange={(value: "hr" | "en" | "de" | "it" | "sl") =>
                setSelectedLanguage(value)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("orders.invoiceLanguage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hr">{t("languages.croatian")}</SelectItem>
                <SelectItem value="en">{t("languages.english")}</SelectItem>
                <SelectItem value="de">{t("languages.german")}</SelectItem>
                <SelectItem value="it">{t("languages.italian")}</SelectItem>
                <SelectItem value="sl">{t("languages.slovenian")}</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={generateInvoice} disabled={generatingInvoice}>
              {generatingInvoice ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("orders.generating")}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {t("orders.downloadInvoice")}
                </>
              )}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("orders.orderDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("orders.date")}:
                </span>
                <span>
                  {format(
                    new Date(orderWithItems.createdAt),
                    "dd.MM.yyyy. HH:mm",
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("orders.status")}:
                </span>
                <span className="flex items-center">
                  <OrderStatusIcon status={orderWithItems.status} />
                  <span className="ml-2">
                    {getStatusText(orderWithItems.status, t)}
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("orders.totalItems")}:
                </span>
                <span>{totalItems}</span>
              </div>

              {orderWithItems.invoice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("orders.invoiceNumber")}:
                  </span>
                  <span className="font-medium text-primary">
                    {orderWithItems.invoice.invoiceNumber}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("orders.paymentMethod")}:
                </span>
                <span>
                  {orderWithItems.paymentMethod
                    ? getPaymentMethodText(
                        orderWithItems.paymentMethod,
                        language as "hr" | "en" | "de" | "it" | "sl",
                      )
                    : t("orders.notSpecified")}
                </span>
              </div>
              {orderWithItems.paymentStatus && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("orders.paymentStatus")}:
                  </span>
                  <span>
                    {orderWithItems.paymentStatus === "completed"
                      ? t("orders.paid")
                      : t("orders.pending")}
                  </span>
                </div>
              )}
              {orderWithItems.transactionId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("orders.transactionId")}:
                  </span>
                  <span className="font-mono text-xs">
                    {orderWithItems.transactionId}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("orders.shipping")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {orderWithItems.shippingFullName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("orders.name")}:
                  </span>
                  <span>{orderWithItems.shippingFullName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("orders.address")}:
                </span>
                <span>{orderWithItems.shippingAddress || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("orders.city")}:
                </span>
                <span>{orderWithItems.shippingCity || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("orders.postalCode")}:
                </span>
                <span>{orderWithItems.shippingPostalCode || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("orders.country")}:
                </span>
                <span>{orderWithItems.shippingCountry || "N/A"}</span>
              </div>
              {orderWithItems.shippingPhone && ( // ✅ DODANO: Prikaz telefona
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("orders.phone")}:
                  </span>
                  <span>{orderWithItems.shippingPhone}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {orderWithItems.customerNote && (
            <Card>
              <CardHeader>
                <CardTitle>{t("orders.customerNote")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-neutral-50 rounded-md border border-neutral-100 text-neutral-800">
                  {orderWithItems.customerNote}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("orders.priceSummary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("orders.subtotal")}:
                </span>
                <span>{orderWithItems.subtotal || "0.00"} €</span>
              </div>
              {orderWithItems.discountAmount &&
                parseFloat(orderWithItems.discountAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("cart.discount")}:{" "}
                      {/* ✅ PROMJENA: Koristi t("cart.discount") */}
                    </span>
                    <span className="text-red-500">
                      {
                        (orderWithItems as any).discountType === "percentage"
                          ? `-${parseFloat((orderWithItems as any).discountPercentage || 0).toFixed(0)}% = -${parseFloat(orderWithItems.discountAmount).toFixed(2)} €` // ✅ PROMJENA: Oduzmi popust i prikaži postotak
                          : `-${parseFloat(orderWithItems.discountAmount).toFixed(2)} €` // ✅ PROMJENA: Prikaz fiksnog popusta
                      }
                    </span>
                  </div>
                )}
              {orderWithItems.shippingCost && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("admin.orders.shippingCost")}:
                  </span>
                  <span>
                    {parseFloat(orderWithItems.shippingCost).toFixed(2)} €
                  </span>{" "}
                  {/* ✅ PROMJENA: Osiguraj formatiranje */}
                </div>
              )}
              {orderWithItems.taxAmount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("orders.tax")}:
                  </span>
                  <span>
                    {parseFloat(orderWithItems.taxAmount).toFixed(2)} €
                  </span>{" "}
                  {/* ✅ PROMJENA: Osiguraj formatiranje */}
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>{t("orders.total")}:</span>
                <span>
                  {parseFloat(orderWithItems.total).toFixed(2)} €
                </span>{" "}
                {/* ✅ PROMJENA: Osiguraj formatiranje */}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("orders.orderItems")}</CardTitle>
            <CardDescription>
              {orderWithItems.items.length}{" "}
              {orderWithItems.items.length === 1
                ? t("orders.product")
                : t("orders.products")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]"></TableHead>
                  <TableHead className="w-[200px]">
                    {t("orders.product")}
                  </TableHead>
                  <TableHead className="w-[250px]">
                    {t("orders.details")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("orders.quantity")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("orders.price")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("orders.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderWithItems.items.map((item) => {
                  console.log("Order item debug:", {
                    id: item.id,
                    scentName: item.scentName,
                    colorName: item.colorName,
                    colorIds: item.colorIds,
                    hasMultipleColors: item.hasMultipleColors,
                  });

                  const productName = item.product?.name || t("orders.product");
                  const scent = item.scentName || "";
                  const color = item.colorName || "";
                  const itemTotal = parseFloat(item.price) * item.quantity;
                  const imageUrl = item.product?.imageUrl || null;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="align-middle">
                        {imageUrl && (
                          <div className="relative h-16 w-16 rounded-md overflow-hidden">
                            <img
                              src={imageUrl}
                              alt={productName}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="font-medium">{productName}</div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col gap-1">
                          {/* Prikaz mirisa */}
                          {scent && (
                            <div className="inline-flex items-center text-sm bg-amber-50 rounded-full px-2 py-0.5 border border-amber-100">
                              <span className="font-medium text-amber-800 mr-1">
                                {t("orders.scent")}:
                              </span>{" "}
                              {scent}
                            </div>
                          )}

                          {/* Prikaz jedne boje */}
                          {color && !item.hasMultipleColors && (
                            <div className="inline-flex items-center text-sm bg-blue-50 rounded-full px-2 py-0.5 border border-blue-100">
                              <span className="font-medium text-blue-800 mr-1">
                                {t("orders.color")}:
                              </span>
                              {products
                                ?.flatMap((p) =>
                                  p.id === item.productId
                                    ? (p as any).colors || []
                                    : [],
                                )
                                .find((c) => c?.name === color)?.hexValue ? (
                                <div
                                  className="w-3 h-3 rounded-full inline-block border border-gray-200 mx-1"
                                  style={{
                                    backgroundColor: products
                                      ?.flatMap((p) =>
                                        p.id === item.productId
                                          ? (p as any).colors || []
                                          : [],
                                      )
                                      .find((c) => c?.name === color)?.hexValue,
                                  }}
                                />
                              ) : null}
                              {color}
                            </div>
                          )}

                          {/* Prikaz višestrukih boja */}
                          {item.hasMultipleColors && item.colorIds && (
                            <div className="flex flex-col gap-1">
                              <div className="inline-flex items-center text-sm bg-purple-50 rounded-full px-2 py-0.5 border border-purple-100">
                                <span className="font-medium text-purple-800 mr-1">
                                  {t("orders.colors")}:
                                </span>
                                {(() => {
                                  try {
                                    const colorIds = JSON.parse(item.colorIds);
                                    if (Array.isArray(colorIds)) {
                                      // Jednostavno mapiranje za poznate boje
                                      const colorMap: {
                                        [key: number]: string;
                                      } = {
                                        // Dodana eksplicitna tipizacija
                                        1: "Weiß",
                                        2: "Beige",
                                        3: "Golden",
                                        5: "Rot",
                                        6: "Grün",
                                        7: "Blau",
                                        8: "Gelb",
                                        9: "Lila",
                                        10: "Rosa",
                                        11: "Schwarz",
                                        12: "Orange",
                                        13: "Braun",
                                      };
                                      const colorNames = colorIds.map(
                                        (colorId) =>
                                          colorMap[colorId] ||
                                          `Farbe ${colorId}`,
                                      );
                                      return colorNames.join(", ");
                                    }
                                  } catch (e) {
                                    console.error(
                                      "Error parsing colorIds in PDF:",
                                      e,
                                    );
                                  }
                                  return item.colorName || "Ausgewählte Farben";
                                })()}
                              </div>

                              {/* Prikaz indikatori boja */}
                              {item.colorIds && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(() => {
                                    try {
                                      // Pokušaj parsirati colorIds string
                                      const colorIdArray = JSON.parse(
                                        item.colorIds,
                                      );

                                      // Ako je uspješno parsirano, prikaži indikatore boja
                                      if (Array.isArray(colorIdArray)) {
                                        return colorIdArray.map((colorId) => {
                                          // Pronađi informacije o boji u proizvodima
                                          const colorInfo = products
                                            ?.flatMap((p) =>
                                              p.id === item.productId
                                                ? (p as any).colors || []
                                                : [],
                                            )
                                            .find((c) => c?.id === colorId);

                                          if (colorInfo?.hexValue) {
                                            return (
                                              <div
                                                key={colorId}
                                                className="w-4 h-4 rounded-full inline-block border border-gray-300"
                                                style={{
                                                  backgroundColor:
                                                    colorInfo.hexValue,
                                                }}
                                                title={colorInfo.name}
                                              />
                                            );
                                          }
                                          return null;
                                        });
                                      }
                                    } catch (e) {
                                      console.error(
                                        "Greška pri parsiranju colorIds:",
                                        e,
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Falback za stare načine prikaza (ako postoji) */}
                          {item.hasMultipleColors &&
                            color &&
                            !item.colorIds && (
                              <div className="inline-flex items-center text-sm bg-blue-50 rounded-full px-2 py-0.5 border border-blue-100 flex-wrap">
                                <span className="font-medium text-blue-800 mr-1">
                                  {t("orders.colors")}:
                                </span>
                                {color.split(",").map((colorName, index) => {
                                  const trimmedColor = colorName.trim();
                                  const productColor = products
                                    ?.flatMap((p) =>
                                      p.id === item.productId
                                        ? (p as any).colors || []
                                        : [],
                                    )
                                    .find((c) => c?.name === trimmedColor);

                                  return (
                                    <span
                                      key={index}
                                      className="inline-flex items-center mx-0.5"
                                    >
                                      {productColor?.hexValue && (
                                        <div
                                          className="w-3 h-3 rounded-full inline-block border border-gray-200 mr-0.5"
                                          style={{
                                            backgroundColor:
                                              productColor.hexValue,
                                          }}
                                        />
                                      )}
                                      {trimmedColor}
                                      {index < color.split(",").length - 1
                                        ? ","
                                        : ""}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        {parseFloat(item.price).toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        {itemTotal.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="border-t p-4 flex justify-end">
            <div className="text-sm text-muted-foreground">
              {t("orders.pricesIncludeTax")}
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
