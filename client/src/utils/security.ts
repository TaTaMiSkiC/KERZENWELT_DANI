// // client/src/utils/security.ts

// // Spremi referencu na originalne console metode prije nego što ih prebrišeš
// const originalConsoleLog = console.log;
// const originalConsoleError = console.error;
// const originalConsoleWarn = console.warn;
// const originalConsoleInfo = console.info;
// const originalConsoleClear = console.clear;

// // ID-evi za setIntervale da ih možemo zaustaviti
// let devToolsIntervalId: number | undefined;
// let consoleClearIntervalId: number | undefined;

// // Pomoćna funkcija za sprečavanje defaultnih akcija eventa
// const preventDefaultAction = (e: Event) => {
//   e.preventDefault();
//   return false;
// };

// // Pomoćna funkcija za sprečavanje određenih tipkovničkih prečaca
// const preventKeydownAction = (e: KeyboardEvent) => {
//   // // F12
//   // if (e.key === 'F12') {
//   //   e.preventDefault();
//   //   return false;
//   // }
//   // // Ctrl+Shift+I (DevTools)
//   // if (e.ctrlKey && e.shiftKey && e.key === 'I') {
//   //   e.preventDefault();
//   //   return false;
//   // }
//   // // Ctrl+Shift+J (Console)
//   // if (e.ctrlKey && e.shiftKey && e.key === 'J') {
//   //   e.preventDefault();
//   //   return false;
//   // }
//   // // Ctrl+U (View Source)
//   // if (e.ctrlKey && e.key === 'u') {
//   //   e.preventDefault();
//   //   return false;
//   // }
//   // // Ctrl+Shift+C (Inspect Element)
//   // if (e.ctrlKey && e.shiftKey && e.key === 'C') {
//   //   e.preventDefault();
//   //   return false;
//   // }
//   // // Ctrl+S (Save page)
//   // if (e.ctrlKey && e.key === 's') {
//   //   e.preventDefault();
//   //   return false;
//   // }
// };

// /**
//  * Inicijalizira sigurnosne mjere za sprječavanje pristupa razvojnim alatima
//  * Samo za korisnike koji NISU administratori.
//  * @param isAdmin true ako je korisnik administrator, false inače.
//  */
// export function initializeSecurity(isAdmin: boolean = false) {
//   // Ako je korisnik administrator, ukloni sva ograničenja koja su možda bila aktivna
//   if (isAdmin) {
//     originalConsoleLog("Admin korisnik detektiran - razvojni alati dopušteni.");

//     // Ukloni event listenere
//     document.removeEventListener("contextmenu", preventDefaultAction);
//     document.removeEventListener("keydown", preventKeydownAction);
//     document.onselectstart = null; // Vrati zadano ponašanje
//     document.ondragstart = null; // Vrati zadano ponašanje

//     // Zaustavi intervale ako su aktivni
//     if (devToolsIntervalId !== undefined) {
//       window.clearInterval(devToolsIntervalId);
//       devToolsIntervalId = undefined;
//     }
//     if (consoleClearIntervalId !== undefined) {
//       window.clearInterval(consoleClearIntervalId);
//       consoleClearIntervalId = undefined;
//     }

//     // Vrati izvorne metode konzole
//     console.log = originalConsoleLog;
//     console.error = originalConsoleError;
//     console.warn = originalConsoleWarn;
//     console.info = originalConsoleInfo;
//     console.clear = originalConsoleClear;

//     return; // Nema daljnjih akcija za administratore
//   }

//   // Za korisnike koji NISU administratori: Aktiviraj sigurnosne mjere

//   // Onemogući desni klik
//   document.addEventListener("contextmenu", preventDefaultAction);

//   // Onemogući F12 i druge prečace
//   document.addEventListener("keydown", preventKeydownAction);

//   // Provjeravaj jesu li DevTools otvoreni (pokreni interval samo ako već ne radi)
//   if (devToolsIntervalId === undefined) {
//     devToolsIntervalId = window.setInterval(() => {
//       const isDevToolsOpen =
//         window.outerWidth - window.innerWidth > 160 ||
//         window.outerHeight - window.innerHeight > 160 ||
//         (window.devtools && (window.devtools.isOpen || window.devtools.open)); // Dodan window.devtools.open za širu kompatibilnost

//       if (isDevToolsOpen) {
//         window.location.href = "/"; // Preusmjeri na početnu stranicu
//       }
//     }, 1000);
//   }

//   // Onemogući selekciju teksta i drag & drop
//   document.onselectstart = () => false;
//   document.ondragstart = () => false;

//   // Periodično čisti konzolu (pokreni interval samo ako već ne radi)
//   if (consoleClearIntervalId === undefined) {
//     consoleClearIntervalId = window.setInterval(() => {
//       originalConsoleClear();
//     }, 1000);
//   }

//   // Prebriši metode konzole
//   console.log = () => {};
//   console.error = () => {};
//   console.warn = () => {};
//   console.info = () => {};

//   originalConsoleLog("Sigurnosne mjere aktivirane za ne-admin korisnika.");
// }
