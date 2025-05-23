import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
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
  
  // Default titles za svaki jezik da ne dođe do prikaza ključeva prijevoda
  const defaultTitles = {
    de: [
      { text: "Willkommen", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: "Kerzenwelt by Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: "Wo Kerzen Wärme und Stil vereinen", fontSize: "xl", fontWeight: "medium", color: "white" },
    ],
    hr: [
      { text: "Dobrodošli", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: "Svijet svijeća by Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: "Gdje se toplina i stil spajaju", fontSize: "xl", fontWeight: "medium", color: "white" },
    ],
    en: [
      { text: "Welcome", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: "The Candle World by Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: "Where warmth and style unite", fontSize: "xl", fontWeight: "medium", color: "white" },
    ],
    it: [
      { text: "Benvenuti", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: "Il mondo delle candele di Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: "Dove calore e stile si incontrano", fontSize: "xl", fontWeight: "medium", color: "white" },
    ],
    sl: [
      { text: "Dobrodošli", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: "Svet sveč by Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: "Kjer se toplina in stil združita", fontSize: "xl", fontWeight: "medium", color: "white" },
    ]
  };

  // Get title array for the current language, or fallback to translation
  const getTitleItemsArray = (): TitleItem[] => {
    // Prvo provjeri postavke iz baze
    if (heroSettings?.titleText && heroSettings.titleText[language]) {
      return heroSettings.titleText[language];
    }
    
    // Zatim provjeri defaultne vrijednosti za jezik
    if (defaultTitles[language as keyof typeof defaultTitles]) {
      return defaultTitles[language as keyof typeof defaultTitles];
    }
    
    // Krajnji fallback na prijevode (ovo bi trebalo rijetko biti potrebno)
    return [
      { text: t('home.heroTitle1') || "Welcome", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: t('home.heroTitle2') || "Kerzenwelt by Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: t('home.heroTitle3') || "Where warmth and style unite", fontSize: "xl", fontWeight: "medium", color: "white" }
    ];
  };
  
  // Default podnaslovi za sve jezike
  const defaultSubtitles = {
    de: "Handgemachte Kerzen aus natürlichen Inhaltsstoffen",
    hr: "Ručno izrađene svijeće od prirodnih sastojaka",
    en: "Handmade candles from natural ingredients",
    it: "Candele artigianali da ingredienti naturali",
    sl: "Ročno izdelane sveče iz naravnih sestavin"
  };

  const getSubtitleText = () => {
    // Prvo provjeri postavke iz baze
    if (heroSettings?.subtitleText && heroSettings.subtitleText[language]) {
      return heroSettings.subtitleText[language];
    }
    
    // Zatim provjeri defaultne vrijednosti za jezik
    if (defaultSubtitles[language as keyof typeof defaultSubtitles]) {
      return defaultSubtitles[language as keyof typeof defaultSubtitles];
    }
    
    // Krajnji fallback na prijevode
    return t('home.heroSubtitle') || "Handmade candles from natural ingredients";
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
  
  return (
    <section className="relative h-[70vh] md:h-[80vh] bg-cover bg-center" style={{ backgroundImage: `url(${candleBackground})` }}>
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>
      <div className="container mx-auto px-4 h-full flex items-center relative z-10">
        <div className="max-w-xl">
          <div className="mb-4">
            {getTitleItemsArray().map((titleItem: TitleItem, index: number) => (
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
            ))}
          </div>
          <p 
            className={getSubtitleClasses()}
            style={getSubtitleStyle()}
          >
            {getSubtitleText()}
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
