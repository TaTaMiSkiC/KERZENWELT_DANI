// client/src/App.tsx
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/hooks/use-toast"; // ili gdje god si smjestio
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/hooks/use-settings";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ProductsPage from "@/pages/products-page";
import ProductDetailsPage from "@/pages/product-details-page";
import CartPage from "@/pages/cart-page";
import CheckoutPage from "@/pages/checkout-page";
import OrderSuccessPage from "@/pages/order-success-page";
import OrderSuccessPageNew from "@/pages/order-success-page-new";
import AboutPage from "@/pages/about-page";
import ContactPage from "@/pages/contact-page";
import BlogPage from "@/pages/blog-page";
import ProfilePage from "@/pages/profile-page";
import OrdersPage from "@/pages/orders-page";
import OrderDetailsPage from "@/pages/order-details-page";
import NewsletterPage from "@/pages/newsletter-page";
import AdminDashboard from "@/pages/admin/admin-dashboard";
import AdminProducts from "@/pages/admin/admin-products";
import AdminCategories from "@/pages/admin/admin-categories";
import AdminScents from "@/pages/admin/admin-scents";
import AdminColors from "@/pages/admin/admin-colors";
import AdminCollections from "@/pages/admin/admin-collections";
import AdminOrders from "@/pages/admin/admin-orders";
import AdminUsers from "@/pages/admin/admin-users";
import AdminInvoices from "@/pages/admin/admin-invoices";
import AdminSubscribers from "@/pages/admin/admin-subscribers";
import DeliverySettingsPage from "@/pages/admin/delivery-settings-page";
import AdminSettings from "@/pages/admin/settings-page";
import PageSettingsPage from "@/pages/admin/page-settings";
import ContactSettingsPage from "@/pages/admin/contact-settings";
import DocumentManagementPage from "@/pages/admin/document-management";
import AdminMailboxPage from "@/pages/admin/AdminMailboxPage"; // NEU IMPORTIEREN
import VisitorStatsPage from "@/pages/admin/VisitorStatsPage";
import AdminPaymentsPage from "@/pages/admin/AdminPaymentsPage";

import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { CartProvider } from "./hooks/use-cart";
import { ThemeProvider } from "./hooks/use-theme";
import { LanguageProvider } from "./hooks/use-language";
import CookieConsent from "./components/CookieConsent";
// import { SecurityProvider } from "./components/SecurityProvider"; // <--- Pobrini se da je ovo ispravan import

function Router() {
  return (
    <Switch>
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
      <Route path="/profile">
        <ProtectedRoute path="/profile" component={ProfilePage} />
      </Route>
      <Route path="/orders">
        <ProtectedRoute path="/orders" component={OrdersPage} />
      </Route>
      <Route path="/orders/:id">
        <ProtectedRoute path="/orders/:id" component={OrderDetailsPage} />
      </Route>
      <Route path="/checkout">
        <ProtectedRoute path="/checkout" component={CheckoutPage} />
      </Route>
      <Route path="/order-success-new">
        {/* Nova stranica za obradu narudžbe koja ne zahtijeva autentifikaciju */}
        <OrderSuccessPageNew />
      </Route>
      <Route path="/order-success">
        <ProtectedRoute path="/order-success" component={OrderSuccessPage} />
      </Route>
      {/* Admin rute - osigurano sa ProtectedRoute, ali SecurityProvider će se brinuti za DevTools */}
      <Route path="/admin">
        <ProtectedRoute path="/admin" component={AdminDashboard} />
      </Route>
      <Route path="/admin/products">
        <ProtectedRoute path="/admin/products" component={AdminProducts} />
      </Route>
      <Route path="/admin/categories">
        <ProtectedRoute path="/admin/categories" component={AdminCategories} />
      </Route>
      <Route path="/admin/scents">
        <ProtectedRoute path="/admin/scents" component={AdminScents} />
      </Route>
      <Route path="/admin/colors">
        <ProtectedRoute path="/admin/colors" component={AdminColors} />
      </Route>
      <Route path="/admin/collections">
        <ProtectedRoute
          path="/admin/collections"
          component={AdminCollections}
        />
      </Route>
      <Route path="/admin/orders">
        <ProtectedRoute path="/admin/orders" component={AdminOrders} />
      </Route>
      <Route path="/admin/invoices">
        <ProtectedRoute path="/admin/invoices" component={AdminInvoices} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute path="/admin/users" component={AdminUsers} />
      </Route>
      <Route path="/admin/delivery-settings">
        <ProtectedRoute
          path="/admin/delivery-settings"
          component={DeliverySettingsPage}
        />
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute path="/admin/settings" component={AdminSettings} />
      </Route>
      <Route path="/admin/page-settings">
        <ProtectedRoute
          path="/admin/page-settings"
          component={PageSettingsPage}
        />
      </Route>
      <Route path="/admin/contact-settings">
        <ProtectedRoute
          path="/admin/contact-settings"
          component={ContactSettingsPage}
        />
      </Route>
      <Route path="/admin/subscribers">
        <ProtectedRoute
          path="/admin/subscribers"
          component={AdminSubscribers}
        />
      </Route>
      <Route path="/admin/emails">
        <ProtectedRoute
          path="/admin/emails"
          component={AdminMailboxPage}
        />
      </Route>
      <Route path="/admin/visitor-stats">
        <VisitorStatsPage />
      </Route>
      <Route path="/admin/documents">
        <ProtectedRoute
          path="/admin/documents"
          component={DocumentManagementPage}
        />
      </Route>
      <Route path="/admin/payments">
        <ProtectedRoute
          path="/admin/payments"
          component={AdminPaymentsPage}
        />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              {/* <SecurityProvider> */}
              <CartProvider>
                <SettingsProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Router />
                    <CookieConsent />
                  </TooltipProvider>
                </SettingsProvider>
              </CartProvider>
              {/* </SecurityProvider> */}
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
