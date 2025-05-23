import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AdminLayout from "@/components/admin/AdminLayout";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { format } from "date-fns";
import { Copy, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Define the subscriber type
type Subscriber = {
  id: number;
  email: string;
  discountCode: string;
  discountUsed: boolean;
  createdAt: string;
  language: string;
};

export default function AdminSubscribers() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch subscribers data
  const { data: subscribers, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/admin/subscribers"],
    retry: 1,
  });

  // Handle copy discount code to clipboard
  const handleCopyDiscountCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Kod kopiran!",
      description: "Kod za popust je kopiran u međuspremnik.",
    });
  };

  // Filter subscribers based on search term
  const filteredSubscribers = subscribers
    ? subscribers.filter(
        (subscriber: Subscriber) =>
          subscriber.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          subscriber.discountCode.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Prepare to delete a subscriber
  const confirmDelete = (id: number) => {
    setDeleteId(id);
    setShowDeleteDialog(true);
  };

  // Delete a subscriber
  const deleteSubscriber = async () => {
    if (!deleteId) return;

    try {
      const response = await fetch(`/api/admin/subscribers/${deleteId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Pretplatnik izbrisan",
          description: "Pretplatnik je uspješno izbrisan iz sustava.",
        });
        refetch();
      } else {
        const error = await response.json();
        toast({
          title: "Greška",
          description: error.message || "Došlo je do greške pri brisanju pretplatnika.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Greška",
        description: "Došlo je do greške pri brisanju pretplatnika.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setDeleteId(null);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner size="lg" />
        </div>
      </AdminLayout>
    );
  }

  // Render error state
  if (isError) {
    return (
      <AdminLayout>
        <Card>
          <CardHeader>
            <CardTitle>Greška pri učitavanju</CardTitle>
            <CardDescription>
              Došlo je do greške pri učitavanju pretplatnika. Molimo pokušajte ponovo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()}>Pokušaj ponovo</Button>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Card>
        <CardHeader>
          <CardTitle>Pretplatnici na newsletter</CardTitle>
          <CardDescription>
            Pregled i upravljanje pretplatnicima na newsletter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex items-center space-x-2">
              <Search className="text-gray-400" size={20} />
              <Input
                placeholder="Pretraži po emailu ili kodu za popust..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Kod za popust</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Jezik</TableHead>
                  <TableHead>Datum pretplate</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscribers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                      {searchTerm
                        ? "Nema rezultata za pretraživanje."
                        : "Nema pretplatnika na newsletter."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscribers.map((subscriber: Subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell className="font-medium">{subscriber.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono">{subscriber.discountCode}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCopyDiscountCode(subscriber.discountCode)}
                          >
                            <Copy size={16} />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={subscriber.discountUsed ? "bg-red-500" : "bg-green-500"}
                        >
                          {subscriber.discountUsed ? "Iskorišten" : "Nije iskorišten"}
                        </Badge>
                      </TableCell>
                      <TableCell>{subscriber.language.toUpperCase()}</TableCell>
                      <TableCell>
                        {format(new Date(subscriber.createdAt), "dd.MM.yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => confirmDelete(subscriber.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Jeste li sigurni?</AlertDialogTitle>
            <AlertDialogDescription>
              Ova radnja trajno će izbrisati pretplatnika iz sustava i ne može se poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSubscriber} className="bg-red-600 hover:bg-red-700">
              Izbriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}