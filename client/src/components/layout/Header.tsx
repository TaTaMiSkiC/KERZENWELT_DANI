import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { 
  Search, 
  User, 
  ShoppingBag, 
  ChevronDown, 
  Menu,
  Instagram
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "@/components/ui/mobile-menu";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useLanguage } from "@/hooks/use-language";
import LanguageSwitcher from "@/components/language-switcher";
import logoImage from "@/assets/new-logo.png";
import { useQuery } from "@tanstack/react-query";
import { Category } from "@shared/schema";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, logoutMutation } = useAuth();
  const { cartItems } = useCart();
  const { language, t } = useLanguage();
  const [location] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Dohvaćanje kategorija iz baze podataka
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Dodajemo event listener za zatvaranje dropdown-a kada se klikne izvan
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const cartItemCount = cartItems?.length || 0;

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  // Funkcija za promjenu teme je trenutno isključena
  // const toggleTheme = () => {
  //   setTheme(theme === 'dark' ? 'light' : 'dark');
  // };

  return (
    <header className="bg-background shadow-sm sticky top-0 z-50 border-b">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" 
               onClick={() => window.location.href = '/'}>
            <img 
              src={logoImage} 
              alt="Kerzenwelt Logo" 
              className="h-10 md:h-16 w-auto" 
            />
            <div className="flex flex-col md:flex-row md:items-baseline">
              <span className="text-[#D4AF37] heading text-xl md:text-3xl font-bold text-center md:text-left">
                Kerzenwelt
              </span>
              <span className="text-[#D4AF37] text-sm md:text-xl md:ml-1 font-bold text-center md:text-left">
                by Dani
              </span>
            </div>
          </div>
          
          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link 
              href="/"
              className={`font-body hover:text-[#D4AF37] transition cursor-pointer ${location === '/' ? 'text-[#D4AF37]' : 'text-foreground'}`}
            >
              {t('nav.home')}
            </Link>
            
            <div className="relative dropdown-container" ref={dropdownRef}>
              <button 
                className="font-body text-foreground hover:text-[#D4AF37] transition flex items-center gap-1 outline-none"
                onClick={(e) => {
                  e.stopPropagation(); // Spriječiti propagaciju klika na dokument
                  setDropdownOpen(!dropdownOpen);
                }}
              >
                {t('nav.products')}
                <ChevronDown size={14} />
              </button>
              <div 
                id="products-dropdown" 
                className={`absolute left-0 top-full mt-2 ${dropdownOpen ? 'block' : 'hidden'} w-56 rounded-md bg-white shadow-lg py-1 z-50`}
              >
                {categories && categories.length > 0 ? (
                  <>
                    {categories.map((category) => (
                      <Link 
                        key={category.id}
                        href={`/products?category=${category.id}`}
                        className="block px-4 py-2 hover:bg-gray-100 cursor-pointer text-gray-900"
                        onClick={() => setDropdownOpen(false)}
                      >
                        {category.name}
                      </Link>
                    ))}
                    <Link 
                      href="/products"
                      className="block px-4 py-2 hover:bg-gray-100 cursor-pointer text-gray-900"
                      onClick={() => setDropdownOpen(false)}
                    >
                      {t('nav.allCategories')}
                    </Link>
                  </>
                ) : (
                  <div className="px-4 py-2 text-gray-500">{t('nav.loadingCategories')}</div>
                )}
              </div>
            </div>
            
            <div 
              className={`font-body hover:text-[#D4AF37] transition cursor-pointer ${location === '/about' ? 'text-[#D4AF37]' : 'text-foreground'}`}
              onClick={() => window.location.href = '/about'}
            >
              {t('nav.about')}
            </div>
            
            <div 
              className={`font-body hover:text-[#D4AF37] transition cursor-pointer ${location === '/blog' ? 'text-[#D4AF37]' : 'text-foreground'}`}
              onClick={() => window.location.href = '/blog'}
            >
              {t('nav.pictures')}
            </div>
            
            <div 
              className={`font-body hover:text-[#D4AF37] transition cursor-pointer ${location === '/contact' ? 'text-[#D4AF37]' : 'text-foreground'}`}
              onClick={() => window.location.href = '/contact'}
            >
              {t('nav.contact')}
            </div>
          </nav>
          
          {/* User actions */}
          <div className="flex items-center space-x-4 md:space-x-4">
            <div className="hidden md:flex items-center gap-1 mr-2">
              <span className="text-foreground text-sm font-medium">{t('footer.followUs')}:</span>
              <a 
                href="https://www.instagram.com/kerzenwelt_by_dani/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-foreground hover:text-[#D4AF37] transition ml-1"
              >
                <Instagram size={20} />
              </a>
            </div>
            
            {/* Language Switcher */}
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            
            <div className="ml-auto mr-4 md:ml-0 md:mr-0">
              <SearchDialog />
            </div>
            
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-foreground hover:text-[#D4AF37] hover:bg-transparent">
                    <User size={20} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user.isAdmin && (
                    <DropdownMenuItem>
                      <div className="cursor-pointer w-full" onClick={() => window.location.href = '/admin'}>
                        {t('nav.adminPanel')}
                      </div>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    <div className="cursor-pointer w-full" onClick={() => window.location.href = '/profile'}>
                      {t('nav.myProfile')}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/orders" className="cursor-pointer w-full">
                      {t('nav.myOrders')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    {t('nav.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="text-foreground hover:text-[#D4AF37] transition cursor-pointer" onClick={() => window.location.href = '/auth'}>
                <User size={20} />
              </div>
            )}
            
            <div className="text-foreground hover:text-[#D4AF37] transition relative cursor-pointer" onClick={() => window.location.href = '/cart'}>
              <ShoppingBag size={20} />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#D4AF37] text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </div>
            
            {/* Mobile menu toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden text-foreground hover:text-[#D4AF37] hover:bg-transparent"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      <MobileMenu 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
      />
    </header>
  );
}
