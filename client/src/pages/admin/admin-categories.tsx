import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import AdminLayout from "@/components/admin/AdminLayout";
import { Category, InsertCategory } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
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

// Schema za validaciju forme
const getCategorySchema = (t: any) =>
  z.object({
    name: z.string().min(2, t("admin.categories.nameValidation")),
    description: z
      .string()
      .min(10, t("admin.categories.descriptionValidation")),
    imageUrl: z.string().optional(),
  });

type CategoryFormValues = z.infer<ReturnType<typeof getCategorySchema>>;

export default function AdminCategories() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);

  // Dohvati kategorije
  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Forma za dodavanje/uređivanje kategorije
  const categorySchema = getCategorySchema(t);
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      imageUrl: "",
    },
  });

  // Mutacija za dodavanje kategorije
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      const response = await apiRequest("POST", "/api/categories", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("admin.categories.success"),
        description: t("admin.categories.categoryAdded"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsFormOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: t("admin.categories.error"),
        description: `${t("admin.categories.errorAddDesc")}: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutacija za ažuriranje kategorije
  const updateCategoryMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: CategoryFormValues;
    }) => {
      const response = await apiRequest("PUT", `/api/categories/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("admin.categories.success"),
        description: t("admin.categories.categoryUpdated"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsFormOpen(false);
      setCurrentCategory(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: t("admin.categories.error"),
        description: `${t("admin.categories.errorUpdateDesc")}: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutacija za brisanje kategorije
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      toast({
        title: t("admin.categories.success"),
        description: t("admin.categories.categoryDeleted"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsDeleteDialogOpen(false);
      setCurrentCategory(null);
    },
    onError: (error: Error) => {
      toast({
        title: t("admin.categories.error"),
        description: `${t("admin.categories.errorDeleteDesc")}: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Otvori formu za dodavanje nove kategorije
  const handleAddCategory = () => {
    form.reset({
      name: "",
      description: "",
      imageUrl: "",
    });
    setCurrentCategory(null);
    setIsFormOpen(true);
  };

  // Otvori formu za uređivanje kategorije
  const handleEditCategory = (category: Category) => {
    form.reset({
      name: category.name,
      description: category.description || "",
      imageUrl: category.imageUrl || "",
    });
    setCurrentCategory(category);
    setIsFormOpen(true);
  };

  // Otvori dijalog za brisanje kategorije
  const handleDeleteCategory = (category: Category) => {
    setCurrentCategory(category);
    setIsDeleteDialogOpen(true);
  };

  // Potvrdi brisanje kategorije
  const confirmDeleteCategory = () => {
    if (currentCategory) {
      deleteCategoryMutation.mutate(currentCategory.id);
    }
  };

  // Predaj formu za kategoriju
  const onSubmit = (data: CategoryFormValues) => {
    if (currentCategory) {
      // Ažuriranje postojeće kategorije
      updateCategoryMutation.mutate({ id: currentCategory.id, data });
    } else {
      // Dodavanje nove kategorije
      createCategoryMutation.mutate(data);
    }
  };

  const isSubmitting =
    form.formState.isSubmitting ||
    createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    deleteCategoryMutation.isPending;

  return (
    <AdminLayout title={t("admin.categories.title")}>
      <Helmet>
        <title>
          {t("admin.categories.pageTitle")} | {t("admin.panel")} | Kerzenwelt by
          Dani
        </title>
      </Helmet>

      <div className="space-y-6">
        {/* Header s akcijama */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {t("admin.categories.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("admin.categories.subtitle")}
            </p>
          </div>

          <Button onClick={handleAddCategory} disabled={isSubmitting}>
            <Plus className="mr-2 h-4 w-4" />{" "}
            {t("admin.categories.addCategory")}
          </Button>
        </div>

        {/* Tablica kategorija */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.categories.allCategories")}</CardTitle>
            <CardDescription>
              {t("admin.categories.allCategoriesDesc")}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !categories || categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("admin.categories.noCategories")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">
                        {t("admin.categories.id")}
                      </TableHead>
                      <TableHead className="w-[80px]">
                        {t("admin.categories.image")}
                      </TableHead>
                      <TableHead>{t("admin.categories.name")}</TableHead>
                      <TableHead className="hidden md:table-cell">
                        {t("admin.categories.description")}
                      </TableHead>
                      <TableHead className="w-[150px] text-right">
                        {t("admin.categories.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">
                          {category.id}
                        </TableCell>
                        <TableCell>{category.name}</TableCell>
                        <TableCell className="hidden md:table-cell truncate max-w-[300px]">
                          {category.description}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEditCategory(category)}
                              disabled={isSubmitting}
                            >
                              <Pencil size={16} />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-destructive"
                              onClick={() => handleDeleteCategory(category)}
                              disabled={isSubmitting}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Forma za kategoriju */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {currentCategory
                ? t("admin.categories.editCategory")
                : t("admin.categories.addNewCategory")}
            </DialogTitle>
            <DialogDescription>
              {currentCategory
                ? t("admin.categories.editCategoryDesc")
                : t("admin.categories.addCategoryDesc")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.categories.nameLabel")} *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("admin.categories.namePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.categories.descriptionLabel")} *
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          "admin.categories.descriptionPlaceholder",
                        )}
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("admin.categories.descriptionHelp")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.categories.imageUrlLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("admin.categories.imageUrlPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("admin.categories.imageUrlHelp")}
                    </FormDescription>
                    <FormMessage />
                    {field.value && (
                      <div className="mt-2">
                        <p className="text-sm mb-2">
                          {t("admin.categories.imagePreview")}:
                        </p>
                        <div className="rounded-md overflow-hidden w-full max-w-[200px] h-[120px] bg-secondary">
                          <img
                            src={field.value}
                            alt={t("admin.categories.imageAlt")}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src =
                                "https://via.placeholder.com/200x120?text=Slika+nije+dostupna";
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSubmitting}
                >
                  {t("admin.categories.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {currentCategory
                        ? t("admin.categories.updating")
                        : t("admin.categories.saving")}
                    </>
                  ) : (
                    <>
                      {currentCategory
                        ? t("admin.categories.saveChanges")
                        : t("admin.categories.saveCategory")}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dijalog za potvrdu brisanja */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.categories.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.categories.deleteConfirmation").replace(
                "{name}",
                currentCategory?.name || "",
              )}
              {t("admin.categories.deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCategoryMutation.isPending}>
              {t("admin.categories.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              disabled={deleteCategoryMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCategoryMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("admin.categories.deleting")}
                </>
              ) : (
                t("admin.categories.confirmDelete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
