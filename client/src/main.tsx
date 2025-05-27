import { createRoot } from "react-dom/client";
import App from "./App";
import React from "react";
import "./index.css";
import { LanguageProvider } from "./hooks/use-language";

// Lazy load App component for better initial loading performance
// const App = lazy(() => import("./App"));

// Loading component while main app is loading
// const LoadingFallback = () => (
//   <div
//     style={{
//       display: "flex",
//       justifyContent: "center",
//       alignItems: "center",
//       height: "100vh",
//       flexDirection: "column",
//       gap: "1rem",
//       background: "#f8f9fa",
//     }}
//   >
//     <img
//       src="/logo.png"
//       alt="Kerzenwelt by Dani"
//       style={{
//         width: "200px",
//         height: "auto",
//         animation: "pulse 1.5s infinite ease-in-out",
//       }}
//     />
//     <p style={{ fontFamily: "sans-serif", color: "#666" }}>Laden...</p>
//   </div>
// );

// Inicijalizacija jezika dokumenta (može ostati ovdje)
if (typeof window !== "undefined") {
  const savedLang = localStorage.getItem("language");
  // Proširi listu podržanih jezika ako koristiš više od de, hr, en
  if (savedLang && ["de", "hr", "en", "it", "sl"].includes(savedLang)) {
    document.documentElement.lang = savedLang;
  } else {
    document.documentElement.lang = "hr"; // Postavi defaultni jezik
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Füge den LanguageProvider hier hinzu, um App und alle seine Kinder zu umschließen */}
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
);
