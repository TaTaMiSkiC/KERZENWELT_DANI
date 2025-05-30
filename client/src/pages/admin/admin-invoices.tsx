// admin-invoices.tsx

import React, { useState, useCallback } from "react"; // Dodan useState i useCallback
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import {
  Plus,
  FileText,
  Trash2,
  Download,
  ShoppingCart,
  Upload,
  File,
  Calendar,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/hooks/use-language";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Order, Product, Scent, Color } from "@shared/schema";
import logoImg from "@assets/Kerzenwelt by Dani.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import DocumentManager from "@/components/admin/DocumentManager";
import { buildInvoiceData, generateInvoicePdf } from "./new-invoice-generator";

// ✅ VAŽNA PROMJENA: Dodajte useGetSetting i useSettingValue u import
import {
  useSettings,
  useGetSetting,
  useSettingValue,
} from "@/hooks/use-settings-api";

// Helper funkcija za generiranje broja računa
const createInvoiceNumber = async (orderId?: number) => {
  // Generiranje broja računa u formatu i450, i451, itd.
  try {
    const response = await fetch("/api/invoices/last");
    const lastInvoice = await response.json();

    console.log("Last invoice retrieved:", lastInvoice);

    if (lastInvoice && lastInvoice.invoiceNumber) {
      // Parsiraj postojeći broj računa
      const currentNumber = lastInvoice.invoiceNumber.substring(1); // Isključi 'i' prefiks
      const nextNumber = parseInt(currentNumber) + 1;
      return `i${nextNumber}`;
    } else {
      // Ako nema postojećih računa, počni od 450
      return "i450";
    }
  } catch (error) {
    console.error("Error retrieving last invoice number:", error);
    return orderId ? `i${orderId + 450}` : "i450";
  }
};

// Komponenta za odabir jezika računa
function LanguageSelector({
  invoice,
  onSelectLanguage,
}: {
  invoice: any;
  onSelectLanguage: (invoice: any, language: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {t("admin.invoices.downloadPdf")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onSelectLanguage(invoice, "hr")}>
          <img
            src="https://flagcdn.com/24x18/hr.png"
            width="24"
            height="18"
            alt="Croatian flag"
            className="mr-2"
          />
          {t("languages.croatian")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectLanguage(invoice, "en")}>
          <img
            src="https://flagcdn.com/24x18/gb.png"
            width="24"
            height="18"
            alt="English flag"
            className="mr-2"
          />
          {t("languages.english")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectLanguage(invoice, "de")}>
          <img
            src="https://flagcdn.com/24x18/de.png"
            width="24"
            height="18"
            alt="German flag"
            className="mr-2"
          />
          {t("languages.german")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectLanguage(invoice, "it")}>
          <img
            src="https://flagcdn.com/24x18/it.png"
            width="24"
            height="18"
            alt="Italian flag"
            className="mr-2"
          />
          {t("languages.italian")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectLanguage(invoice, "sl")}>
          <img
            src="https://flagcdn.com/24x18/si.png"
            width="24"
            height="18"
            alt="Slovenian flag"
          />
          {t("languages.slovenian")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Tipovi za račune
interface Invoice {
  id: number;
  invoiceNumber: string;
  orderId: number;
  userId: number;
  customerName: string; // Npr. "Ime Prezime"
  customerEmail: string | null; // Može biti null
  customerAddress: string | null;
  customerCity: string | null;
  customerPostalCode: string | null;
  customerCountry: string | null;
  customerPhone: string | null;
  customerNote: string | null;
  paymentMethod: string;
  total: string;
  subtotal: string;
  tax: string;
  language: string;
  createdAt: string;
  // Dodano: za popust
  discountAmount?: string | null;
  discountType?: string | null;
  discountPercentage?: string | null;
  shippingCost?: string | null;
}

// Odabrani proizvod
interface SelectedProduct {
  id: number;
  name: string;
  price: string;
  quantity: number;
  scentId?: number | null;
  scentName?: string | null;
  colorId?: number | null;
  colorName?: string | null;
  colorIds?: string | null;
  hasMultipleColors?: boolean;
}

// Shema za kreiranje računa
const createInvoiceSchema = z.object({
  firstName: z.string().min(1, "admin.invoices.firstNameRequired"),
  lastName: z.string().min(1, "admin.invoices.lastNameRequired"),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  email: z.string().email("admin.invoices.invalidEmail").optional(),
  phone: z.string().optional(),
  invoiceNumber: z.string().min(1, "admin.invoices.invoiceNumberRequired"),
  paymentMethod: z.string().min(1, "admin.invoices.paymentMethodRequired"),
  language: z.string().min(1, "admin.invoices.languageRequired"),
  customerNote: z.string().optional(),
});

// Tipovi za formu
type CreateInvoiceFormValues = z.infer<typeof createInvoiceSchema>;

// Komponenta za cijeli modul računa za administratore
export default function AdminInvoices() {
  const [activeTab, setActiveTab] = useState<string>("existing");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    [],
  );
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // ✅ NOVI POZIVI HOOKOVA ZA DOHVAĆANJE SPECIFIČNIH POSTAVKI
  // Koristimo useSettingValue za dohvaćanje samo vrijednosti postavke
  const defaultFreeShippingThreshold = parseFloat(
    useSettingValue("freeShippingThreshold", "50"), // Default "50" ako postavka ne postoji
  );
  const defaultStandardShippingRate = parseFloat(
    useSettingValue("standardShippingRate", "5"), // Default "5" ako postavka ne postoji
  );

  const [useFreeShipping, setUseFreeShipping] = useState(false);
  const [manualShippingCost, setManualShippingCost] = useState<string>("5.00");
  const [manualDiscountAmount, setManualDiscountAmount] =
    useState<string>("0.00");

  const subtotalProducts = selectedProducts.reduce(
    (sum, p) => sum + parseFloat(p.price) * p.quantity,
    0,
  );
  const currentShippingCost = useFreeShipping
    ? 0
    : parseFloat(manualShippingCost || "0");
  const currentDiscountAmount = parseFloat(manualDiscountAmount || "0");

  // Dohvati račune
  const { data: invoices = [], refetch: refetchInvoices } = useQuery<Invoice[]>(
    {
      queryKey: ["/api/invoices"],
    },
  );

  // Dohvati narudžbe
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Forma za kreiranje računa
  const form = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: async () => {
      // Dohvati početni broj računa
      const invoiceNumber = await createInvoiceNumber();

      return {
        firstName: "",
        lastName: "",
        address: "",
        city: "",
        postalCode: "",
        country: "",
        email: "",
        phone: "",
        invoiceNumber,
        language: "hr",
        paymentMethod: "cash",
      };
    },
  });

  const generatePdf = useCallback(
    (rawData: any) => {
      const invoiceData = buildInvoiceData(rawData); // Priprema podataka
      generateInvoicePdf(invoiceData, toast); // Generiraj PDF
    },
    [toast],
  );

  // Dodaj proizvod na listu
  const addProduct = (product: SelectedProduct) => {
    setSelectedProducts([...selectedProducts, product]);
  };

  // Ukloni proizvod s liste
  const removeProduct = (index: number) => {
    const newProducts = [...selectedProducts];
    newProducts.splice(index, 1);
    setSelectedProducts(newProducts);
  };

  // Postavi podatke iz narudžbe
  const setOrderData = (order: any) => {
    setSelectedOrder(order);

    // Dohvati korisničke podatke iz API-ja
    const userId = order.userId;
    if (userId) {
      // Ovdje bismo mogli dohvatiti korisničke podatke iz API-ja
      // Za sada samo postavljamo dostupne vrijednosti
      form.setValue("firstName", order.firstName || "");
      form.setValue("lastName", order.lastName || "");
      form.setValue("address", order.shippingAddress || ""); // Koristi shippingAddress
      form.setValue("city", order.shippingCity || ""); // Koristi shippingCity
      form.setValue("postalCode", order.shippingPostalCode || ""); // Koristi shippingPostalCode
      form.setValue("country", order.shippingCountry || ""); // Koristi shippingCountry
      form.setValue("email", order.customerEmail || ""); // Koristi customerEmail ako postoji u Order
      form.setValue("phone", order.customerPhone || ""); // Koristi customerPhone
      form.setValue("paymentMethod", order.paymentMethod || "cash");
      form.setValue("customerNote", order.customerNote || ""); // Dodaj customerNote
    }

    // Postavi proizvode iz narudžbe
    apiRequest("GET", `/api/orders/${order.id}/items`)
      .then((response) => response.json())
      .then((items) => {
        console.log("Order items retrieved:", items);

        // Pripremi odabrane proizvode za račun
        const orderProducts: SelectedProduct[] = items.map((item: any) => ({
          id: item.productId,
          name: item.productName,
          price: item.price,
          quantity: item.quantity,
          scentId: item.scentId,
          scentName: item.scentName,
          colorId: item.colorId,
          colorName: item.colorName,
          colorIds: item.colorIds,
          hasMultipleColors: item.hasMultipleColors,
        }));

        setSelectedProducts(orderProducts);
      })
      .catch((error) => {
        console.error("Error fetching order items:", error);
      });
  };

  // Očisti formu i resetiraj podatke
  const resetForm = () => {
    form.reset();
    setSelectedProducts([]);
    setSelectedOrder(null);
    setUseFreeShipping(false); // Resetiraj i state za dostavu
    setManualShippingCost("5.00"); // Resetiraj i state za ručni unos dostave
    setManualDiscountAmount("0.00"); // Resetiraj i state za ručni unos popusta

    // Dohvati novi broj računa
    createInvoiceNumber().then((invoiceNumber) => {
      form.setValue("invoiceNumber", invoiceNumber);
    });
  };

  // Dohvaćanje podataka za kreiranje PDF-a
  const [productId, setSelectedProductId] = useState<number | null>(null);
  const [price, setPrice] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedScent, setSelectedScent] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [colorSelectionMode, setColorSelectionMode] = useState<
    "single" | "multiple"
  >("single");
  const [orderSearchTerm, setOrderSearchTerm] = useState<string>("");

  // Dohvati proizvode
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Dohvati korisnike
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Dohvati mirise za odabrani proizvod
  const { data: productScents = [] } = useQuery<Scent[]>({
    queryKey: [`/api/products/${productId}/scents`],
    enabled: !!productId,
  });

  // Dohvati boje za odabrani proizvod
  const { data: productColors = [] } = useQuery<Color[]>({
    queryKey: [`/api/products/${productId}/colors`],
    enabled: !!productId,
  });

  // Postavi cijenu kada je proizvod odabran
  const handleProductChange = async (productId: string) => {
    const id = parseInt(productId);
    setSelectedProductId(id);

    const product = products.find((p) => p.id === id);
    if (product) {
      setPrice(product.price);
    }

    // Resetiraj miris i boju
    setSelectedScent(null);
    setSelectedColor(null);

    console.log("Selected product ID:", id);

    // Ručno dohvaćanje mirisa i boja
    try {
      const scentsResponse = await fetch(`/api/products/${id}/scents`);
      const scentsData = await scentsResponse.json();
      console.log("Retrieved scents:", scentsData);

      const colorsResponse = await fetch(`/api/products/${id}/colors`);
      const colorsData = await colorsResponse.json();
      console.log("Retrieved colors:", colorsData);
    } catch (error) {
      console.error("Error retrieving options:", error);
    }
  };

  // Dodaj proizvod na listu
  const handleAddProduct = () => {
    if (!productId) {
      return;
    }

    const product = products.find((p) => p.id === productId);
    if (!product) {
      return;
    }

    let colorInfo;
    if (colorSelectionMode === "multiple" && selectedColors.length > 0) {
      const colorNames = selectedColors
        .map((colorId) => {
          const color = productColors.find((c) => c.id === colorId);
          return color ? color.name : "";
        })
        .filter(Boolean);

      colorInfo = {
        colorId: null, // Više boja nema jedan ID
        colorName: colorNames.join(", "),
        colorIds: JSON.stringify(selectedColors),
        hasMultipleColors: true,
      };
    } else {
      const color = productColors.find((c) => c.id === selectedColor);
      colorInfo = {
        colorId: selectedColor,
        colorName: color ? color.name : null,
        colorIds: selectedColor ? JSON.stringify([selectedColor]) : null,
        hasMultipleColors: false,
      };
    }

    const scent = productScents.find((s) => s.id === selectedScent);

    const newProduct: SelectedProduct = {
      id: product.id,
      name: product.name,
      price: price || product.price,
      quantity: quantity,
      scentId: selectedScent,
      scentName: scent ? scent.name : null,
      ...colorInfo,
    };

    console.log("Adding product:", newProduct);

    addProduct(newProduct);

    // Resetiraj odabire
    setSelectedProductId(null);
    setSelectedScent(null);
    setSelectedColor(null);
    setSelectedColors([]);
    setPrice("");
    setQuantity(1);
    setColorSelectionMode("single");
  };

  // Filtriraj narudžbe po pojmovima za pretraživanje
  const filteredOrders = orders.filter((order) => {
    if (!orderSearchTerm) return true;

    // Pretraživanje po ID-u narudžbe
    if (order.id.toString().includes(orderSearchTerm)) return true;

    // Pretraživanje po imenu korisnika
    const user = users.find((u) => u.id === order.userId);
    if (
      user &&
      `${user.firstName} ${user.lastName}`
        .toLowerCase()
        .includes(orderSearchTerm.toLowerCase())
    )
      return true;

    return false;
  });

  // Formatiraj status narudžbe
  const formatOrderStatus = (status: string) => {
    switch (status) {
      case "pending":
        return t("orders.status.pending");
      case "processing":
        return t("orders.status.processing");
      case "completed":
        return t("orders.status.completed");
      case "cancelled":
        return t("orders.status.cancelled");
      default:
        return status;
    }
  };

  // Kreiraj novi račun
  const onSubmit = async (data: CreateInvoiceFormValues) => {
    try {
      // Validacija proizvoda
      if (selectedProducts.length === 0) {
        toast({
          title: t("admin.invoices.emptyProductList"),
          description: t("admin.invoices.addProductsForInvoice"),
          variant: "destructive",
        });
        return;
      }

      // Pripremi podatke za API
      const subtotalProducts = selectedProducts // <- Ovo je izračun proizvoda
        .reduce((sum, p) => sum + parseFloat(p.price) * p.quantity, 0);

      // ✅ KORISTIMO VRIJEDNOSTI DOHVAĆENE OD HOOKOVA NA VRHU KOMPONENTE
      // NE ZOVEMO useGetSetting ILI useSettingValue OVDJE!
      let shippingCost = defaultStandardShippingRate; // Defaultna dostava
      if (
        subtotalProducts >= defaultFreeShippingThreshold &&
        defaultFreeShippingThreshold > 0
      ) {
        shippingCost = 0; // Besplatna dostava
      }

      // NOVO: Popust nije primjenjen na admin fakturi
      // Admin fakture se obično kreiraju na temelju punih cijena,
      // a popust se odražava samo na plaćenom iznosu (što dolazi od Stipea).
      // Ako ipak želiš prikazati popust, morao bi ga ručno unijeti u formi,
      // ili bi ga trebao dohvatiti od korisnika.
      // Za sada, pretpostavljamo da za ručno kreirane fakture nema popusta,
      // ili se popust unosi kao tekstualna napomena.
      const discountAmount = 0; // Pretpostavljamo 0 za ručno kreirane fakture

      const tax = "0.00";
      // NOVO: Ukupni iznos fakture (bez popusta, ako ga ručno ne unosiš)
      const totalInvoiceAmount = (subtotalProducts + shippingCost).toFixed(2);

      // Kreiraj podatke o kupcu
      const customerName = `${data.firstName} ${data.lastName}`;

      // Pripremi podatke za API slanje (ovo ide u bazu)
      const invoiceData = {
        invoiceNumber: data.invoiceNumber,
        orderId: selectedOrder ? selectedOrder.id : null,
        userId: selectedOrder ? selectedOrder.userId : null, // Ako nema narudžbe, userId može biti null ili default admin ID
        customerName,
        customerEmail: data.email || "",
        customerAddress: data.address || "",
        customerCity: data.city || "",
        customerPostalCode: data.postalCode || "",
        customerCountry: data.country || "",
        customerPhone: data.phone || "",
        customerNote: data.customerNote || "",
        paymentMethod: data.paymentMethod,
        total: totalInvoiceAmount, // <- KORISTI NOVO IZRAČUNATU VRIJEDNOST
        subtotal: subtotalProducts.toFixed(2), // <- KORISTI NOVO IZRAČUNATU VRIJEDNOST
        tax,
        language: data.language,
        discountAmount: discountAmount.toFixed(2), // Proslijedi popust (ovdje je 0)
        discountType: "fixed", // Defaultni tip
        discountPercentage: "0", // Defaultni postotak
        shippingCost: shippingCost.toFixed(2), // Proslijedi izračunatu dostavu
        items: selectedProducts.map((p) => ({
          productId: p.id,
          productName: p.name,
          quantity: p.quantity,
          price: p.price,
          scentId: p.scentId,
          scentName: p.scentName,
          colorId: p.colorId,
          colorName: p.colorName,
          colorIds: p.colorIds,
          hasMultipleColors: p.hasMultipleColors,
        })),
      };

      console.log("Sending data to create invoice:", invoiceData);

      // Pošalji zahtjev za kreiranje računa
      apiRequest("POST", "/api/invoices", invoiceData)
        .then((response) => {
          if (!response.ok) {
            return response.text().then((text) => {
              throw new Error(text || "Error creating invoice");
            });
          }
          return response.json();
        })
        .then((result) => {
          toast({
            title: t("admin.invoices.invoiceCreated"),
            description: t("admin.invoices.invoiceCreatedSuccess").replace(
              "{invoiceNumber}",
              result.invoiceNumber,
            ),
          });

          // Osvježi listu računa i resetiraj formu
          refetchInvoices();
          resetForm();

          // Prebaci na "Existing Invoices" tab
          setActiveTab("existing");
        })
        .catch((errorResponse) => {
          let errorMessage = t("admin.invoices.errorCreatingInvoice");

          try {
            // Pokušaj parsirati JSON odgovor
            const errorObj = JSON.parse(errorResponse.message);
            errorMessage = errorObj.message || errorMessage;
          } catch (error) {
            // Ako nije JSON, koristi originalnu poruku
            errorMessage = errorResponse.message || errorMessage;
          }

          console.error("Error creating invoice:", errorResponse);

          toast({
            title: t("common.error"),
            description: errorMessage,
            variant: "destructive",
          });
        });
    } catch (error) {
      console.error("Unexpected error:", error);
      toast({
        title: t("common.unexpectedError"),
        description:
          (error as Error)?.toString() || t("common.unexpectedErrorOccurred"),
        variant: "destructive",
      });
    }
  };

  // Brisanje računa
  const handleDeleteInvoice = (id: number) => {
    apiRequest("DELETE", `/api/invoices/${id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Error while deleting invoice");
        }
        refetchInvoices(); // Osvježi listu računa nakon brisanja
        toast({
          title: t("admin.invoices.invoiceDeleted"),
          description: t("admin.invoices.invoiceDeletedSuccess"),
        });
      })
      .catch((error) => {
        console.error("Error deleting invoice:", error);
        toast({
          title: t("common.error"),
          description: t("admin.invoices.errorDeletingInvoice"),
          variant: "destructive",
        });
      });
  };

  // Funkcije za preuzimanje PDF-ova za postojeće račune
  const handleDownloadInvoice = (invoice: Invoice) => {
    // Preuzmi račun s originalnim jezikom
    downloadInvoice(invoice, invoice.language || "hr");
  };

  const handleDownloadInvoiceWithLanguage = (
    invoice: Invoice,
    language: string,
  ) => {
    // Preuzmi račun s odabranim jezikom
    downloadInvoice(invoice, language);
  };

  const downloadInvoice = (invoice: Invoice, language: string) => {
    // Dohvati detalje računa sa servera (koji sadrže orderItems)
    apiRequest("GET", `/api/invoices/${invoice.id}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Error while deleting invoice");
        }
        const data = await response.json(); // Ovo je cijeli objekt fakture s .items

        console.log("Retrieved data for PDF invoice:", data);

        // NOVO: Obogati stavke fakture s detaljima proizvoda, mirisa i boja (ovaj dio je već ispravan)
        const enhancedInvoiceItems = await Promise.all(
          data.items.map(async (item: any) => {
            const product = products.find((p) => p.id === item.productId);
            let scent = productScents.find((s) => s.id === item.scentId);
            let color = productColors.find((c) => c.id === item.colorId);

            let colorNames: string[] = [];
            if (item.hasMultipleColors && item.colorIds) {
              try {
                const ids = JSON.parse(item.colorIds);
                ids.forEach((id: number) => {
                  const c = productColors.find((pc) => pc.id === id);
                  if (c) colorNames.push(c.name);
                });
              } catch (e) {
                console.error("Error parsing colorIds for invoice item:", e);
              }
            } else if (color?.name) {
              colorNames.push(color.name);
            }

            return {
              ...item,
              product: product || {
                name: item.productName || "Nepoznat proizvod",
                price: item.price,
                imageUrl: null,
                description: "",
              },
              scentName: item.scentName || scent?.name || null,
              colorName: item.colorName || colorNames.join(", ") || null,
              colorIds: item.colorIds || null,
              hasMultipleColors: item.hasMultipleColors || false,
            };
          }),
        );

        // Pripremi podatke za PDF sa svim potrebnim poljima
        const invoiceData = {
          invoiceNumber: invoice.invoiceNumber,
          createdAt: invoice.createdAt,
          // PODACI O KUPCU - BITNO DA SU SVI OVDJE I SIGURNI
          customerName: invoice.customerName || "",
          customerEmail: invoice.customerEmail || "",
          customerAddress: invoice.customerAddress || "",
          customerCity: invoice.customerCity || "",
          customerPostalCode: invoice.customerPostalCode || "",
          customerCountry: invoice.customerCountry || "",
          customerPhone: invoice.customerPhone || "",
          customerNote: invoice.customerNote || "",
          // OSTALI PODACI
          items: enhancedInvoiceItems,
          language: language,
          paymentMethod: invoice.paymentMethod || "cash",
          paymentStatus: invoice.paymentStatus || "unpaid",
          // Iznosi (total, subtotal, discount, shipping, tax) - ovo je već OK
          subtotal: parseFloat(invoice.subtotal || "0"),
          shippingCost: parseFloat(invoice.shippingCost || "0"),
          discountAmount: parseFloat(invoice.discountAmount || "0"),
          discountType: invoice.discountType || "fixed",
          discountPercentage: parseFloat(invoice.discountPercentage || "0"),
          tax: parseFloat(invoice.tax || "0"),
          total: parseFloat(invoice.total || "0"),
        };

        console.log("Preparing data for PDF:", invoiceData);
        generatePdf(invoiceData); // Pozivanje generatePdf sa kompletnim podacima
      })
      .catch((error) => {
        console.error("Error retrieving invoice items:", error);
        toast({
          title: t("common.error"),
          description: t("admin.invoices.errorRetrievingInvoiceItems"),
          variant: "destructive",
        });
      });
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>{t("admin.invoices.pageTitle")} | Kerzenwelt by Dani</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            {t("admin.invoices.title")}
          </h1>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="existing">
              <FileText className="h-4 w-4 mr-2" />
              {t("admin.invoices.existingInvoices")}
            </TabsTrigger>
            <TabsTrigger value="create">
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.invoices.createNewInvoice")}
            </TabsTrigger>
            {/* <TabsTrigger value="documents">
              <File className="h-4 w-4 mr-2" />
              {t("admin.invoices.companyDocuments")}
            </TabsTrigger> */}
          </TabsList>

          <TabsContent value="existing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.invoices.existingInvoices")}</CardTitle>
                <CardDescription>
                  {t("admin.invoices.viewAllInvoicesDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.invoices.invoiceNumber")}</TableHead>
                      <TableHead>{t("admin.invoices.date")}</TableHead>
                      <TableHead>{t("admin.invoices.customer")}</TableHead>
                      <TableHead>{t("admin.invoices.amount")}</TableHead>
                      <TableHead>{t("admin.invoices.paymentMethod")}</TableHead>
                      <TableHead>{t("admin.invoices.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          {t("admin.invoices.noInvoicesCreated")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...invoices]
                        .sort((a, b) => {
                          // Sortiraj po ID-u (najnoviji prvi)
                          return b.id - a.id;
                        })
                        .map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">
                              {invoice.invoiceNumber}
                            </TableCell>
                            <TableCell>
                              {format(
                                new Date(invoice.createdAt),
                                "dd.MM.yyyy",
                              )}
                            </TableCell>
                            <TableCell>{invoice.customerName}</TableCell>
                            <TableCell>
                              {invoice.total && parseFloat(invoice.total) > 0
                                ? `${parseFloat(invoice.total).toFixed(2)} €`
                                : `${parseFloat(invoice.subtotal || "0").toFixed(2)} €`}
                            </TableCell>
                            <TableCell>
                              {t(`paymentMethods.${invoice.paymentMethod}`)}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <LanguageSelector
                                  invoice={invoice}
                                  onSelectLanguage={
                                    handleDownloadInvoiceWithLanguage
                                  }
                                />

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {t("admin.invoices.areYouSure")}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t(
                                          "admin.invoices.deleteInvoiceConfirmation",
                                        ).replace(
                                          "{invoiceNumber}",
                                          invoice.invoiceNumber,
                                        )}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        {t("common.cancel")}
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          handleDeleteInvoice(invoice.id)
                                        }
                                      >
                                        {t("common.delete")}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.invoices.createNewInvoice")}</CardTitle>
                <CardDescription>
                  {t("admin.invoices.fillInformationForNewInvoice")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">
                          {t("admin.invoices.customerDetails")}
                        </h3>

                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("admin.invoices.firstName")}
                              </FormLabel>
                              <FormControl>
                                <Input {...field} />
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
                              <FormLabel>
                                {t("admin.invoices.lastName")}
                              </FormLabel>
                              <FormControl>
                                <Input {...field} />
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
                              <FormLabel>{t("common.email")}</FormLabel>
                              <FormControl>
                                <Input {...field} />
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
                              <FormLabel>{t("common.phone")}</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("common.address")}</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="postalCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("common.postalCode")}</FormLabel>
                                <FormControl>
                                  <Input {...field} />
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
                                <FormLabel>{t("common.city")}</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("common.country")}</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">
                          {t("admin.invoices.invoiceDetails")}
                        </h3>

                        <FormField
                          control={form.control}
                          name="invoiceNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("admin.invoices.invoiceNumber")}
                              </FormLabel>
                              <FormControl>
                                <Input {...field} readOnly />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="language"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("admin.invoices.invoiceLanguage")}
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={t("common.selectLanguage")}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="hr">
                                    {t("languages.croatian")}
                                  </SelectItem>
                                  <SelectItem value="en">
                                    {t("languages.english")}
                                  </SelectItem>
                                  <SelectItem value="de">
                                    {t("languages.german")}
                                  </SelectItem>
                                  <SelectItem value="it">
                                    {t("languages.italian")}
                                  </SelectItem>
                                  <SelectItem value="sl">
                                    {t("languages.slovenian")}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="paymentMethod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("admin.invoices.paymentMethod")}
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={t(
                                        "common.selectPaymentMethod",
                                      )}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="cash">
                                    {t("paymentMethods.cash")}
                                  </SelectItem>
                                  <SelectItem value="bank_transfer">
                                    {t("paymentMethods.bankTransfer")}
                                  </SelectItem>
                                  <SelectItem value="paypal">PayPal</SelectItem>
                                  <SelectItem value="credit_card">
                                    {t("paymentMethods.creditCard")}
                                  </SelectItem>
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
                            <FormItem>
                              <FormLabel>{t("common.note")}</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder={t(
                                    "admin.invoices.noteForInvoice",
                                  )}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-4 mt-8">
                          <h3 className="text-lg font-medium">
                            {t("admin.invoices.selectFromExistingOrders")}
                          </h3>

                          <div className="flex space-x-2 mb-4">
                            <Input
                              placeholder={t("admin.orders.placeholderSearch")}
                              value={orderSearchTerm}
                              onChange={(e) =>
                                setOrderSearchTerm(e.target.value)
                              }
                              className="flex-1"
                            />
                          </div>

                          <div className="max-h-64 overflow-y-auto border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">#</TableHead>
                                  <TableHead>
                                    {t("admin.orders.customer")}
                                  </TableHead>
                                  <TableHead>
                                    {t("admin.orders.status")}
                                  </TableHead>
                                  <TableHead>
                                    {t("admin.orders.amount")}
                                  </TableHead>
                                  <TableHead className="w-20">
                                    {t("admin.orders.action")}
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredOrders.length === 0 ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={5}
                                      className="text-center"
                                    >
                                      {t("admin.orders.noOrdersFound")}
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  filteredOrders.map((order) => {
                                    const user = users.find(
                                      (u) => u.id === order.userId,
                                    );
                                    return (
                                      <TableRow key={order.id}>
                                        <TableCell>{order.id}</TableCell>
                                        <TableCell>
                                          {user
                                            ? `${user.firstName} ${user.lastName}`
                                            : "Nepoznati korisnik"}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={
                                              order.status === "completed"
                                                ? "default"
                                                : order.status === "pending"
                                                  ? "secondary"
                                                  : order.status === "cancelled"
                                                    ? "destructive"
                                                    : "outline"
                                            }
                                          >
                                            {formatOrderStatus(order.status)}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>{order.total} €</TableCell>
                                        <TableCell>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setOrderData(order)}
                                          >
                                            {t("common.select")}
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="p-4 space-y-3 bg-muted/40 rounded-b-md">
                      <h3 className="text-lg font-medium mb-2">
                        {t("admin.invoices.deliveryAndDiscount")}
                      </h3>

                      {/* Kontrola dostave */}
                      <div className="flex items-center space-x-4">
                        <label className="text-sm font-medium">
                          {t("admin.invoices.shipping")}:
                        </label>
                        <Button
                          variant={useFreeShipping ? "default" : "outline"}
                          size="sm"
                          onClick={() => setUseFreeShipping(true)}
                          type="button"
                        >
                          {t("admin.invoices.freeShipping")}
                        </Button>
                        <Button
                          variant={!useFreeShipping ? "default" : "outline"}
                          size="sm"
                          onClick={() => setUseFreeShipping(false)}
                          type="button"
                        >
                          {t("admin.invoices.manualShipping")}
                        </Button>
                      </div>
                      {!useFreeShipping && (
                        <div className="space-y-2">
                          <label
                            htmlFor="manualShipping"
                            className="text-sm font-medium"
                          >
                            {t("admin.invoices.shippingCost")} *
                          </label>
                          <Input
                            id="manualShipping"
                            type="number"
                            min="0"
                            step="0.01"
                            value={manualShippingCost}
                            onChange={(e) =>
                              setManualShippingCost(e.target.value)
                            }
                            placeholder={defaultStandardShippingRate.toFixed(2)}
                          />
                        </div>
                      )}

                      {/* Kontrola popusta */}
                      <div className="space-y-2 mt-4">
                        <label
                          htmlFor="manualDiscount"
                          className="text-sm font-medium"
                        >
                          {t("admin.invoices.discountAmount")}
                        </label>
                        <Input
                          id="manualDiscount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={manualDiscountAmount}
                          onChange={(e) =>
                            setManualDiscountAmount(e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">
                          {t("admin.invoices.invoiceItems")}
                        </h3>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <Plus className="h-4 w-4 mr-2" />
                              {t("admin.invoices.addItem")}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[550px]">
                            <DialogHeader>
                              <DialogTitle>
                                {t("admin.invoices.addItemToInvoice")}
                              </DialogTitle>
                              <DialogDescription>
                                {t("admin.invoices.selectProductAndQuantity")}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <label
                                  htmlFor="product"
                                  className="text-sm font-medium"
                                >
                                  {t("admin.invoices.product")}
                                </label>
                                <Select
                                  onValueChange={(value) =>
                                    handleProductChange(value)
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue
                                      placeholder={t(
                                        "admin.invoices.selectProduct",
                                      )}
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products.map((product) => (
                                      <SelectItem
                                        key={product.id}
                                        value={product.id.toString()}
                                      >
                                        {product.name} - {product.price} €
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {productId && (
                                <>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <label
                                        htmlFor="price"
                                        className="text-sm font-medium"
                                      >
                                        {t("admin.invoices.priceEuro")}
                                      </label>
                                      <Input
                                        id="price"
                                        value={price}
                                        onChange={(e) =>
                                          setPrice(e.target.value)
                                        }
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <label
                                        htmlFor="quantity"
                                        className="text-sm font-medium"
                                      >
                                        {t("common.quantity")}
                                      </label>
                                      <Input
                                        id="quantity"
                                        type="number"
                                        min="1"
                                        value={quantity}
                                        onChange={(e) =>
                                          setQuantity(parseInt(e.target.value))
                                        }
                                      />
                                    </div>
                                  </div>

                                  {productScents.length > 0 && (
                                    <div className="space-y-2">
                                      <label
                                        htmlFor="scent"
                                        className="text-sm font-medium"
                                      >
                                        {t("common.scent")}
                                      </label>
                                      <Select
                                        onValueChange={(value) =>
                                          setSelectedScent(parseInt(value))
                                        }
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue
                                            placeholder={t(
                                              "common.selectScent",
                                            )}
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {productScents.map((scent) => (
                                            <SelectItem
                                              key={scent.id}
                                              value={scent.id.toString()}
                                            >
                                              {scent.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {productColors.length > 0 && (
                                    <>
                                      <div className="flex items-center space-x-4">
                                        <label className="text-sm font-medium">
                                          {t(
                                            "admin.products.colorSelectionMode",
                                          )}
                                          :
                                        </label>
                                        <div className="flex space-x-2">
                                          <Button
                                            variant={
                                              colorSelectionMode === "single"
                                                ? "default"
                                                : "outline"
                                            }
                                            size="sm"
                                            onClick={() =>
                                              setColorSelectionMode("single")
                                            }
                                            type="button"
                                          >
                                            {t("admin.products.singleColor")}
                                          </Button>
                                          <Button
                                            variant={
                                              colorSelectionMode === "multiple"
                                                ? "default"
                                                : "outline"
                                            }
                                            size="sm"
                                            onClick={() =>
                                              setColorSelectionMode("multiple")
                                            }
                                            type="button"
                                          >
                                            {t("admin.products.multipleColors")}
                                          </Button>
                                        </div>
                                      </div>

                                      {colorSelectionMode === "single" ? (
                                        <div className="space-y-2">
                                          <label
                                            htmlFor="color"
                                            className="text-sm font-medium"
                                          >
                                            {t("common.color")}
                                          </label>
                                          <Select
                                            onValueChange={(value) =>
                                              setSelectedColor(parseInt(value))
                                            }
                                          >
                                            <SelectTrigger className="w-full">
                                              <SelectValue
                                                placeholder={t(
                                                  "common.selectColor",
                                                )}
                                              />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {productColors.map((color) => (
                                                <SelectItem
                                                  key={color.id}
                                                  value={color.id.toString()}
                                                >
                                                  {color.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          <label className="text-sm font-medium">
                                            {t("common.selectMultipleColors")}
                                          </label>
                                          <div className="grid grid-cols-2 gap-2">
                                            {productColors.map((color) => (
                                              <div
                                                key={color.id}
                                                className="flex items-center space-x-2"
                                              >
                                                <input
                                                  type="checkbox"
                                                  id={`color-${color.id}`}
                                                  checked={selectedColors.includes(
                                                    color.id,
                                                  )}
                                                  onChange={(e) => {
                                                    if (e.target.checked) {
                                                      setSelectedColors([
                                                        ...selectedColors,
                                                        color.id,
                                                      ]);
                                                    } else {
                                                      setSelectedColors(
                                                        selectedColors.filter(
                                                          (id) =>
                                                            id !== color.id,
                                                        ),
                                                      );
                                                    }
                                                  }}
                                                  className="h-4 w-4"
                                                />
                                                <label
                                                  htmlFor={`color-${color.id}`}
                                                  className="text-sm"
                                                >
                                                  {color.name}
                                                </label>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                            </div>

                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">
                                  {t("common.cancel")}
                                </Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  type="button"
                                  onClick={handleAddProduct}
                                >
                                  {t("common.add")}
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <div className="border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                {t("admin.invoices.product")}
                              </TableHead>
                              <TableHead>
                                {t("admin.invoices.pricePerUnit")}
                              </TableHead>
                              <TableHead>{t("common.quantity")}</TableHead>
                              <TableHead>{t("admin.invoices.total")}</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedProducts.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  className="text-center py-6"
                                >
                                  {t("admin.invoices.noItemsAdded")}
                                </TableCell>
                              </TableRow>
                            ) : (
                              <>
                                {selectedProducts.map((product, index) => (
                                  <TableRow key={index}>
                                    <TableCell>
                                      <div>
                                        <div className="font-medium">
                                          {product.name}
                                        </div>
                                        {product.scentName && (
                                          <div className="text-sm text-muted-foreground">
                                            {t("common.scent")}:{" "}
                                            {product.scentName}
                                          </div>
                                        )}
                                        {product.colorName && (
                                          <div className="text-sm text-muted-foreground">
                                            {t("common.color")}:{" "}
                                            {product.colorName}
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>{product.price} €</TableCell>
                                    <TableCell>{product.quantity}</TableCell>
                                    <TableCell>
                                      {(
                                        parseFloat(product.price) *
                                        product.quantity
                                      ).toFixed(2)}{" "}
                                      €
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeProduct(index)}
                                      >
                                        <X className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}

                                {/* Totals section */}
                                <TableRow className="bg-muted/50">
                                  <TableCell
                                    colSpan={3}
                                    className="font-medium"
                                  >
                                    Zwischensumme
                                  </TableCell>
                                  <TableCell colSpan={2} className="text-right">
                                    {selectedProducts
                                      .reduce(
                                        (sum, p) =>
                                          sum +
                                          parseFloat(p.price) * p.quantity,
                                        0,
                                      )
                                      .toFixed(2)}{" "}
                                    €
                                  </TableCell>
                                </TableRow>
                                {/* Totals section - AŽURIRANO */}
                                <TableRow className="bg-muted/50">
                                  <TableCell
                                    colSpan={3}
                                    className="font-medium"
                                  >
                                    {t("admin.invoices.subtotal")}
                                  </TableCell>
                                  <TableCell colSpan={2} className="text-right">
                                    {subtotalProducts.toFixed(2)} €
                                  </TableCell>
                                </TableRow>

                                {currentDiscountAmount > 0 && ( // Prikazi popust samo ako ga ima
                                  <TableRow className="bg-muted/50 text-green-600">
                                    <TableCell
                                      colSpan={3}
                                      className="font-medium"
                                    >
                                      {t("admin.invoices.discount")}
                                    </TableCell>
                                    <TableCell
                                      colSpan={2}
                                      className="text-right"
                                    >
                                      -{currentDiscountAmount.toFixed(2)} €
                                    </TableCell>
                                  </TableRow>
                                )}

                                <TableRow className="bg-muted/50">
                                  <TableCell
                                    colSpan={3}
                                    className="font-medium"
                                  >
                                    {t("admin.invoices.shipping")}
                                  </TableCell>
                                  <TableCell colSpan={2} className="text-right">
                                    {currentShippingCost === 0
                                      ? t("cart.shippingFree")
                                      : `${currentShippingCost.toFixed(2)} €`}
                                  </TableCell>
                                </TableRow>

                                <TableRow className="bg-muted/50">
                                  <TableCell
                                    colSpan={3}
                                    className="font-medium"
                                  >
                                    {t("admin.invoices.total")}
                                  </TableCell>
                                  <TableCell
                                    colSpan={2}
                                    className="text-right font-bold"
                                  >
                                    {(
                                      subtotalProducts +
                                      currentShippingCost -
                                      currentDiscountAmount
                                    ).toFixed(2)}{" "}
                                    €
                                  </TableCell>
                                </TableRow>
                              </>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetForm}
                      >
                        {t("common.reset")}
                      </Button>
                      <Button type="submit">
                        {t("admin.invoices.createInvoice")}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <DocumentManager />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
