import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import AdminLayout from "@/components/admin/AdminLayout";
import { useLanguage } from "@/hooks/use-language";
import {
  Order,
  OrderItemWithProduct,
  User,
  Product,
  Invoice,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateInvoicePdf } from "./new-invoice-generator";
import {
  Loader2,
  Search,
  FileText,
  Calendar,
  Clock,
  CreditCard,
  User as UserIcon,
  Package,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminOrders() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const { t } = useLanguage();

  // Fetch orders
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Fetch users for order details
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch order items for selected order
  const {
    data: orderItems,
    isLoading: orderItemsLoading,
    error: orderItemsError,
  } = useQuery<OrderItemWithProduct[]>({
    queryKey: [`/api/orders/${selectedOrder?.id}/items`],
    enabled: !!selectedOrder,
  });

  // Fetch all products to get product names
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Filter orders based on search term and status
  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      order.id.toString().includes(searchTerm) ||
      order.userId.toString().includes(searchTerm);

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Kreiranje i spremanje računa
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: t("admin.invoiceCreated"),
        description: t("admin.invoiceCreatedDescription"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.general.error"),
        description: t("admin.general.errordescription")` ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Funkcija za generiranje PDF računa
  const generateInvoice = async (order: Order, language: string) => {
    if (!order) return;

    console.log(
      "Generiranje računa za narudžbu ID:",
      order.id,
      "na jeziku:",
      language,
    );
    setGeneratingInvoice(true);

    try {
      // Dohvaćanje stavki narudžbe
      console.log("Dohvaćam stavke narudžbe:", order.id);
      const itemsResponse = await fetch(`/api/orders/${order.id}/items`);

      if (!itemsResponse.ok) {
        console.error(
          "Greška pri dohvaćanju stavki narudžbe:",
          itemsResponse.status,
        );
        toast({
          title: t("admin.general.error"),
          description: t("admin.orders.errorFetchingOrderItems"),
          variant: "destructive",
        });
        setGeneratingInvoice(false);
        return;
      }

      const items = await itemsResponse.json();
      console.log("Dohvaćene stavke narudžbe:", items.length);

      if (!items || !Array.isArray(items) || items.length === 0) {
        toast({
          title: t("admin.general.error"),
          description: t("admin.orders.invoiceGenerationError"),
          variant: "destructive",
        });
        setGeneratingInvoice(false);
        return;
      }

      // Dohvaćanje podataka o kupcu
      const userData = users?.find((u) => u.id === order.userId);

      // Generiraj jedinstveni broj računa za narudžbu u formatu i450
      // Ako je ID narudžbe manji od 450, koristimo 450 kao početak, inače koristimo ID narudžbe
      const baseNumber = 450;
      const invoiceNum =
        order.id < baseNumber ? `i${baseNumber}` : `i${order.id}`;

      // Raspakiraj ime i prezime iz userData
      let firstName = "";
      let lastName = "";

      if (userData) {
        // Ako imamo podatke o korisniku, koristimo njih
        if (userData.firstName) firstName = userData.firstName;
        if (userData.lastName) lastName = userData.lastName;

        // Ako nema imena ili prezimena, koristi username
        if (!firstName && !lastName) {
          firstName = userData.username || t("admin.orders.customer");
        }
      } else {
        // Ako nemamo podatke korisnika, koristimo "Kupac" kao zadanu vrijednost
        firstName = t("admin.orders.customer");
      }

      // Priprema podataka za generiranje računa u standardiziranom formatu
      const invoiceData = {
        invoiceNumber: invoiceNum,
        orderId: order.id,
        userId: order.userId,
        firstName: firstName,
        lastName: lastName,
        email: userData?.email || "",
        address: order.shippingAddress || "",
        city: order.shippingCity || "",
        postalCode: order.shippingPostalCode || "",
        country: order.shippingCountry || "",
        phone: userData?.phone || "",
        customerNote: order.customerNote || "",
        paymentMethod: order.paymentMethod || "bank_transfer",
        total: order.total,
        subtotal: order.subtotal || order.total,
        tax: "0.00", // PDV je 0% za male poduzetnike u Austriji
        createdAt: new Date(),
        language: language,
        items: items.map((item: any) => ({
          productId: item.productId,
          productName: item.product?.name || t("products.product"),
          quantity: item.quantity,
          price: item.price,
          selectedScent: item.scentName || "",
          selectedColor: item.colorName || "",
        })),
      };

      // Generiranje PDF-a koristeći standardiziranu funkciju
      generateInvoicePdf(invoiceData, toast);
    } catch (error) {
      console.error("Greška kod generiranja računa:", error);
      toast({
        title: t("admin.general.error"),
        description: t("admin.orders.invoiceGenerationError"),
        variant: "destructive",
      });
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Handle order status update
  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      await apiRequest("PUT", `/api/orders/${orderId}/status`, { status });

      toast({
        title: t("admin.orders.updateStatus"),
        description: `${t("admin.orders.updateStatusDescription")} #${orderId} ${t("admin.orders.updateStatusDescription2")} "${status}".`,
      });

      // Refresh orders
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });

      // If the updated order is the currently selected one, update it
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status });
      }
    } catch (error) {
      toast({
        title: t("admin.general.error"),
        description: t("admin.orders.updateStatusError"),
        variant: "destructive",
      });
    }
  };

  // View order details
  const viewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsOrderDetailsOpen(true);
  };

  // Get status badge variant based on status
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
        return "outline";
      case "processing":
        return "secondary";
      case "shipped":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Get user details for order
  const getUserForOrder = (userId: number) => {
    return users?.find((user) => user.id === userId);
  };

  return (
    <AdminLayout title={t("admin.dashboard.orders")}>
      <Helmet>
        <title>
          {t("admin.orders.subtitle")} | Admin Panel | Kerzenwelt by Dani
        </title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{t("admin.orders.title")}</h1>
          <p className="text-muted-foreground">{t("admin.orders.subtitle")}</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t("admin.orders.placeholderSearch")}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("admin.orders.filterStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("admin.orders.allStatuses")}
                  </SelectItem>
                  <SelectItem value="pending">{t("orders.pending")}</SelectItem>
                  <SelectItem value="processing">
                    {t("orders.processing")}
                  </SelectItem>
                  <SelectItem value="shipped">{t("orders.shipped")}</SelectItem>
                  <SelectItem value="completed">
                    {t("orders.completed")}
                  </SelectItem>
                  <SelectItem value="cancelled">
                    {t("admin.orders.statusCancelled")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.orders.cardTitle")}</CardTitle>
            <CardDescription>
              {filteredOrders
                ? `${filteredOrders.length} ${t("admin.orders.foundOrders")}`
                : t("admin.orders.loadingOrders")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.orders.orderNumber")}</TableHead>
                      <TableHead>{t("admin.orders.customer")}</TableHead>
                      <TableHead>{t("admin.orders.date")}</TableHead>
                      <TableHead>{t("admin.orders.total")}</TableHead>
                      <TableHead>{t("admin.orders.paymentMethod")}</TableHead>
                      <TableHead>{t("admin.orders.status")}</TableHead>
                      <TableHead>{t("admin.orders.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders?.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          {t("admin.orders.noOrdersFound")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders?.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            #{order.id}
                          </TableCell>
                          <TableCell>
                            {getUserForOrder(order.userId)?.username ||
                              `Kunde #${order.userId}`}
                          </TableCell>
                          <TableCell>
                            {new Date(order.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {parseFloat(order.total).toFixed(2)} €
                          </TableCell>
                          <TableCell>
                            {order.paymentMethod === "credit_card"
                              ? t("admin.payments.methodCreditCard")
                              : order.paymentMethod === "paypal"
                                ? "PayPal"
                                : t("admin.orders.paymentMethodBankTransfer")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getStatusBadgeVariant(order.status)}
                            >
                              {order.status === "pending"
                                ? "Ausstehend"
                                : order.status === "processing"
                                  ? "In Bearbeitung"
                                  : order.status === "shipped"
                                    ? "Versendet"
                                    : order.status === "completed"
                                      ? "Geliefert"
                                      : "Storniert"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => viewOrderDetails(order)}
                              >
                                Detalji
                              </Button>
                              <Select
                                defaultValue={order.status}
                                onValueChange={(value) =>
                                  updateOrderStatus(order.id, value)
                                }
                              >
                                <SelectTrigger className="h-8 w-32">
                                  <SelectValue
                                    placeholder={t("admin.orders.changeStatus")}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">
                                    Ausstehend
                                  </SelectItem>
                                  <SelectItem value="processing">
                                    In Bearbeitung
                                  </SelectItem>
                                  <SelectItem value="shipped">
                                    Versendet
                                  </SelectItem>
                                  <SelectItem value="completed">
                                    Geliefert
                                  </SelectItem>
                                  <SelectItem value="cancelled">
                                    Storniert
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={isOrderDetailsOpen} onOpenChange={setIsOrderDetailsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {t("admin.notification.order")} #{selectedOrder?.id}
            </DialogTitle>
            <DialogDescription>
              {t("admin.orders.orderPlacedOn")}{" "}
              {new Date(selectedOrder?.createdAt || "").toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="items">
                  {t("admin.product.items")}
                </TabsTrigger>
                <TabsTrigger value="customer">
                  {t("admin.orders.customer")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center">
                        <Calendar className="mr-2 h-4 w-4" />
                        {t("admin.orders.orderDetails")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">ID:</dt>
                          <dd className="font-medium">#{selectedOrder.id}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Datum:</dt>
                          <dd>
                            {new Date(selectedOrder.createdAt).toLocaleString()}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Status:</dt>
                          <dd>
                            <Badge
                              variant={getStatusBadgeVariant(
                                selectedOrder.status,
                              )}
                            >
                              {selectedOrder.status === "pending"
                                ? t("orders.pending")
                                : selectedOrder.status === "processing"
                                  ? t("orders.processing")
                                  : selectedOrder.status === "shipped"
                                    ? t("orders.shipped")
                                    : selectedOrder.status === "completed"
                                      ? t("orders.completed")
                                      : t("admin.cancelled")}
                            </Badge>
                          </dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center">
                        <CreditCard className="mr-2 h-4 w-4" />
                        {t("admin.orders.paymentDetails")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Način plaćanja:</dt>
                          <dd>
                            {selectedOrder.paymentMethod === "credit_card"
                              ? t("admin.payments.methodCreditCard")
                              : selectedOrder.paymentMethod === "paypal"
                                ? "PayPal"
                                : t("admin.orders.paymentMethodBankTransfer")}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Status plaćanja:</dt>
                          <dd>
                            <Badge
                              variant={
                                selectedOrder.paymentStatus === "completed"
                                  ? "default"
                                  : "outline"
                              }
                              className={
                                selectedOrder.paymentStatus === "completed"
                                  ? "bg-green-500"
                                  : ""
                              }
                            >
                              {selectedOrder.paymentStatus === "completed"
                                ? t("orders.paid")
                                : selectedOrder.paymentStatus === "pending"
                                  ? t("orders.pending")
                                  : selectedOrder.paymentStatus}
                            </Badge>
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Ukupan iznos:</dt>
                          <dd className="font-bold">
                            {parseFloat(selectedOrder.total).toFixed(2)} €
                          </dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Package className="mr-2 h-4 w-4" />
                      {t("cart.shippingInfo")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Adresse:</dt>
                        <dd>{selectedOrder.shippingAddress || "-"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Stadt:</dt>
                        <dd>{selectedOrder.shippingCity || "-"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">PLZ:</dt>
                        <dd>{selectedOrder.shippingPostalCode || "-"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Land:</dt>
                        <dd>{selectedOrder.shippingCountry || "-"}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="items" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Produkte auf Bestellung
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {orderItemsLoading ? (
                      <div className="flex justify-center items-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : !orderItems || orderItems.length === 0 ? (
                      <div className="text-center p-8 text-muted-foreground">
                        Für diese Bestellung sind keine Produkte verfügbar.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produktname</TableHead>
                            <TableHead>Optionen</TableHead>
                            <TableHead>Menge</TableHead>
                            <TableHead>Preis pro Stück</TableHead>
                            <TableHead>In Summe</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                {products
                                  ? products.find(
                                      (p) => p.id === item.productId,
                                    )?.name || "Kerzendosen"
                                  : item.productName ||
                                    `Produkt (ID: ${item.productId})`}
                              </TableCell>
                              <TableCell>
                                {item.scent && (
                                  <div className="flex items-center mb-1">
                                    <span className="text-xs text-muted-foreground mr-1">
                                      Duft:
                                    </span>
                                    <span className="text-xs font-medium">
                                      {item.scent.name}
                                    </span>
                                  </div>
                                )}
                                {item.color && (
                                  <div className="flex items-center">
                                    <span className="text-xs text-muted-foreground mr-1">
                                      Farbe:
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
                                {/* Prikaz scentName i colorName iz OrderItemWithProduct */}
                                {!item.scent &&
                                  !item.color &&
                                  item.scentName && (
                                    <div className="flex items-center mb-1">
                                      <span className="text-xs text-muted-foreground mr-1">
                                        Duft:
                                      </span>
                                      <span className="text-xs font-medium">
                                        {item.scentName}
                                      </span>
                                    </div>
                                  )}
                                {!item.scent &&
                                  !item.color &&
                                  item.colorName && (
                                    <div className="flex items-center">
                                      <span className="text-xs text-muted-foreground mr-1">
                                        {item.hasMultipleColors
                                          ? "Farbe:"
                                          : "Farbe:"}
                                      </span>
                                      <span className="text-xs font-medium">
                                        {item.colorName}
                                      </span>
                                    </div>
                                  )}
                                {!item.scent &&
                                  !item.color &&
                                  !item.scentName &&
                                  !item.colorName && (
                                    <span className="text-xs text-muted-foreground">
                                      Standardprodukt
                                    </span>
                                  )}
                              </TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>
                                {parseFloat(item.price).toFixed(2)} €
                              </TableCell>
                              <TableCell>
                                {(
                                  parseFloat(item.price) * item.quantity
                                ).toFixed(2)}{" "}
                                €
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="customer" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Kundeninformationen
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {users ? (
                      (() => {
                        const user = getUserForOrder(selectedOrder.userId);
                        if (!user) {
                          return (
                            <div className="text-center p-4 text-muted-foreground">
                              Benutzer nicht gefunden (ID:{" "}
                              {selectedOrder.userId})
                            </div>
                          );
                        }

                        return (
                          <dl className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Benutzer ID:</dt>
                              <dd>{user.id}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Benutzer name:</dt>
                              <dd>{user.username}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Email:</dt>
                              <dd>{user.email}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Name:</dt>
                              <dd>{user.firstName || "-"}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Nachname:</dt>
                              <dd>{user.lastName || "-"}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Telefon:</dt>
                              <dd>{user.phone || "-"}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Adresse:</dt>
                              <dd>{user.address || "-"}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Stadt:</dt>
                              <dd>{user.city || "-"}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">PLZ:</dt>
                              <dd>{user.postalCode || "-"}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Land:</dt>
                              <dd>{user.country || "-"}</dd>
                            </div>
                          </dl>
                        );
                      })()
                    ) : (
                      <div className="flex justify-center items-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setIsOrderDetailsOpen(false)}
            >
              Zatvori
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={generatingInvoice}>
                  {generatingInvoice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generation...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Rechnung erstellen
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  Wählen Sie die Rechnung Sprache
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    console.log("Odabran hrvatski jezik", selectedOrder);
                    if (selectedOrder) generateInvoice(selectedOrder, "hr");
                  }}
                >
                  <span className="mr-2">🇭🇷</span> Kroatisch
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    console.log("Odabran engleski jezik", selectedOrder);
                    if (selectedOrder) generateInvoice(selectedOrder, "en");
                  }}
                >
                  <span className="mr-2">🇬🇧</span> Englisch
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    console.log("Odabran njemački jezik", selectedOrder);
                    if (selectedOrder) generateInvoice(selectedOrder, "de");
                  }}
                >
                  <span className="mr-2">🇩🇪</span> Deutsch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
