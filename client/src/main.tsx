import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import "./index.css";

// Lazy load App component for better initial loading performance
const App = lazy(() => import("./App"));

// Dodajemo komponentu za učitavanje koja će se prikazati dok se glavna aplikacija učitava
const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    flexDirection: 'column',
    gap: '1rem',
    background: '#f8f9fa'
  }}>
    <img 
      src="/logo.png" 
      alt="Kerzenwelt by Dani" 
      style={{ 
        width: '200px', 
        height: 'auto',
        animation: 'pulse 1.5s infinite ease-in-out'
      }} 
    />
    <p style={{ fontFamily: 'sans-serif', color: '#666' }}>Učitavanje...</p>
  </div>
);

// Inicijalizacija jezika dokumenta
if (typeof window !== "undefined") {
  const savedLang = localStorage.getItem("language");
  if (savedLang && ["hr", "en", "de"].includes(savedLang)) {
    document.documentElement.lang = savedLang;
  } else {
    document.documentElement.lang = "hr";
  }
}

createRoot(document.getElementById("root")!).render(
  <App />
);
