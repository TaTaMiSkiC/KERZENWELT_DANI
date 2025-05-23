import { createRoot } from "react-dom/client";
import React from "react";
import "./index.css";
import App from "./App";

// Inicijalizacija jezika dokumenta
if (typeof window !== "undefined") {
  const savedLang = localStorage.getItem("language");
  if (savedLang && ["hr", "en", "de"].includes(savedLang)) {
    document.documentElement.lang = savedLang;
  } else {
    document.documentElement.lang = "hr";
  }
}

// Koristimo standardni način renderiranja, bez lazy loadinga na glavnoj komponenti
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
