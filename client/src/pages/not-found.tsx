import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import Layout from "@/components/layout/Layout";

// Poboljšana 404 stranica s automatskim usmjeravanjem i višejezičnom podrškom
export default function NotFound() {
  const { t, language } = useLanguage();
  
  // Vraćanje na početnu stranicu za 5 sekundi (neće se pozvati ako korisnik klikne na gumb)
  useEffect(() => {
    // Postavi timer za automatski povratak na početnu
    const timer = setTimeout(() => {
      window.location.href = "/";
    }, 5000);
    
    // Očisti timer ako korisnik napusti stranicu
    return () => clearTimeout(timer);
  }, []);
  
  // Prijevodi za poruke na 404 stranici
  const translations = {
    title: {
      de: "404 - Seite nicht gefunden",
      hr: "404 - Stranica nije pronađena",
      en: "404 - Page Not Found",
      it: "404 - Pagina non trovata",
      sl: "404 - Stran ni najdena"
    },
    message: {
      de: "Die gesuchte Seite existiert nicht oder wurde verschoben.",
      hr: "Tražena stranica ne postoji ili je premještena.",
      en: "The page you're looking for doesn't exist or has been moved.",
      it: "La pagina che stai cercando non esiste o è stata spostata.",
      sl: "Stran, ki jo iščete, ne obstaja ali je bila premaknjena."
    },
    backToHome: {
      de: "Zurück zur Startseite",
      hr: "Povratak na početnu stranicu",
      en: "Back to Home",
      it: "Torna alla Home",
      sl: "Nazaj na domačo stran"
    },
    redirectMessage: {
      de: "Sie werden in wenigen Sekunden automatisch zur Startseite weitergeleitet...",
      hr: "Automatski ćete biti preusmjereni na početnu stranicu za nekoliko sekundi...",
      en: "You'll be automatically redirected to the home page in a few seconds...",
      it: "Sarai reindirizzato automaticamente alla home page tra pochi secondi...",
      sl: "V nekaj sekundah boste samodejno preusmerjeni na domačo stran..."
    }
  };
  
  // Dohvati prijevod ovisno o jeziku
  const getTranslation = (key: keyof typeof translations) => {
    const currentLang = language as keyof typeof translations[typeof key];
    return translations[key][currentLang] || translations[key].en;
  };

  return (
    <Layout>
      <div className="min-h-[80vh] w-full flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4 shadow-lg">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center mb-6">
              <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {getTranslation('title')}
              </h1>
              <p className="text-md text-gray-600 mb-6">
                {getTranslation('message')}
              </p>
              <Link href="/">
                <Button className="mb-4">
                  {getTranslation('backToHome')}
                </Button>
              </Link>
              <p className="text-sm text-gray-500 italic">
                {getTranslation('redirectMessage')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
