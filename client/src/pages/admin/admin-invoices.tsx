import React, { useState, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
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
import {
  generateInvoicePdf,
  getPaymentMethodText,
} from "./new-invoice-generator";

// Helper function for generating invoice number
const createInvoiceNumber = async (orderId?: number) => {
  // Generating invoice number in format i450, i451, etc.
  try {
    const response = await fetch("/api/invoices/last");
    const lastInvoice = await response.json();

    console.log("Last invoice retrieved:", lastInvoice);

    if (lastInvoice && lastInvoice.invoiceNumber) {
      // Parse the existing invoice number
      const currentNumber = lastInvoice.invoiceNumber.substring(1); // Exclude 'i' prefix
      const nextNumber = parseInt(currentNumber) + 1;
      return `i${nextNumber}`;
    } else {
      // If there are no existing invoices, start from 450
      return "i450";
    }
  } catch (error) {
    console.error("Error retrieving last invoice number:", error);
    return orderId ? `i${orderId + 450}` : "i450";
  }
};

// Component for selecting invoice language
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
            className="mr-2"
          />
          {t("languages.slovenian")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Types for invoices
interface Invoice {
  id: number;
  invoiceNumber: string;
  orderId: number;
  userId: number;
  customerName: string;
  customerEmail: string;
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
}

// Selected product
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

// Schema for creating invoices
// Note: We can't use t() function here directly since it's outside component
// Translation keys will be applied in validation error messages inside the form
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

// Types for the form
type CreateInvoiceFormValues = z.infer<typeof createInvoiceSchema>;

// Component for the entire admin invoices module
export default function AdminInvoices() {
  const [activeTab, setActiveTab] = useState<string>("existing");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    [],
  );
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Fetch invoices
  const { data: invoices = [], refetch: refetchInvoices } = useQuery<Invoice[]>(
    {
      queryKey: ["/api/invoices"],
    },
  );

  // Fetch orders
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Form for creating invoice
  const form = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: async () => {
      // Get initial invoice number
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

  // Function for generating PDF
  const generatePdf = (data: any) => {
    // Using the new method from new-invoice-generator.ts which gives identical appearance as in the user section
    generateInvoicePdf(data, toast);
  };

  // Add product to the list
  const addProduct = (product: SelectedProduct) => {
    setSelectedProducts([...selectedProducts, product]);
  };

  // Remove product from the list
  const removeProduct = (index: number) => {
    const newProducts = [...selectedProducts];
    newProducts.splice(index, 1);
    setSelectedProducts(newProducts);
  };

  // Set data from order
  const setOrderData = (order: any) => {
    setSelectedOrder(order);

    // Get user data from API
    const userId = order.userId;
    if (userId) {
      // Here we could fetch user data from the API
      // For now we just set available values
      form.setValue("firstName", order.firstName || "");
      form.setValue("lastName", order.lastName || "");
      form.setValue("address", order.shippingAddress || "");
      form.setValue("city", order.shippingCity || "");
      form.setValue("postalCode", order.shippingPostalCode || "");
      form.setValue("country", order.shippingCountry || "");
      form.setValue("email", order.email || "");
      form.setValue("phone", order.phone || "");
      form.setValue("paymentMethod", order.paymentMethod || "cash");
    }

    // Set products from order
    apiRequest("GET", `/api/orders/${order.id}/items`)
      .then((response) => response.json())
      .then((items) => {
        console.log("Order items retrieved:", items);

        // Prepare selected products for invoice
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

  // Clear form and reset data
  const resetForm = () => {
    form.reset();
    setSelectedProducts([]);
    setSelectedOrder(null);

    // Get new invoice number
    createInvoiceNumber().then((invoiceNumber) => {
      form.setValue("invoiceNumber", invoiceNumber);
    });
  };

  // Getting data for PDF creation
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

  // Fetch products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Dohvati korisnike
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Get scents for selected product
  const { data: productScents = [] } = useQuery<Scent[]>({
    queryKey: [`/api/products/${productId}/scents`],
    enabled: !!productId,
  });

  // Get colors for selected product
  const { data: productColors = [] } = useQuery<Color[]>({
    queryKey: [`/api/products/${productId}/colors`],
    enabled: !!productId,
  });

  // Set price when product is selected
  const handleProductChange = async (productId: string) => {
    const id = parseInt(productId);
    setSelectedProductId(id);

    const product = products.find((p) => p.id === id);
    if (product) {
      setPrice(product.price);
    }

    // Reset scent and color
    setSelectedScent(null);
    setSelectedColor(null);

    console.log("Selected product ID:", id);

    // Manual retrieval of scents and colors
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

  // Add product to the list
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
        colorId: null, // Multiple colors don't have a single ID
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

    // Reset selections
    setSelectedProductId(null);
    setSelectedScent(null);
    setSelectedColor(null);
    setSelectedColors([]);
    setPrice("");
    setQuantity(1);
    setColorSelectionMode("single");
  };

  // Filter orders by search terms
  const filteredOrders = orders.filter((order) => {
    if (!orderSearchTerm) return true;

    // Search by order ID
    if (order.id.toString().includes(orderSearchTerm)) return true;

    // Search by user name
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

  // Format order status
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

  // Create new invoice
  const onSubmit = async (data: CreateInvoiceFormValues) => {
    try {
      // Product validation
      if (selectedProducts.length === 0) {
        toast({
          title: t("admin.invoices.emptyProductList"),
          description: t("admin.invoices.addProductsForInvoice"),
          variant: "destructive",
        });
        return;
      }

      // Prepare data for API
      const subtotal = selectedProducts
        .reduce((sum, p) => sum + parseFloat(p.price) * p.quantity, 0)
        .toFixed(2);

      const tax = "0.00";
      const total = (parseFloat(subtotal) + 5.0).toFixed(2); // Add 5€ for shipping

      // Create customer data
      const customerName = `${data.firstName} ${data.lastName}`;

      // Prepare data for API submission
      const invoiceData = {
        invoiceNumber: data.invoiceNumber,
        orderId: selectedOrder ? selectedOrder.id : null,
        userId: selectedOrder ? selectedOrder.userId : 1, // Default admin user if there is no order
        customerName,
        customerEmail: data.email || "",
        customerAddress: data.address || "",
        customerCity: data.city || "",
        customerPostalCode: data.postalCode || "",
        customerCountry: data.country || "",
        customerPhone: data.phone || "",
        customerNote: data.customerNote || "",
        paymentMethod: data.paymentMethod,
        total,
        subtotal,
        tax,
        language: data.language,
        items: selectedProducts.map((p) => ({
          productId: p.id,
          productName: p.name,
          quantity: p.quantity,
          price: p.price,
          selectedScent: p.scentName,
          selectedColor: p.colorName,
          colorIds: p.colorIds,
          hasMultipleColors: p.hasMultipleColors,
        })),
      };

      console.log("Sending data to create invoice:", invoiceData);

      // Send request to create invoice
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

          // Refresh invoice list and reset form
          refetchInvoices();
          resetForm();

          // Switch to "Existing Invoices" tab
          setActiveTab("existing");
        })
        .catch((errorResponse) => {
          let errorMessage = t("admin.invoices.errorCreatingInvoice");

          try {
            // Try to parse JSON response
            const errorObj = JSON.parse(errorResponse.message);
            errorMessage = errorObj.message || errorMessage;
          } catch (error) {
            // If not JSON, use the original message
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
        refetchInvoices(); // Refresh invoice list after deletion
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

  // Functions for downloading PDFs for existing invoices
  const handleDownloadInvoice = (invoice: Invoice) => {
    // Download invoice with original language
    downloadInvoice(invoice, invoice.language || "hr");
  };

  const handleDownloadInvoiceWithLanguage = (
    invoice: Invoice,
    language: string,
  ) => {
    // Download invoice with selected language
    downloadInvoice(invoice, language);
  };

  const downloadInvoice = (invoice: Invoice, language: string) => {
    // Fetch invoice items from server
    apiRequest("GET", `/api/invoices/${invoice.id}`)
      .then((response) => response.json())
      .then((data) => {
        console.log("Retrieved data for PDF invoice:", data);

        // Prepare data for the PDF with correct field names as expected by the PDF generation function
        const invoiceData = {
          invoiceNumber: invoice.invoiceNumber,
          createdAt: invoice.createdAt,
          customerName: invoice.customerName,
          customerAddress: invoice.customerAddress || "",
          customerCity: invoice.customerCity || "",
          customerPostalCode: invoice.customerPostalCode || "",
          customerCountry: invoice.customerCountry || "",
          customerEmail: invoice.customerEmail || "",
          customerPhone: invoice.customerPhone || "",
          customerNote: invoice.customerNote || "",
          items: data.items || [], // Using items fetched from the server
          language: language, // Using the selected language
          paymentMethod: invoice.paymentMethod || "cash", // Using payment method from the existing invoice
        };

        console.log("Preparing data for PDF:", invoiceData);
        generatePdf(invoiceData);
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
                          // Sort by ID (newest first)
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
                                : `${parseFloat(invoice.subtotal || "0").toFixed(2)} €`
                              }
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
                                <TableRow className="bg-muted/50">
                                  <TableCell
                                    colSpan={3}
                                    className="font-medium"
                                  >
                                    Versand
                                  </TableCell>
                                  <TableCell colSpan={2} className="text-right">
                                    5.00 €
                                  </TableCell>
                                </TableRow>
                                <TableRow className="bg-muted/50">
                                  <TableCell
                                    colSpan={3}
                                    className="font-medium"
                                  >
                                    Total
                                  </TableCell>
                                  <TableCell
                                    colSpan={2}
                                    className="text-right font-bold"
                                  >
                                    {(
                                      selectedProducts.reduce(
                                        (sum, p) =>
                                          sum +
                                          parseFloat(p.price) * p.quantity,
                                        0,
                                      ) + 5.0
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
