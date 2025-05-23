import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useTheme } from "./use-theme";

type Theme = "light" | "dark" | "system";
type Language = "hr" | "en" | "de";

interface SettingsContextType {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  // Koristimo next-themes umjesto vlastite implementacije
  const { theme: nextTheme, setTheme: nextSetTheme } = useTheme();
  const [language, setLanguageState] = useState<Language>(() => {
    // Dohvati iz localStorage ako postoji, inače postavi na hr
    if (typeof window !== "undefined") {
      const savedLanguage = localStorage.getItem("language");
      if (savedLanguage && ["hr", "en", "de"].includes(savedLanguage)) {
        return savedLanguage as Language;
      }
    }
    return "hr";
  });

  // Mapiramo next-themes temu na našu temu
  const mappedTheme: Theme = nextTheme as Theme || "system"; 

  // Wrapper za postavljanje jezika koji ažurira DOM i localStorage
  const setLanguage = (newLanguage: Language) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("language", newLanguage);
      document.documentElement.lang = newLanguage;
      setLanguageState(newLanguage);
    }
  };

  // Inicijalno postavi jezik
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  return (
    <SettingsContext.Provider 
      value={{ 
        theme: mappedTheme, 
        language, 
        setTheme: nextSetTheme as (theme: Theme) => void, 
        setLanguage 
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};