import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Funkcija za primjenu teme na HTML element
function applyTheme(theme: Theme) {
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

// Dohvati početnu temu iz localStorage
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  
  const savedTheme = localStorage.getItem("theme") as Theme;
  return (savedTheme && ["light", "dark", "system"].includes(savedTheme))
    ? savedTheme
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  
  const setTheme = (newTheme: Theme) => {
    localStorage.setItem("theme", newTheme);
    setThemeState(newTheme);
    applyTheme(newTheme);
  };
  
  // Inicijalno postavi temu i dodaj listener za promjene medija (system tema)
  useEffect(() => {
    // Inicijalno postavi temu
    applyTheme(theme);
    
    // Dodaj listener za promjene sistemske teme
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}