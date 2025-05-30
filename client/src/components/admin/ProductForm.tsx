import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Product, insertProductSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { LoaderCircle, Upload, Link, ImageIcon } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";

interface ProductFormProps {
  product?: Product;
  onSuccess?: () => void;
}

export default function ProductForm({ product, onSuccess }: ProductFormProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedScents, setSelectedScents] = useState<number[]>([]);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [hasColorOptions, setHasColorOptions] = useState(product?.hasColorOptions || false);
  const [featured, setFeatured] = useState(product?.featured || false);
  const [allowMultipleColors, setAllowMultipleColors] = useState(product?.allowMultipleColors || false);
  const [active, setActive] = useState(product?.active !== false); // defaultno je true ako nije definirano drugačije
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('url');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create extended schema with validations
  const validationSchema = insertProductSchema.extend({
    featured: z.boolean().optional(),
    hasColorOptions: z.boolean().optional(),
    allowMultipleColors: z.boolean().optional(),
    active: z.boolean().optional(),
    price: z.string().refine((val) => !isNaN(parseFloat(val)), {
      message: t("admin.product.validation.price"),
    }),
    stock: z.coerce.number().int().min(0, {
      message: t("admin.product.validation.stock"),
    }),
    categoryId: z.number({
      required_error: t("admin.product.validation.category"),
    }),
    // Ova polja imamo samo zbog defaultValues, ali su zamijenjena checkbox listama
    scent: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    // Dodatna polja za detalje proizvoda
    dimensions: z.string().optional().nullable(),
    weight: z.string().optional().nullable(),
    materials: z.string().optional().nullable(),
    instructions: z.string().optional().nullable(),
    maintenance: z.string().optional().nullable(),
  });

  // Create form with validation
  const form = useForm<z.infer<typeof validationSchema>>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      price: product?.price || "",
      imageUrl: product?.imageUrl || "",
      categoryId: product?.categoryId || undefined,
      stock: product?.stock || 0,
      featured: product?.featured || false,
      hasColorOptions: product?.hasColorOptions || false,
      allowMultipleColors: product?.allowMultipleColors || false,
      scent: product?.scent || "",
      color: product?.color || "",
      burnTime: product?.burnTime || "",
      // Dodatna polja za detalje proizvoda
      dimensions: product?.dimensions || "",
      weight: product?.weight || "",
      materials: product?.materials || "",
      instructions: product?.instructions || "",
      maintenance: product?.maintenance || "",
    },
  });

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Fetch scents
  const { data: scents, isLoading: scentsLoading } = useQuery({
    queryKey: ["/api/scents"],
  });

  // Fetch colors
  const { data: colors, isLoading: colorsLoading } = useQuery({
    queryKey: ["/api/colors"],
  });

  // Fetch product scents
  useEffect(() => {
    if (product) {
      const fetchProductScents = async () => {
        try {
          const response = await apiRequest("GET", `/api/products/${product.id}/scents`);
          const productScents = await response.json();
          setSelectedScents(productScents.map((scent: any) => scent.id));
        } catch (error) {
          console.error("Failed to fetch product scents:", error);
        }
      };

      fetchProductScents();
    }
  }, [product]);

  // Fetch product colors
  useEffect(() => {
    if (product) {
      const fetchProductColors = async () => {
        try {
          const response = await apiRequest("GET", `/api/products/${product.id}/colors`);
          const productColors = await response.json();
          setSelectedColors(productColors.map((color: any) => color.id));
        } catch (error) {
          console.error("Failed to fetch product colors:", error);
        }
      };

      fetchProductColors();
    }
  }, [product]);

  // Handler za upload slike
  const handleImageUpload = async (file: File) => {
    if (!file) return null;
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        // Važno: Ne šaljemo Content-Type zaglavlje jer će ga FormData automatski postaviti s boundary
      });
      
      if (!response.ok) {
        throw new Error(t("admin.product.imageUploadError"));
      }
      
      const data = await response.json();
      
      // Postavljanje URL-a slike u formular
      form.setValue('imageUrl', data.imageUrl);
      
      toast({
        title: t("admin.product.imageUploadSuccess"),
        description: t("admin.product.imageResizeSuccess")
      });
      
      return data.imageUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: t("admin.general.error"),
        description: t("admin.product.imageUploadError"),
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handler za promjenu datoteke
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleImageUpload(file);
    }
  };

  // Submit handler
  const onSubmit = async (values: z.infer<typeof validationSchema>) => {
    setIsSubmitting(true);
    
    try {
      // Uklanjamo scent i color polja jer više ne koristimo pojedinačne vrijednosti
      const { scent, color, ...restValues } = values;
      
      // Priprema podataka za slanje na server
      // Zamjena zareza s točkom za cijenu
      const price = typeof restValues.price === 'string' 
        ? restValues.price.replace(',', '.') 
        : restValues.price;
        
      const productData = {
        ...restValues,
        price, // Korištenje cijene s točkom umjesto zareza
        featured,
        hasColorOptions,
        allowMultipleColors,
        active, // Dodana vrijednost za aktivaciju/deaktivaciju proizvoda
        // Postavljamo na null da ih ne bi API izbacio kao grešku
        scent: null,
        color: null,
        // Postavljamo na null prazne stringove
        dimensions: values.dimensions?.trim() || null,
        weight: values.weight?.trim() || null,
        materials: values.materials?.trim() || null,
        instructions: values.instructions?.trim() || null,
        maintenance: values.maintenance?.trim() || null
      };
      
      let savedProduct;
      
      if (product) {
        // Update existing product
        const response = await apiRequest("PUT", `/api/products/${product.id}`, productData);
        savedProduct = await response.json();
      } else {
        // Create new product
        const response = await apiRequest("POST", "/api/products", productData);
        savedProduct = await response.json();
      }
      
      // Handle scents
      if (savedProduct) {
        // First delete all existing scents for this product if we're updating
        if (product) {
          await apiRequest("DELETE", `/api/products/${savedProduct.id}/scents`);
        }
        
        // Add selected scents
        for (const scentId of selectedScents) {
          await apiRequest("POST", `/api/products/${savedProduct.id}/scents`, { scentId });
        }
        
        // First delete all existing colors for this product if we're updating
        if (product) {
          await apiRequest("DELETE", `/api/products/${savedProduct.id}/colors`);
        }
        
        // Add selected colors
        for (const colorId of selectedColors) {
          await apiRequest("POST", `/api/products/${savedProduct.id}/colors`, { colorId });
        }
      }
      
      toast({
        title: product ? t("admin.product.productUpdated") : t("admin.product.productCreated"),
        description: product
          ? t("admin.product.productUpdatedMessage").replace('{name}', values.name)
          : t("admin.product.productCreatedMessage").replace('{name}', values.name),
      });

      // Invalidate products query cache
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: t("admin.general.error"),
        description: t("admin.product.savingError"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.product.name")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t("admin.product.namePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Category */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.product.category")} *</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("admin.product.categoryPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoriesLoading ? (
                        <div className="py-2 text-center">{t("admin.general.loading")}</div>
                      ) : (
                        categories?.map((category: any) => (
                          <SelectItem 
                            key={category.id} 
                            value={category.id.toString()}
                          >
                            {category.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Price */}
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.product.price")} (€) *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t("admin.product.pricePlaceholder")} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Stock */}
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.product.stock")} *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0" 
                      placeholder={t("admin.product.stockPlaceholder")} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Image Upload/URL */}
            <div className="col-span-full space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">{t("admin.product.image")} *</h3>
                <Tabs 
                  defaultValue={uploadMethod} 
                  onValueChange={(value) => setUploadMethod(value as 'url' | 'file')}
                  className="w-64"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="url" className="flex items-center gap-1">
                      <Link className="h-4 w-4" />
                      {t("admin.product.url")}
                    </TabsTrigger>
                    <TabsTrigger value="file" className="flex items-center gap-1">
                      <Upload className="h-4 w-4" />
                      {t("admin.product.upload")}
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="url" className="pt-3">
                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              placeholder={t("admin.product.imageUrlPlaceholder")} 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription>
                            {t("admin.product.imageUrlDescription")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                  
                  <TabsContent value="file" className="pt-3">
                    <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:bg-accent/50 transition-colors" 
                        onClick={() => fileInputRef.current?.click()}>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileChange}
                          disabled={isUploading}
                        />
                        {isUploading ? (
                          <div className="flex flex-col items-center">
                            <LoaderCircle className="h-10 w-10 text-primary animate-spin mb-2" />
                            <p className="text-sm text-muted-foreground">{t("admin.general.uploading")}</p>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                            <p className="text-sm font-medium mb-1">{t("admin.product.clickToUpload")}</p>
                            <p className="text-xs text-muted-foreground">{t("admin.product.imageFormats")}</p>
                            <p className="text-xs text-muted-foreground mt-1">({t("admin.product.imageResizeInfo")})</p>
                          </>
                        )}
                      </div>
                      
                      {form.watch('imageUrl') && (
                        <div className="rounded-lg overflow-hidden border border-input">
                          <img 
                            src={form.watch('imageUrl') as string} 
                            alt={t("admin.product.preview")} 
                            className="w-full h-auto object-cover" 
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              {/* Current image preview (always show regardless of tab) */}
              {uploadMethod === 'url' && form.watch('imageUrl') && (
                <div className="rounded-lg overflow-hidden border border-input mt-4">
                  <img 
                    src={form.watch('imageUrl') as string} 
                    alt={t("admin.product.preview")} 
                    className="w-full h-auto object-cover max-h-64" 
                  />
                </div>
              )}
            </div>
            
            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>{t("admin.product.description")} *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t("admin.product.descriptionPlaceholder")} 
                      className="min-h-32" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Burn time */}
            <FormField
              control={form.control}
              name="burnTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.product.burnTime")}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t("admin.product.burnTimePlaceholder")} 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Dimensions */}
            <FormField
              control={form.control}
              name="dimensions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.product.dimensions")}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t("admin.product.dimensionsPlaceholder")} 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Weight */}
            <FormField
              control={form.control}
              name="weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.product.weight")}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t("admin.product.weightPlaceholder")} 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Materials */}
            <FormField
              control={form.control}
              name="materials"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.product.materials")}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t("admin.product.materialsPlaceholder")} 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Instructions */}
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>{t("admin.product.instructions")}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t("admin.product.instructionsPlaceholder")} 
                      className="min-h-24" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Maintenance */}
            <FormField
              control={form.control}
              name="maintenance"
              render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>{t("admin.product.maintenance")}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t("admin.product.maintenancePlaceholder")} 
                      className="min-h-24" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Featured product */}
            <div className="flex items-center space-x-2">
              <Switch 
                id="featured"
                checked={featured}
                onCheckedChange={setFeatured}
              />
              <label
                htmlFor="featured"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t("admin.product.featuredProduct")}
              </label>
            </div>
            
            {/* Has color options */}
            <div className="flex items-center space-x-2">
              <Switch 
                id="hasColorOptions"
                checked={hasColorOptions}
                onCheckedChange={setHasColorOptions}
              />
              <label
                htmlFor="hasColorOptions"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t("admin.product.enableColorSelection")}
              </label>
            </div>
            
            {/* Allow multiple colors */}
            {hasColorOptions && (
              <div className="flex items-center space-x-2">
                <Switch 
                  id="allowMultipleColors"
                  checked={allowMultipleColors}
                  onCheckedChange={setAllowMultipleColors}
                />
                <label
                  htmlFor="allowMultipleColors"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {t("admin.product.enableMultipleColors")}
                </label>
              </div>
            )}
            
            {/* Product active/inactive status */}
            <div className="flex items-center space-x-2">
              <Switch 
                id="active"
                checked={active}
                onCheckedChange={setActive}
              />
              <label
                htmlFor="active"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t("admin.product.productActive")}
              </label>
              <span className="text-xs text-muted-foreground ml-2">
                {t("admin.product.productActiveHint")}
              </span>
            </div>
            
            {/* Available scents */}
            <div className="col-span-full">
              <FormLabel>{t("admin.product.availableScents")}</FormLabel>
              <div className="mt-2 border rounded-md p-4">
                <div className="text-sm text-gray-500 mb-3">
                  {t("admin.product.selectScents")}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {scentsLoading ? (
                    <div>{t("admin.product.loadingScents")}</div>
                  ) : (
                    scents?.map((scent: any) => (
                      <div key={scent.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`scent-${scent.id}`}
                          checked={selectedScents.includes(scent.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedScents([...selectedScents, scent.id]);
                            } else {
                              setSelectedScents(selectedScents.filter(id => id !== scent.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`scent-${scent.id}`}
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {scent.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            {/* Available colors */}
            <div className="col-span-full">
              <FormLabel>{t("admin.product.availableColors")}</FormLabel>
              <div className="mt-2 border rounded-md p-4">
                <div className="text-sm text-gray-500 mb-3">
                  {t("admin.product.selectColors")}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {colorsLoading ? (
                    <div>{t("admin.product.loadingColors")}</div>
                  ) : (
                    colors?.map((color: any) => (
                      <div key={color.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`color-${color.id}`}
                          checked={selectedColors.includes(color.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedColors([...selectedColors, color.id]);
                            } else {
                              setSelectedColors(selectedColors.filter(id => id !== color.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`color-${color.id}`}
                          className="flex items-center text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          <span 
                            className="w-3 h-3 rounded-full mr-2" 
                            style={{ backgroundColor: color.hexValue }}
                          ></span>
                          {color.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Image preview */}
          {form.watch("imageUrl") && (
            <div className="mt-4">
              <div className="border rounded-md p-2 max-w-xs">
                <p className="text-sm text-gray-500 mb-2">{t("admin.product.imagePreview")}:</p>
                <img 
                  src={form.watch("imageUrl")} 
                  alt={t("admin.product.preview")} 
                  className="max-h-48 rounded-md object-contain mx-auto"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://placehold.co/400x400/gray/white?text=${encodeURIComponent(t("admin.product.imageLoadingError"))}`;
                  }}
                />
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => form.reset()}
              disabled={isSubmitting}
            >
              {t("admin.product.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {product ? t("admin.product.saveChanges") : t("admin.product.createProduct")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}