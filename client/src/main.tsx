import { createRoot } from "react-dom/client";
import { Suspense } from "react";
import "./index.css";

// Učitaj App komponentu direktno umjesto lazy loading
import App from "./App";

// Optimizirana komponenta za učitavanje
function preloadImages() {
  const images = ['/logo.webp'];
  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}

// Pozovi preload slika odmah
if (typeof window !== 'undefined') {
  preloadImages();
}

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
