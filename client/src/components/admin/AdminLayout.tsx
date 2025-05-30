import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Menu, Search, User, Globe, Inbox } from "lucide-react"; // Hinzugefügt: Globe, Inbox
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AdminNotifications from "./AdminNotifications";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import AdminSidebar from "./AdminSidebar";
import LanguageSwitcher from "@/components/language-switcher";
import { useLanguage } from "@/hooks/use-language";
import { Badge } from "@/components/ui/badge"; // Hinzugefügt: Badge
import { useUnreadEmailCount } from "@/hooks/use-unread-email-count"; // Hinzugefügt: useUnreadEmailCount

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const { user, isLoading, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useLanguage();
  const { unreadCount } = useUnreadEmailCount(); // Für die Badge-Anzeige

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!user.isAdmin) {
    return <Redirect to="/" />;
  }

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate("/");
      },
    });
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <AdminSidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 md:pl-64">
        {/* Top Navigation */}
        <header className="sticky top-0 z-10 bg-white flex justify-between items-center px-4 py-2 border-b shadow-sm">
          <div className="flex items-center">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <AdminSidebar onItemClick={() => setIsMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-medium ml-4">{title}</h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative hidden sm:block w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input placeholder={t("admin.search")} className="pl-8" />
            </div>

            <AdminNotifications />

            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/")}>
                  {t("admin.backToStore")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  {t("auth.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        {/* ✅ KORREKTUR: overflow-y-auto von hier entfernen */}
        {/* Das Scrollen wird nun von den einzelnen Seiten (z.B. AdminMailboxPage) übernommen */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
