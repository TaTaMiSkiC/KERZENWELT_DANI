import { Link } from "wouter";
import {
  Facebook,
  Instagram,
  Linkedin,
  MessageCircle,
  MapPin,
  Phone,
  Mail,
  Clock,
  Loader2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { PageVisitCounter } from "@/components/admin/PageVisitCounter";
import { useLanguage } from "@/hooks/use-language";

export default function Footer() {
  const { t, translateText } = useLanguage();

  // Dohvaćanje kontakt podataka iz API-ja
  const { data: contactData, isLoading } = useQuery({
    queryKey: ["/api/settings/contact"],
    queryFn: async () => {
      const res = await fetch("/api/settings/contact");
      if (!res.ok) {
        throw new Error("Neuspješno dohvaćanje kontakt podataka");
      }
      return await res.json();
    },
  });

  // Sastavljanje pune adrese ako su podaci dostupni
  const fullAddress = contactData
    ? `${contactData.address}, ${contactData.postalCode} ${contactData.city}`
    : "Villach 9500, Österreich";

  return (
    <footer className="bg-text-dark text-white pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Column 1: About */}
          <div>
            <h3 className="heading text-xl font-semibold mb-4">
              Kerzenwelt by Dani
            </h3>
            <p className="text-gray-400 mb-6">{t("footer.tagline")}</p>

            <div className="flex items-center mb-4">
              <span className="text-white mr-2 font-medium">
                {t("footer.followUs")}:
              </span>
              <a
                href="https://www.instagram.com/kerzenwelt_by_dani/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary hover:text-white transition-colors"
              >
                <Instagram size={20} />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="heading text-xl font-semibold mb-4">
              {t("footer.quickLinks")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/products" className="text-gray-400 hover:text-white transition cursor-pointer">
                  {t("nav.products")}
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white transition cursor-pointer">
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-gray-400 hover:text-white transition cursor-pointer">
                  {t("nav.pictures")}
                </Link>
              </li>

              <li>
                <Link href="/contact" className="text-gray-400 hover:text-white transition cursor-pointer">
                  {t("nav.contact")}
                </Link>
              </li>
              <li>
                <Link href="/newsletter" className="text-gray-400 hover:text-white transition cursor-pointer">
                  Newsletter
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Service */}
          <div>
            <h3 className="heading text-xl font-semibold mb-4">
              {t("footer.customerSupport")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/profile" className="text-gray-400 hover:text-white transition cursor-pointer">
                  {t("footer.myAccount")}
                </Link>
              </li>

              <li>
                <Link href="/payment" className="text-gray-400 hover:text-white transition cursor-pointer">
                  {t("footer.paymentMethods")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div>
            <h3 className="heading text-xl font-semibold mb-4">
              {t("nav.contact")}
            </h3>

            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-secondary" />
              </div>
            ) : (
              <ul className="space-y-3">
                <li className="flex items-start">
                  <MapPin size={18} className="mt-1 mr-3 text-secondary" />
                  <span className="text-gray-400">{fullAddress}</span>
                </li>
                <li className="flex items-start">
                  <Phone size={18} className="mt-1 mr-3 text-secondary" />
                  <span className="text-gray-400">
                    {contactData?.phone || "+385 1 234 5678"}
                  </span>
                </li>
                <li className="flex items-start">
                  <Mail size={18} className="mt-1 mr-3 text-secondary" />
                  <span className="text-gray-400">
                    {contactData?.email || "info@kerzenwelt.hr"}
                  </span>
                </li>
                <li className="flex items-start">
                  <Clock size={18} className="mt-1 mr-3 text-secondary" />
                  <span className="text-gray-400">
                    {contactData?.workingHours || "Pon - Pet: 9:00 - 17:00"}
                  </span>
                </li>
              </ul>
            )}
          </div>
        </div>

        <Separator className="bg-gray-800 mb-8" />

        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>
            <p className="text-gray-500 text-sm mb-1">
              &copy; 2025 Kerzenwelt by Dani. {t("footer.copyright")}
            </p>
            <PageVisitCounter />
          </div>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
              alt="PayPal"
              className="h-6"
            />
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg"
              alt="Visa"
              className="h-6"
            />
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg"
              alt="Mastercard"
              className="h-6"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
