import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { format } from "date-fns";
import AdminLayout from "@/components/admin/AdminLayout";
import { User } from "@shared/schema";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  MoreVertical,
  UserCog,
  Info,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldX,
  UserCheck,
  CreditCard,
  Package,
  PercentCircle,
  CalendarDays,
  CreditCard as CreditCardIcon,
  DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

export default function AdminUsers() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountMinimumOrder, setDiscountMinimumOrder] = useState("");
  const [discountExpiryDate, setDiscountExpiryDate] = useState("");
  const [discountType, setDiscountType] = useState("fixed");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");

  // Fetch users
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch user statistics when a user is selected
  const { data: userStats, isLoading: isLoadingStats } = useQuery<{
    totalSpent: string;
    orderCount: number;
  }>({
    queryKey: [`/api/users/${selectedUser?.id}/stats`],
    enabled: !!selectedUser,
  });

  // Filter users based on search term
  const filteredUsers = users?.filter((user) => {
    return (
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.firstName &&
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.lastName &&
        user.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  // View user details
  const viewUserDetails = (user: User) => {
    setSelectedUser(user);
    setIsUserDetailsOpen(true);
  };

  // Toggle admin status
  const toggleAdminStatus = async (user: User) => {
    try {
      const updatedUser = { ...user, isAdmin: !user.isAdmin };
      await apiRequest("PUT", `/api/users/${user.id}`, updatedUser);

      toast({
        title: "Status ažuriran",
        description: `${user.username} je ${!user.isAdmin ? "sada administrator" : "više nije administrator"}.`,
      });

      // Refresh users
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });

      // If the updated user is the currently selected one, update it
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, isAdmin: !selectedUser.isAdmin });
      }
    } catch (error) {
      toast({
        title: "Greška",
        description:
          "Došlo je do greške prilikom ažuriranja statusa korisnika.",
        variant: "destructive",
      });
    }
  };

  // Open the email modal
  const openEmailModal = (user: User) => {
    setSelectedUser(user);
    setEmailSubject("");
    setEmailMessage("");
    setIsEmailModalOpen(true);
  };

  // Send email to user - mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: {
      userId: number;
      subject: string;
      message: string;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/users/${data.userId}/send-email`,
        {
          subject: data.subject,
          message: data.message,
        },
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "E-Mail gesendet",
        description: `E-Mail wurde erfolgreich an ${selectedUser?.email} gesendet.`,
      });
      setIsEmailModalOpen(false);
    },
    onError: (error) => {
      console.error("Error sending email:", error);
      toast({
        title: "Fehler",
        description: "E-Mail konnte nicht gesendet werden.",
        variant: "destructive",
      });
    },
  });

  // Open the discount modal
  const openDiscountModal = (user: User) => {
    setSelectedUser(user);
    setDiscountAmount(user.discountAmount?.toString() || "0");
    setDiscountMinimumOrder(user.discountMinimumOrder?.toString() || "0");
    setDiscountType((user as any).discountType || "fixed");
    setDiscountExpiryDate(
      user.discountExpiryDate
        ? format(new Date(user.discountExpiryDate), "yyyy-MM-dd")
        : format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    );
    setIsDiscountModalOpen(true);
  };

  // Set user discount - mutation
  const setUserDiscountMutation = useMutation({
    mutationFn: async (data: {
      userId: number;
      discountAmount: string;
      discountMinimumOrder: string;
      discountExpiryDate: string;
      discountType: string;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/users/${data.userId}/discount`,
        {
          discountAmount: data.discountAmount,
          discountMinimumOrder: data.discountMinimumOrder,
          discountExpiryDate: data.discountExpiryDate,
          discountType: data.discountType,
        },
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Popust postavljen",
        description: `Popust za korisnika ${selectedUser?.username} je uspješno postavljen.`,
      });

      // Refresh users and stats
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/users/${selectedUser?.id}/stats`],
      });

      setIsDiscountModalOpen(false);
    },
    onError: (error) => {
      console.error("Error setting user discount:", error);
      toast({
        title: "Greška",
        description: "Nije moguće postaviti popust za korisnika.",
        variant: "destructive",
      });
    },
  });

  return (
    <AdminLayout title="Benuter">
      <Helmet>
        <title>Benutzerverwaltung | Admin-Panel | Kerzenwelt by Dani</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Benuter</h1>
          <p className="text-muted-foreground">Store-Benutzer verwalten</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Benutzer suchen..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista korisnika</CardTitle>
            <CardDescription>
              {filteredUsers
                ? `${filteredUsers.length} benutzer`
                : "Benutzer wird geladen..."}
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
                      <TableHead>Benutzername</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Vor- und Nachname</TableHead>
                      <TableHead>Registriert</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead className="w-[100px]">Optionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Keine Benutzer gefunden
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers?.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.username}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user.firstName || user.lastName || "-"}
                          </TableCell>
                          <TableCell>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.isAdmin ? "default" : "outline"}
                            >
                              {user.isAdmin ? "Admin" : "Benutzer"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Optionen</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => viewUserDetails(user)}
                                >
                                  <Info className="mr-2 h-4 w-4" /> Einzelheiten
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    toast({
                                      title: "E-Mail senden",
                                      description: `Diese Funktion öffnet ein Formular zum Senden einer E-Mail an den Benutzer ${user.username}.`,
                                    });
                                  }}
                                >
                                  <Mail className="mr-2 h-4 w-4" /> Kontakt
                                </DropdownMenuItem>
                                {user.isAdmin ? (
                                  <DropdownMenuItem
                                    onClick={() => toggleAdminStatus(user)}
                                  >
                                    <ShieldX className="mr-2 h-4 w-4" />{" "}
                                    Administratorrechte entfernen
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => toggleAdminStatus(user)}
                                  >
                                    <ShieldCheck className="mr-2 h-4 w-4" />{" "}
                                    Fügen Sie Administratorrechte hinzu
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDiscountModal(user)}
                                >
                                  <PercentCircle className="mr-2 h-4 w-4" />{" "}
                                  Legen Sie einen Rabatt fest
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      {/* User Details Dialog */}
      <Dialog open={isUserDetailsOpen} onOpenChange={setIsUserDetailsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <UserCog className="mr-2 h-5 w-5" />
              Benutzerdetails
            </DialogTitle>
            <DialogDescription>
              Benutzerinformationen anzeigen {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <Tabs defaultValue="info" className="mt-4">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="info">Information</TabsTrigger>
                <TabsTrigger value="stats">Statistiken</TabsTrigger>
                <TabsTrigger value="discount">Rabatte</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      ID Benutzer
                    </p>
                    <p>{selectedUser.id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Tip Benutzer
                    </p>
                    <Badge
                      variant={selectedUser.isAdmin ? "default" : "outline"}
                    >
                      {selectedUser.isAdmin ? "Administrator" : "Korisnik"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Benutzer Name
                    </p>
                    <p>{selectedUser.username}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p>{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p>{selectedUser.firstName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Nachname
                    </p>
                    <p>{selectedUser.lastName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Telefon</p>
                    <p>{selectedUser.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Datum der Registrierung
                    </p>
                    <p>{new Date(selectedUser.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">Adresse</p>
                  <p>{selectedUser.address || "-"}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Stadt</p>
                    <p>{selectedUser.city || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">PLZ</p>
                    <p>{selectedUser.postalCode || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Land</p>
                    <p>{selectedUser.country || "-"}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="stats">
                {isLoadingStats ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : userStats ? (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold mb-4">
                      Benutzerstatistiken
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center pt-6">
                          <DollarSign className="h-8 w-8 text-primary mb-2" />
                          <h4 className="text-xl font-bold">
                            {userStats.totalSpent} €
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Gesamtverbrauch
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="flex flex-col items-center justify-center pt-6">
                          <Package className="h-8 w-8 text-primary mb-2" />
                          <h4 className="text-xl font-bold">
                            {userStats.orderCount}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Anzahl der Bestellungen
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Benutzerstatistiken konnten nicht geladen werden
                  </div>
                )}
              </TabsContent>

              <TabsContent value="discount">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Sofortiger Rabatt
                  </h3>

                  {selectedUser.discountAmount &&
                  parseFloat(selectedUser.discountAmount) > 0 ? (
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-6">
                        <div className="flex items-center mb-2">
                          <PercentCircle className="h-5 w-5 text-green-500 mr-2" />
                          <h4 className="text-sm font-semibold text-green-700">
                            Aktiver Rabatt
                          </h4>
                        </div>
                        <p className="text-sm">
                          Der Benutzer hat einen aktiven Rabatt von{" "}
                          <span className="font-semibold">
                            {selectedUser.discountAmount} €
                          </span>
                          {selectedUser.discountMinimumOrder &&
                          parseFloat(selectedUser.discountMinimumOrder) > 0
                            ? ` za narudžbe iznad ${selectedUser.discountMinimumOrder} €`
                            : " za sljedeću narudžbu"}
                        </p>
                        {selectedUser.discountExpiryDate && (
                          <p className="text-xs text-green-600 mt-1">
                            Gültig bis:{" "}
                            {new Date(
                              selectedUser.discountExpiryDate,
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      Der Benutzer hat derzeit keinen aktiven Rabatt.
                    </div>
                  )}

                  <Button
                    onClick={() => openDiscountModal(selectedUser)}
                    className="w-full"
                  >
                    <PercentCircle className="h-4 w-4 mr-2" />
                    {selectedUser.discountAmount &&
                    parseFloat(selectedUser.discountAmount) > 0
                      ? "Rabatt bearbeiten"
                      : "Fügen Sie einen Rabatt hinzu"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => toggleAdminStatus(selectedUser!)}
              className={
                selectedUser?.isAdmin
                  ? "bg-red-50 hover:bg-red-100 border-red-200"
                  : "bg-green-50 hover:bg-green-100 border-green-200"
              }
            >
              {selectedUser?.isAdmin ? (
                <>
                  <ShieldX className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-red-500">
                    Administratorrechte entfernen
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4 text-green-500" />
                  <span className="text-green-500">
                    Fügen Sie Administratorrechte hinzu
                  </span>
                </>
              )}
            </Button>
            <Button onClick={() => setIsUserDetailsOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount Modal */}
      <Dialog open={isDiscountModalOpen} onOpenChange={setIsDiscountModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <PercentCircle className="mr-2 h-5 w-5" />
              {selectedUser?.discountAmount &&
              parseFloat(selectedUser.discountAmount) > 0
                ? "Rabatt bearbeiten"
                : "Fügen Sie einen Rabatt hinzu"}
            </DialogTitle>
            <DialogDescription>
              Legen Sie einen Rabatt für den Benutzer fest{" "}
              {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="discount-amount">Rabattbetrag (€)</Label>
              <Input
                id="discount-amount"
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Rabatt, der auf die Bestellung angewendet wird
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-order">Mindestbestellmenge (€)</Label>
              <Input
                id="minimum-order"
                type="number"
                min="0"
                step="0.01"
                value={discountMinimumOrder}
                onChange={(e) => setDiscountMinimumOrder(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Für einen Rabatt ohne Mindestbetrag, lassen Sie 0
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry-date">Verfallsdatum</Label>
              <Input
                id="expiry-date"
                type="date"
                value={discountExpiryDate}
                onChange={(e) => setDiscountExpiryDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDiscountModalOpen(false)}
            >
              Aufgeben
            </Button>
            <Button
              onClick={() => {
                if (!selectedUser) return;

                setUserDiscountMutation.mutate({
                  userId: selectedUser.id,
                  discountAmount,
                  discountMinimumOrder,
                  discountExpiryDate,
                });
              }}
              disabled={setUserDiscountMutation.isPending}
            >
              {setUserDiscountMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichern...
                </>
              ) : (
                <>
                  <PercentCircle className="mr-2 h-4 w-4" />
                  Speichern
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
