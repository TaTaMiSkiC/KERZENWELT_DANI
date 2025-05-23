import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { dynamicImport } from "./lib/dynamic-import";

// Preload samo osnovne komponente koje su dio inicijalnog renderiranja
import HomePage from "@/pages/home-page";
import NotFound from "@/pages/not-found";

// Lazy Loading za korisnički dio aplikacije (uobičajene stranice)
const AuthPage = dynamicImport(() => import("@/pages/auth-page"));
const ProductsPage = dynamicImport(() => import("@/pages/products-page"));
const ProductDetailsPage = dynamicImport(() => import("@/pages/product-details-page"));
const CartPage = dynamicImport(() => import("@/pages/cart-page"));
const CheckoutPage = dynamicImport(() => import("@/pages/checkout-page"));
const OrderSuccessPage = dynamicImport(() => import("@/pages/order-success-page"));
const AboutPage = dynamicImport(() => import("@/pages/about-page"));
const ContactPage = dynamicImport(() => import("@/pages/contact-page"));
const BlogPage = dynamicImport(() => import("@/pages/blog-page"));
const ProfilePage = dynamicImport(() => import("@/pages/profile-page"));
const OrdersPage = dynamicImport(() => import("@/pages/orders-page"));
const OrderDetailsPage = dynamicImport(() => import("@/pages/order-details-page"));
const NewsletterPage = dynamicImport(() => import("@/pages/newsletter-page"));

// Admin komponente (učitavaju se samo kad su potrebne)
const AdminDashboard = dynamicImport(() => import("@/pages/admin/admin-dashboard"));
const AdminProducts = dynamicImport(() => import("@/pages/admin/admin-products"));
const AdminCategories = dynamicImport(() => import("@/pages/admin/admin-categories"));
const AdminScents = dynamicImport(() => import("@/pages/admin/admin-scents"));
const AdminColors = dynamicImport(() => import("@/pages/admin/admin-colors"));
const AdminCollections = dynamicImport(() => import("@/pages/admin/admin-collections"));
const AdminOrders = dynamicImport(() => import("@/pages/admin/admin-orders"));
const AdminUsers = dynamicImport(() => import("@/pages/admin/admin-users"));
const AdminInvoices = dynamicImport(() => import("@/pages/admin/admin-invoices"));
const AdminSubscribers = dynamicImport(() => import("@/pages/admin/admin-subscribers"));
const DeliverySettingsPage = dynamicImport(() => import("@/pages/admin/delivery-settings-page"));
const AdminSettings = dynamicImport(() => import("@/pages/admin/settings-page"));
const PageSettingsPage = dynamicImport(() => import("@/pages/admin/page-settings"));
const ContactSettingsPage = dynamicImport(() => import("@/pages/admin/contact-settings"));
const DocumentManagementPage = dynamicImport(() => import("@/pages/admin/document-management"));

import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { CartProvider } from "./hooks/use-cart";
import { ThemeProvider } from "./hooks/use-theme";
import { LanguageProvider } from "./hooks/use-language";
import CookieConsent from "./components/CookieConsent";

/**
 * Router komponenta koja definira sve rute u aplikaciji
 * Komponente se učitavaju dinamički zbog optimizacije performansi
 */
function Router() {
  return (
    <Switch>
      {/* Glavne stranice - direktno dostupne */}
      <Route path="/">
        <HomePage />
      </Route>
      <Route path="/auth">
        <AuthPage />
      </Route>
      <Route path="/verify-email">
        <AuthPage />
      </Route>
      <Route path="/products">
        <ProductsPage />
      </Route>
      <Route path="/products/:id">
        <ProductDetailsPage />
      </Route>
      <Route path="/cart">
        <CartPage />
      </Route>
      <Route path="/about">
        <AboutPage />
      </Route>
      <Route path="/contact">
        <ContactPage />
      </Route>
      <Route path="/blog">
        <BlogPage />
      </Route>
      <Route path="/newsletter">
        <NewsletterPage />
      </Route>
      
      {/* Zaštićene rute - potrebna prijava */}
      <Route path="/profile">
        <ProtectedRoute path="/profile">
          <ProfilePage />
        </ProtectedRoute>
      </Route>
      <Route path="/orders">
        <ProtectedRoute path="/orders">
          <OrdersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/orders/:id">
        <ProtectedRoute path="/orders/:id">
          <OrderDetailsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/checkout">
        <ProtectedRoute path="/checkout">
          <CheckoutPage />
        </ProtectedRoute>
      </Route>
      <Route path="/order-success">
        <ProtectedRoute path="/order-success">
          <OrderSuccessPage />
        </ProtectedRoute>
      </Route>
        
      {/* Admin rute - zahtijevaju administratorske privilegije */}
      <Route path="/admin">
        <ProtectedRoute path="/admin">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/products">
        <ProtectedRoute path="/admin/products">
          <AdminProducts />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/categories">
        <ProtectedRoute path="/admin/categories">
          <AdminCategories />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/scents">
        <ProtectedRoute path="/admin/scents">
          <AdminScents />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/colors">
        <ProtectedRoute path="/admin/colors">
          <AdminColors />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/collections">
        <ProtectedRoute path="/admin/collections">
          <AdminCollections />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/orders">
        <ProtectedRoute path="/admin/orders">
          <AdminOrders />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/invoices">
        <ProtectedRoute path="/admin/invoices">
          <AdminInvoices />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute path="/admin/users">
          <AdminUsers />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/delivery-settings">
        <ProtectedRoute path="/admin/delivery-settings">
          <DeliverySettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute path="/admin/settings">
          <AdminSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/page-settings">
        <ProtectedRoute path="/admin/page-settings">
          <PageSettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/contact-settings">
        <ProtectedRoute path="/admin/contact-settings">
          <ContactSettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/subscribers">
        <ProtectedRoute path="/admin/subscribers">
          <AdminSubscribers />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/documents">
        <ProtectedRoute path="/admin/documents">
          <DocumentManagementPage />
        </ProtectedRoute>
      </Route>
      
      {/* Stranica za slučaj da ruta nije pronađena */}
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
