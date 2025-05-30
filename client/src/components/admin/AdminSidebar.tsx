import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  CreditCard,
  Flame,
  TagsIcon,
  Sparkles,
  Palette,
  Truck,
  Mail,
  FileText,
  RefreshCw,
  Grid,
  Layers,
  FileCog,
  Inbox, // Stelle sicher, dass Inbox importiert ist
  Globe, // <-- NEU: Globe-Icon importieren
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { Badge } from "@/components/ui/badge"; // Importiere die Badge-Komponente
import { useUnreadEmailCount } from "@/hooks/use-unread-email-count"; // <-- NEU: Importiere den Hook

interface AdminSidebarProps {
  onItemClick?: () => void;
}

export default function AdminSidebar({ onItemClick }: AdminSidebarProps) {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { unreadCount } = useUnreadEmailCount(); // <-- NEU: Verwende den Hook

  const isActive = (path: string) => {
    return location === path;
  };

  const menuItems = [
    {
      name: t("admin.dashboard.title"),
      path: "/admin",
      icon: <LayoutDashboard size={20} />,
    },
    {
      name: t("admin.products"),
      path: "/admin/products",
      icon: <Package size={20} />,
    },
    {
      name: t("admin.categories"),
      path: "/admin/categories",
      icon: <TagsIcon size={20} />,
    },
    {
      name: t("admin.scents"),
      path: "/admin/scents",
      icon: <Sparkles size={20} />,
    },
    {
      name: t("admin.colors"),
      path: "/admin/colors",
      icon: <Palette size={20} />,
    },
    {
      name: t("admin.collections"),
      path: "/admin/collections",
      icon: <Layers size={20} />,
    },
    {
      name: t("admin.orders"),
      path: "/admin/orders",
      icon: <ShoppingCart size={20} />,
    },
    {
      name: t("admin.invoices"),
      path: "/admin/invoices",
      icon: <FileText size={20} />,
    },
    {
      name: t("admin.users"),
      path: "/admin/users",
      icon: <Users size={20} />,
    },
    {
      name: "Newsletter pretplatnici",
      path: "/admin/subscribers",
      icon: <Mail size={20} />,
    },
    {
      name: t("admin.payments"),
      path: "/admin/payments",
      icon: <CreditCard size={20} />,
    },
    // Postavke grupa
    {
      name: t("admin.pageSettings"),
      path: "/admin/page-settings",
      icon: <Settings size={20} />,
    },
    {
      name: t("admin.contactSettings"),
      path: "/admin/contact-settings",
      icon: <Mail size={20} />,
    },
    {
      name: t("admin.delivery"),
      path: "/admin/delivery-settings",
      icon: <Truck size={20} />,
    },
    {
      name: t("admin.documents"),
      path: "/admin/documents",
      icon: <FileCog size={20} />,
    },
    {
      name: t("admin.inbox"),
      path: "/admin/emails",
      icon: <Inbox size={20} />,
      badgeCount: unreadCount,
    },
    {
      // <-- NEU: Menüpunkt für Besucherstatistik
      name: t("admin.visitorStats"), // Dieser Schlüssel muss in deine Sprachdateien
      path: "/admin/visitor-stats",
      icon: <Globe size={20} />,
    },
  ];

  return (
    <div className="h-full bg-primary text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center px-6 py-6 border-b border-primary-foreground/10">
        <Flame size={24} className="mr-2" />
        <span className="text-xl font-bold">{t("admin.panel")}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            onClick={onItemClick}
            className={`flex items-center px-4 py-3 rounded-md transition-colors ${
              isActive(item.path)
                ? "bg-white/10 text-white"
                : "text-primary-foreground/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="mr-3">{item.icon}</span>
            <span>{item.name}</span>
            {item.badgeCount !== undefined &&
              item.badgeCount > 0 && ( // <-- NEU: Badge anzeigen
                <Badge className="ml-auto min-w-[24px] px-1 py-0.5 rounded-full text-xs font-semibold bg-red-500 text-white flex items-center justify-center">
                  {item.badgeCount}
                </Badge>
              )}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-primary-foreground/10">
        <Link
          href="/"
          className="flex items-center text-sm text-primary-foreground/70 hover:text-white"
          onClick={onItemClick}
        >
          ← {t("admin.backToStore")}
        </Link>
      </div>
    </div>
  );
}
