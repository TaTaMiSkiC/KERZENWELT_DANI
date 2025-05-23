import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef, memo } from "react";
import candleBackground from "@/assets/candle-background.jpg";
import { useLanguage } from "@/hooks/use-language";

// Define TitleItem interface
type TitleItem = {
  text: string;
  fontSize: string;
  fontWeight: string;
  color: string;
  fontFamily?: string;
};

// Define HeroSettings interface
type HeroSettings = {
  titleText: Record<string, TitleItem[]>;
  subtitleText: Record<string, string>;
  subtitleFontSize: string;
  subtitleFontWeight: string;
  subtitleColor: string;
};

export default function Hero() {
  const { t, language } = useLanguage();
  
  // Fetch hero settings from API
  const { data: heroSettings } = useQuery<HeroSettings | null>({
    queryKey: ["/api/settings/hero"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/settings/hero");
        if (!response.ok) {
          throw new Error("Failed to fetch hero settings");
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching hero settings:", error);
        return null;
      }
    }
  });
  
  // Get title array for the current language
  const getTitleItemsArray = (): TitleItem[] => {
    // Dohvati iz baze podataka
    if (heroSettings?.titleText && heroSettings.titleText[language]) {
      return heroSettings.titleText[language];
    }
    
    // Prazan niz ako nema podataka
    return [];
  };
  
  const getSubtitleText = () => {
    // Dohvati iz baze podataka
    if (heroSettings?.subtitleText && heroSettings.subtitleText[language]) {
      return heroSettings.subtitleText[language];
    }
    
    // Prazan tekst ako nema podataka
    return "";
  };
  
  // Use inline styles for custom font properties
  const getTitleClasses = () => {
    return "heading";
  };
  
  const getSubtitleClasses = () => {
    const classes = ["mb-8"];
    
    // Use default tailwind classes if settings not available
    if (!heroSettings) {
      classes.push("text-lg md:text-xl font-normal");
    }
    
    return classes.join(" ");
  };
  
  // Get CSS properties for subtitle styling
  const getSubtitleStyle = () => {
    if (!heroSettings) return { color: "white", opacity: 0.9 };
    
    return {
      color: heroSettings.subtitleColor || "white",
      fontSize: getFontSizeValue(heroSettings.subtitleFontSize),
      fontWeight: getFontWeightValue(heroSettings.subtitleFontWeight)
    };
  };
  
  // Helper function to convert tailwind class to CSS size
  function getFontSizeValue(size: string | undefined) {
    if (!size) return undefined;
    
    // Handle responsive sizes by taking the first value
    const firstSize = size.split(" ")[0];
    const sizeMap: Record<string, string> = {
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
      "6xl": "3.75rem",
    };
    
    // Extract the size from something like "4xl" from "4xl md:text-5xl lg:text-6xl"
    const match = firstSize.match(/(\d?xl|\w+)$/);
    return match && sizeMap[match[0]] ? sizeMap[match[0]] : undefined;
  }
  
  // Helper function to convert tailwind weight to CSS weight
  function getFontWeightValue(weight: string | undefined) {
    if (!weight) return undefined;
    
    const weightMap: Record<string, string> = {
      thin: "100",
      extralight: "200",
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
      black: "900",
    };
    
    return weightMap[weight] || undefined;
  };
  
  // Dohvaćamo reference na elemente za LCP optimizaciju  
  const sectionRef = useRef<HTMLElement>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  // Optimizirano učitavanje pozadinske slike - rješava problem s LCP
  useEffect(() => {
    // Kreiraj novu sliku za prethodnu optimizaciju
    const img = new Image();
    // Označi ovu sliku kao visoki prioritet za LCP
    img.fetchPriority = "high";
    
    // Callback kad se slika učita
    img.onload = () => {
      setIsImageLoaded(true);
      
      // Primijeni sliku direktno na DOM element radi bržeg učitavanja
      if (sectionRef.current) {
        sectionRef.current.style.backgroundImage = `url(${candleBackground})`;
        
        // Označi LCP element kao učitan (pomaže browseru definirati LCP)
        const lcpMetric = {
          element: sectionRef.current,
          startTime: performance.now()
        };
        if ('LargestContentfulPaint' in window) {
          // @ts-ignore - Moderni browseri podržavaju PerformanceObserver
          const lcpObserver = new PerformanceObserver(() => {});
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        }
      }
    };
    
    // Postavimo src atribut nakon što smo definirali onload handler - ovo je kritično za optimizaciju
    img.src = candleBackground;
  }, []);
  
  return (
    <section 
      ref={sectionRef}
      className={`relative h-[70vh] md:h-[80vh] bg-cover bg-center${isImageLoaded ? '' : ' bg-slate-800'}`}
      // Posebno optimiziran LCP element za problem od 3.46s
      style={{
        // Koristi inline stil kako bi odmah prikazao neku pozadinu umjesto čekanja na potpuno učitavanje slike
        backgroundImage: isImageLoaded ? `url(${candleBackground})` : 'none',
        contentVisibility: 'auto',
        contain: 'layout paint',
        containIntrinsicSize: '100% 600px',
      }}
      // Dodajemo posebne HTML atribute za browsere i optimizaciju
      data-lcp-element="true"
      fetchPriority="high"
    >
      {/* Preloaded optimizirana verzija slike */}
      <link rel="preload" href={candleBackground} as="image" fetchPriority="high" />
      
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>
      <div className="container mx-auto px-4 h-full flex items-center relative z-10">
        <div className="max-w-xl">
          <div className="mb-4">
            {/* Optimiziran prikaz teksta za LCP element */}
            {getTitleItemsArray().length > 0 ? 
              getTitleItemsArray().map((titleItem: TitleItem, index: number) => (
                <h1 
                  key={index}
                  className={`${getTitleClasses()} ${index > 0 ? "mt-1" : ""} ${titleItem.fontFamily || ""}`}
                  style={{
                    color: titleItem.color || "white",
                    fontSize: getFontSizeValue(titleItem.fontSize) || (index === 0 ? "2.25rem" : index === 1 ? "3rem" : "1.875rem"),
                    fontWeight: getFontWeightValue(titleItem.fontWeight) || (index === 1 ? "700" : "500")
                  }}
                >
                  {titleItem.text}
                </h1>
              )) : 
              // Fallback za LCP element kad nema podataka iz baze
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Willkommen Kerzenwelt by Dani
              </h1>
            }
          </div>
          <p 
            className={getSubtitleClasses()}
            style={getSubtitleStyle()}
          >
            {getSubtitleText() || "Wo Kerzen Wärme und Stil vereinen"}
          </p>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <Link href="/products">
              <Button 
                size="lg" 
                className="w-full sm:w-auto"
              >
                {t('home.exploreCollection')}
              </Button>
            </Link>
            <Link href="/about">
              <Button 
                size="lg" 
                variant="outline" 
                className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary w-full sm:w-auto"
              >
                {t('home.aboutUs')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
