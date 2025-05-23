// Diese Datei ist aktuell nicht in Verwendung, da wir die dynamische Ladung der Komponenten deaktiviert haben
// Sie dient nur als Referenz für zukünftige Performance-Optimierungen

/*
import { lazy, Suspense, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';

// Komponenta za prikaz učitavanja
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center w-full h-[70vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="ml-2">Učitavanje...</span>
    </div>
  );
}

// Funktion zum dynamischen Laden von Komponenten mit React.lazy
export function dynamicImport<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFunc);
  
  return function DynamicComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
*/