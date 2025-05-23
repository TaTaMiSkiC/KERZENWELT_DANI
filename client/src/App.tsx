import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Preload samo osnovne komponente koje su dio inicijalnog renderiranja
import HomePage from "@/pages/home-page";
import NotFound from "@/pages/not-found";

// Funkcija za stvaranje lazy-loaded komponentu s ispravnim tipovima
function lazyLoad(importFunc: () => Promise<any>) {
  const LazyComponent = lazy(importFunc);
  return () => (
    <Suspense fallback={<LoadingSpinner />}>
      <LazyComponent />
    </Suspense>
  );
}

// Lazy Loading za ostatak komponenti
const AuthPage = lazyLoad(() => import("@/pages/auth-page"));
const ProductsPage = lazyLoad(() => import("@/pages/products-page"));
const ProductDetailsPage = lazyLoad(() => import("@/pages/product-details-page"));
const CartPage = lazyLoad(() => import("@/pages/cart-page"));
const CheckoutPage = lazyLoad(() => import("@/pages/checkout-page"));
const OrderSuccessPage = lazyLoad(() => import("@/pages/order-success-page"));
const AboutPage = lazyLoad(() => import("@/pages/about-page"));
const ContactPage = lazyLoad(() => import("@/pages/contact-page"));
const BlogPage = lazyLoad(() => import("@/pages/blog-page"));
const ProfilePage = lazyLoad(() => import("@/pages/profile-page"));
const OrdersPage = lazyLoad(() => import("@/pages/orders-page"));
const OrderDetailsPage = lazyLoad(() => import("@/pages/order-details-page"));
const NewsletterPage = lazyLoad(() => import("@/pages/newsletter-page"));

// Admin komponente (učitavaju se samo kad su potrebne)
const AdminDashboard = lazyLoad(() => import("@/pages/admin/admin-dashboard"));
const AdminProducts = lazyLoad(() => import("@/pages/admin/admin-products"));
const AdminCategories = lazyLoad(() => import("@/pages/admin/admin-categories"));
const AdminScents = lazyLoad(() => import("@/pages/admin/admin-scents"));
const AdminColors = lazyLoad(() => import("@/pages/admin/admin-colors"));
const AdminCollections = lazyLoad(() => import("@/pages/admin/admin-collections"));
const AdminOrders = lazyLoad(() => import("@/pages/admin/admin-orders"));
const AdminUsers = lazyLoad(() => import("@/pages/admin/admin-users"));
const AdminInvoices = lazyLoad(() => import("@/pages/admin/admin-invoices"));
const AdminSubscribers = lazyLoad(() => import("@/pages/admin/admin-subscribers"));
const DeliverySettingsPage = lazyLoad(() => import("@/pages/admin/delivery-settings-page"));
const AdminSettings = lazyLoad(() => import("@/pages/admin/settings-page"));
const PageSettingsPage = lazyLoad(() => import("@/pages/admin/page-settings"));
const ContactSettingsPage = lazyLoad(() => import("@/pages/admin/contact-settings"));
const DocumentManagementPage = lazyLoad(() => import("@/pages/admin/document-management"));

import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { CartProvider } from "./hooks/use-cart";
import { ThemeProvider } from "./hooks/use-theme";
import { LanguageProvider } from "./hooks/use-language";
import CookieConsent from "./components/CookieConsent";

// Komponenta za prikaz učitavanja
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center w-full h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="ml-2">Učitavanje...</span>
    </div>
  );
}

// Komponenta s Suspense wrapperom
const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
);

function Router() {
  return (
    <Switch>
      <Route path="/">
        <HomePage />
      </Route>
      <Route path="/auth">
        <SuspenseWrapper>
          <AuthPage />
        </SuspenseWrapper>
      </Route>
      <Route path="/verify-email">
        <SuspenseWrapper>
          <AuthPage />
        </SuspenseWrapper>
      </Route>
      <Route path="/products">
        <SuspenseWrapper>
          <ProductsPage />
        </SuspenseWrapper>
      </Route>
      <Route path="/products/:id">
        <SuspenseWrapper>
          <ProductDetailsPage />
        </SuspenseWrapper>
      </Route>
      <Route path="/cart">
        <SuspenseWrapper>
          <CartPage />
        </SuspenseWrapper>
      </Route>
      <Route path="/about">
        <SuspenseWrapper>
          <AboutPage />
        </SuspenseWrapper>
      </Route>
      <Route path="/contact">
        <SuspenseWrapper>
          <ContactPage />
        </SuspenseWrapper>
      </Route>
      <Route path="/blog">
        <SuspenseWrapper>
          <BlogPage />
        </SuspenseWrapper>
      </Route>
      <Route path="/newsletter">
        <SuspenseWrapper>
          <NewsletterPage />
        </SuspenseWrapper>
      </Route>
      
      {/* Zaštićene rute */}
      <Route path="/profile">
        <ProtectedRoute path="/profile">
          <SuspenseWrapper>
            <ProfilePage />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/orders">
        <ProtectedRoute path="/orders">
          <SuspenseWrapper>
            <OrdersPage />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/orders/:id">
        <ProtectedRoute path="/orders/:id">
          <SuspenseWrapper>
            <OrderDetailsPage />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/checkout">
        <ProtectedRoute path="/checkout">
          <SuspenseWrapper>
            <CheckoutPage />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/order-success">
        <ProtectedRoute path="/order-success">
          <SuspenseWrapper>
            <OrderSuccessPage />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
        
      {/* Admin rute - učitavaju se naknadno */}
      <Route path="/admin">
        <ProtectedRoute path="/admin">
          <SuspenseWrapper>
            <AdminDashboard />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/products">
        <ProtectedRoute path="/admin/products">
          <SuspenseWrapper>
            <AdminProducts />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/categories">
        <ProtectedRoute path="/admin/categories">
          <SuspenseWrapper>
            <AdminCategories />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/scents">
        <ProtectedRoute path="/admin/scents">
          <SuspenseWrapper>
            <AdminScents />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/colors">
        <ProtectedRoute path="/admin/colors">
          <SuspenseWrapper>
            <AdminColors />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/collections">
        <ProtectedRoute path="/admin/collections">
          <SuspenseWrapper>
            <AdminCollections />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/orders">
        <ProtectedRoute path="/admin/orders">
          <SuspenseWrapper>
            <AdminOrders />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/invoices">
        <ProtectedRoute path="/admin/invoices">
          <SuspenseWrapper>
            <AdminInvoices />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute path="/admin/users">
          <SuspenseWrapper>
            <AdminUsers />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/delivery-settings">
        <ProtectedRoute path="/admin/delivery-settings">
          <SuspenseWrapper>
            <DeliverySettingsPage />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute path="/admin/settings">
          <SuspenseWrapper>
            <AdminSettings />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/page-settings">
        <ProtectedRoute path="/admin/page-settings">
          <SuspenseWrapper>
            <PageSettingsPage />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/contact-settings">
        <ProtectedRoute path="/admin/contact-settings">
          <SuspenseWrapper>
            <ContactSettingsPage />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/subscribers">
        <ProtectedRoute path="/admin/subscribers">
          <SuspenseWrapper>
            <AdminSubscribers />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/documents">
        <ProtectedRoute path="/admin/documents">
          <SuspenseWrapper>
            <DocumentManagementPage />
          </SuspenseWrapper>
        </ProtectedRoute>
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <CartProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
                <CookieConsent />
              </TooltipProvider>
            </CartProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
