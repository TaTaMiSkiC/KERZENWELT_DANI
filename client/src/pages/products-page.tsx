import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Helmet } from 'react-helmet';
import Layout from "@/components/layout/Layout";
import ProductGrid from "@/components/products/ProductGrid";
import { Category, Product } from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export default function ProductsPage() {
  const { t } = useLanguage();
  const [, params] = useRoute("/products/:category");
  const [location] = useLocation();
  
  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  const categoryParam = urlParams.get("category");
  
  const [filters, setFilters] = useState({
    category: categoryParam || "all",
    search: "",
    priceRange: [0, 100],
    sortBy: "newest",
  });
  
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  // Fetch products with category filtering
  const { data: products, isLoading: productsLoading, refetch } = useQuery<Product[]>({
    queryKey: ["/api/products", filters.category !== "all" ? filters.category : null],
    queryFn: async ({ queryKey }) => {
      const categoryId = queryKey[1];
      const url = categoryId 
        ? `/api/products?category=${categoryId}` 
        : "/api/products";
      
      console.log("Fetching products with URL:", url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      return response.json();
    },
  });
  
  // Fetch all categories
  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });
  
  // Set initial category from URL parameters - watch for changes
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split("?")[1] || "");
    const currentCategoryParam = urlParams.get("category");
    
    if (currentCategoryParam) {
      console.log("Setting category filter from URL parameter:", currentCategoryParam);
      setFilters(prev => {
        if (prev.category !== currentCategoryParam) {
          console.log("Current category:", prev.category, "New category:", currentCategoryParam);
          return { ...prev, category: currentCategoryParam };
        }
        return prev;
      });
    } else {
      // Reset to "all" if no category parameter
      setFilters(prev => {
        if (prev.category !== "all") {
          console.log("No category parameter, resetting to 'all'");
          return { ...prev, category: "all" };
        }
        return prev;
      });
    }
  }, [location]); // Watch location changes instead of just categoryParam
  
  // Log product data for debugging
  useEffect(() => {
    if (products && products.length > 0) {
      console.log("All products:", products.length);
      console.log("Filter category:", filters.category);
      
      if (filters.category !== "all") {
        const matchingProducts = products.filter(p => 
          p.categoryId === parseInt(filters.category)
        );
        console.log(`Products matching category ${filters.category}:`, matchingProducts.length);
      }
    }
  }, [products, filters.category]);

  const filteredProducts = products?.filter((product) => {
    // Filter inactive products
    if (product.active === false) {
      return false;
    }
    
    // Category filtering is now handled by the server via the query parameter
    
    // Filter by search term
    if (filters.search && !product.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    
    // Filter by price range
    const price = parseFloat(product.price);
    if (price < filters.priceRange[0] || price > filters.priceRange[1]) {
      return false;
    }
    
    return true;
  }) || [];
  
  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (filters.sortBy === "price-asc") {
      return parseFloat(a.price) - parseFloat(b.price);
    } else if (filters.sortBy === "price-desc") {
      return parseFloat(b.price) - parseFloat(a.price);
    } else if (filters.sortBy === "name") {
      return a.name.localeCompare(b.name);
    } else {
      // Default: newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });
  
  // Clear all filters
  const clearFilters = () => {
    setFilters({
      category: "all",
      search: "",
      priceRange: [0, 100],
      sortBy: "newest",
    });
  };
  
  // Find the max price for slider
  const maxPrice = products ? Math.max(...products.map((p) => parseFloat(p.price))) : 100;
  
  // Get category name for title
  const getCategoryName = () => {
    if (filters.category === "all" || !categories) return t("products.allProducts");
    const category = categories.find(cat => cat.id === parseInt(filters.category));
    return category ? category.name : t("products.products");
  };

  return (
    <Layout>
      <Helmet>
        <title>{getCategoryName()} | Kerzenwelt by Dani</title>
        <meta name="description" content="Otkrijte našu kolekciju ručno izrađenih svijeća - mirisne, dekorativne i personalizirane svijeće za svaki dom i prigodu." />
      </Helmet>
      
      <div className="bg-background py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
              <h1 className="heading text-3xl font-bold text-foreground">{getCategoryName()}</h1>
              <p className="text-muted-foreground mt-1">
                {sortedProducts.length} {sortedProducts.length === 1 
                  ? t('products.productCountSingular') 
                  : t('products.productCount')}
              </p>
            </div>
            
            <div className="flex mt-4 md:mt-0 space-x-2">
              <Button 
                variant="outline" 
                className="md:hidden"
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              >
                <SlidersHorizontal size={18} className="mr-2" />
                {t('products.filters')}
              </Button>
              
              <Select 
                value={filters.sortBy}
                onValueChange={(value) => setFilters({ ...filters, sortBy: value })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('products.sort')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t('products.newest')}</SelectItem>
                  <SelectItem value="price-asc">{t('products.priceAsc')}</SelectItem>
                  <SelectItem value="price-desc">{t('products.priceDesc')}</SelectItem>
                  <SelectItem value="name">{t('products.nameAZ')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-8">
            {/* Filters sidebar - Desktop */}
            <div className="hidden md:block w-64 shrink-0">
              <div className="bg-card rounded-lg p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-heading font-semibold text-lg text-foreground">{t("products.filters")}</h2>
                  {(filters.category !== "all" || filters.search || filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X size={16} className="mr-1" /> {t("products.clear")}
                    </Button>
                  )}
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-6">
                  {/* Search */}
                  <div>
                    <h3 className="font-medium mb-2 text-foreground">{t("products.search")}</h3>
                    <div className="relative">
                      <Search size={18} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={t("products.searchProducts")}
                        className="pl-9"
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  {/* Categories */}
                  <div>
                    <h3 className="font-medium mb-2 text-foreground">{t('products.categories')}</h3>
                    <Select 
                      value={filters.category}
                      onValueChange={(value) => setFilters({ ...filters, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('products.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('products.allCategories')}</SelectItem>
                        {categories?.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Price range */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <h3 className="font-medium text-foreground">{t('products.price')}</h3>
                      <span className="text-sm text-muted-foreground">
                        {filters.priceRange[0]}€ - {filters.priceRange[1]}€
                      </span>
                    </div>
                    <Slider
                      defaultValue={[0, maxPrice]}
                      min={0}
                      max={maxPrice}
                      step={1}
                      value={filters.priceRange}
                      onValueChange={(value) => setFilters({ ...filters, priceRange: value })}
                      className="my-4"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>0€</span>
                      <span>{maxPrice}€</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Mobile Filters */}
            {mobileFiltersOpen && (
              <div className="fixed inset-0 z-50 bg-black bg-opacity-50 md:hidden">
                <div className="absolute inset-y-0 right-0 w-[300px] bg-background h-full overflow-y-auto">
                  <div className="p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="font-heading font-semibold text-lg text-foreground">{t('products.filters')}</h2>
                      <Button variant="ghost" size="sm" onClick={() => setMobileFiltersOpen(false)}>
                        <X size={18} />
                      </Button>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="space-y-6">
                      {/* Search */}
                      <div>
                        <h3 className="font-medium mb-2 text-foreground">{t('products.search')}</h3>
                        <div className="relative">
                          <Search size={18} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                          <Input
                            type="text"
                            placeholder={t('products.searchProducts')}
                            className="pl-9"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                          />
                        </div>
                      </div>
                      
                      {/* Categories */}
                      <div>
                        <h3 className="font-medium mb-2 text-foreground">{t('products.categories')}</h3>
                        <Select 
                          value={filters.category}
                          onValueChange={(value) => setFilters({ ...filters, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('products.selectCategory')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t('products.allCategories')}</SelectItem>
                            {categories?.map((category) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Price range */}
                      <div>
                        <div className="flex justify-between mb-2">
                          <h3 className="font-medium text-foreground">{t('products.price')}</h3>
                          <span className="text-sm text-muted-foreground">
                            {filters.priceRange[0]}€ - {filters.priceRange[1]}€
                          </span>
                        </div>
                        <Slider
                          defaultValue={[0, maxPrice]}
                          min={0}
                          max={maxPrice}
                          step={1}
                          value={filters.priceRange}
                          onValueChange={(value) => setFilters({ ...filters, priceRange: value })}
                          className="my-4"
                        />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>0€</span>
                          <span>{maxPrice}€</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-8 space-y-3">
                      <Button 
                        onClick={() => {
                          clearFilters();
                          setMobileFiltersOpen(false);
                        }}
                        variant="outline" 
                        className="w-full"
                      >
                        <X size={16} className="mr-2" />
                        {t('products.clearFilters')}
                      </Button>
                      <Button 
                        onClick={() => setMobileFiltersOpen(false)}
                        className="w-full"
                      >
                        {t('products.applyFilters')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Products grid */}
            <div className="flex-1">
              {productsLoading ? (
                <ProductGrid products={[]} isLoading={true} />
              ) : sortedProducts.length === 0 ? (
                <div className="bg-card rounded-lg p-8 text-center">
                  <h3 className="heading text-xl font-semibold mb-2">{t('products.noProducts')}</h3>
                  <p className="text-muted-foreground">
                    {t('products.tryDifferentFilters')}
                  </p>
                  <Button 
                    onClick={clearFilters}
                    variant="outline" 
                    className="mt-4"
                  >
                    {t('products.clearAllFilters')}
                  </Button>
                </div>
              ) : (
                <ProductGrid products={sortedProducts} />
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}