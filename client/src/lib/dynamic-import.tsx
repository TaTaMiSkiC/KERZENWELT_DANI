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

/**
 * Funkcija za dinamičko učitavanje komponenti pomoću React.lazy
 * @param importFunc - Import funkcija za komponentu
 * @returns Komponenta omotana sa Suspense
 */
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