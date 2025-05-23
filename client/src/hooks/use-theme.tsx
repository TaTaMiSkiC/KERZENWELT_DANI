import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Definiramo moguće teme
type Theme = "light" | "dark" | "system";

// Definirano što kontekst treba sadržavati
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// Postavljamo defaultnu vrijednost konteksta
const defaultTheme: ThemeContextType = {
  theme: "light",
  setTheme: () => {}, // Prazna funkcija kao početna vrijednost
};

// Kreiramo kontekst s defaultnom vrijednošću
const ThemeContext = createContext<ThemeContextType>(defaultTheme);

// Funkcija za primjenu teme na HTML element
function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  
  const root = window.document.documentElement;
  
  // Ukloni sve klase tema
  root.classList.remove("light", "dark");
  
  // Postavi odgovarajuću temu
  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
}

// Običan React Provider koji koristi hooks kako treba
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Dohvati početnu temu iz localStorage
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    
    const savedTheme = localStorage.getItem("theme") as Theme;
    return (savedTheme && ["light", "dark", "system"].includes(savedTheme))
      ? savedTheme
      : "light";
  });
  
  const setTheme = (newTheme: Theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
    }
    setThemeState(newTheme);
    applyTheme(newTheme);
  };
  
  // Primijeni temu i slušaj promjene sistemske teme
  useEffect(() => {
    applyTheme(theme);
    
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        if (theme === "system") {
          applyTheme("system");
        }
      };
      
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook za korištenje teme u komponentama
export function useTheme() {
  return useContext(ThemeContext);
}