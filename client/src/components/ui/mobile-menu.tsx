import { Fragment } from "react";
import { Link } from "wouter";
import { X, ChevronRight, Instagram } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import LanguageSwitcher from "@/components/language-switcher";
import { useQuery } from "@tanstack/react-query";
import { Category } from "@shared/schema";
import logoImage from "@/assets/logo.png";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { t } = useLanguage();
  
  // Dohvaćanje kategorija iz baze podataka
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });
  
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
        <SheetHeader className="p-6 text-left border-b">
          <div className="flex items-center gap-3">
            <img 
              src={logoImage} 
              alt="Kerzenwelt Logo" 
              className="h-10 w-auto" 
            />
            <div className="flex items-baseline">
              <SheetTitle className="heading text-xl font-bold text-primary">Kerzenwelt</SheetTitle>
              <span className="text-foreground text-sm ml-1 font-bold">by Dani</span>
            </div>
          </div>
        </SheetHeader>
        
        <div className="py-6 px-6">
          <nav className="flex flex-col space-y-1">
            <Link 
              href="/" 
              className="font-body text-text-dark py-2 hover:text-primary" 
              onClick={onClose}
            >
              {t('nav.home')}
            </Link>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="products" className="border-b-0">
                <AccordionTrigger className="font-body text-text-dark py-2 hover:text-primary hover:no-underline">
                  {t('nav.products')}
                </AccordionTrigger>
                <AccordionContent className="pl-4">
                  <div className="flex flex-col space-y-2">
                    {categories && categories.length > 0 ? (
                      <>
                        {categories.map((category) => (
                          <Link 
                            key={category.id} 
                            href={`/products?category=${category.id}`}
                            className="font-body text-text-dark py-1 hover:text-primary flex items-center"
                            onClick={onClose}
                          >
                            <ChevronRight size={14} className="mr-1" />
                            {category.name}
                          </Link>
                        ))}
                        <Link 
                          href="/products"
                          className="font-body text-text-dark py-1 hover:text-primary flex items-center"
                          onClick={onClose}
                        >
                          <ChevronRight size={14} className="mr-1" />
                          {t('nav.allCategories')}
                        </Link>
                      </>
                    ) : (
                      <div className="px-4 py-2 text-gray-500">{t('nav.loadingCategories')}</div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            <Link 
              href="/about"
              className="font-body text-text-dark py-2 hover:text-primary"
              onClick={onClose}
            >
              {t('nav.about')}
            </Link>
            <Link 
              href="/blog"
              className="font-body text-text-dark py-2 hover:text-primary"
              onClick={onClose}
            >
              {t('nav.pictures')}
            </Link>
            <Link 
              href="/contact"
              className="font-body text-text-dark py-2 hover:text-primary"
              onClick={onClose}
            >
              {t('nav.contact')}
            </Link>
            
            <Separator className="my-4" />
            
            {/* Jezični izbornik za mobilni prikaz */}
            <div className="py-2">
              <LanguageSwitcher />
            </div>
            
            <div className="flex items-center py-2">
              <span className="font-body text-text-dark mr-2">{t('footer.followUs')}:</span>
              <a 
                href="https://www.instagram.com/kerzenwelt_by_dani/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-text-dark hover:text-primary transition"
                onClick={onClose}
              >
                <Instagram size={20} />
              </a>
            </div>
            
            <Separator className="my-4" />
            
            <Link 
              href="/auth" 
              className="font-body text-text-dark py-2 hover:text-primary" 
              onClick={onClose}
            >
              {t('nav.login')}
            </Link>
            <Link 
              href="/cart" 
              className="font-body text-text-dark py-2 hover:text-primary" 
              onClick={onClose}
            >
              {t('nav.cart')}
            </Link>
          </nav>
        </div>
        
        <div className="absolute bottom-4 right-4">
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X size={18} />
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
