import { createContext, useContext, ReactNode } from "react";

// Definiramo mogućnosti tema
type Theme = "light" | "dark" | "system";

// Funkcija koja će primijeniti temu kao CSS klasu
function applyThemeToDOM(theme: Theme) {
  if (typeof document === "undefined") return;
  
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  
  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" 
      : "light";
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
}

// Inicijalno primijenimo temu na učitavanje
let initialTheme: Theme = "light";
if (typeof window !== "undefined") {
  const savedTheme = localStorage.getItem("theme") as Theme;
  if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
    initialTheme = savedTheme;
  }
  applyThemeToDOM(initialTheme);
}

// Definicija konteksta s jednostavnim funkcijama
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: initialTheme,
  setTheme: (newTheme: Theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
      applyThemeToDOM(newTheme);
    }
  }
});

// Jednostavni Provider bez state-a
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Koristimo jednostavni objekt umjesto State-a
  const themeValue = {
    theme: initialTheme,
    setTheme: (newTheme: Theme) => {
      if (typeof window !== "undefined") {
        initialTheme = newTheme;
        localStorage.setItem("theme", newTheme);
        applyThemeToDOM(newTheme);
      }
    }
  };
  
  return (
    <ThemeContext.Provider value={themeValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook za korištenje teme
export function useTheme() {
  return useContext(ThemeContext);
}