import { useLanguage } from "@/hooks/use-language";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
// ✅ PROMJENA OVDJE: Dodajte useGetSetting u import
import { useSettings, useGetSetting } from "@/hooks/use-settings-api";

interface ShippingCostCalculatorProps {
  subtotal: number;
  // ✅ DODANO: Sada prihvaćamo ove postavke kao propse iz cart-page.tsx
  freeShippingThreshold?: number;
  standardShippingRate?: number;
}

export function ShippingCostCalculator({
  subtotal: propSubtotal, // ✅ PROMJENA: Preimenovano da se izbjegne konflikt s lokalnom varijablom
  freeShippingThreshold: propFreeShippingThreshold,
  standardShippingRate: propStandardShippingRate,
}: ShippingCostCalculatorProps) {
  const { t } = useLanguage();
  // ✅ DODANO: Osigurajte da je subtotal uvijek valjan broj
  const subtotal = isNaN(propSubtotal) ? 0 : propSubtotal;

  // ✅ VRAĆENO: State za direktno dohvaćene vrijednosti i stanje učitavanja
  const [directValues, setDirectValues] = useState<{
    freeShippingThreshold: string;
    standardShippingRate: string;
  } | null>(null);
  const [isDirectlyLoading, setIsDirectlyLoading] = useState(true);

  // ✅ VRAĆENO: Direktan pristup API-ju za zaobilaženje React Query keša
  useEffect(() => {
    const fetchDirectData = async () => {
      try {
        setIsDirectlyLoading(true);
        const freeThresholdResponse = await fetch(
          "/api/settings/freeShippingThreshold",
        );
        const freeThresholdData = await freeThresholdResponse.json();

        const standardRateResponse = await fetch(
          "/api/settings/standardShippingRate",
        );
        const standardRateData = await standardRateResponse.json();

        console.log("Učitane postavke iz API-ja:", {
          freeShippingThreshold: freeThresholdData.value,
          standardShippingRate: standardRateData.value,
          expressShippingRate: standardRateData.value, // Ovo se ne koristi kasnije, ali je bilo u originalu
        });

        // Spremi najsvježije podatke u state
        setDirectValues({
          freeShippingThreshold: freeThresholdData.value,
          standardShippingRate: standardRateData.value,
        });

        // Ažuriraj i localStorage
        localStorage.setItem("freeShippingThreshold", freeThresholdData.value);
        localStorage.setItem("standardShippingRate", standardRateData.value);

        // Invalidiraj React Query keš za automatsko osvježavanje
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        queryClient.invalidateQueries({
          queryKey: ["/api/settings", "freeShippingThreshold"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/settings", "standardShippingRate"],
        });
      } catch (error) {
        console.error("Greška pri dohvaćanju postavki:", error);
      } finally {
        setIsDirectlyLoading(false);
      }
    };

    fetchDirectData();
  }, []);

  // ✅ PROMJENA OVDJE: Koristite useGetSetting za dohvaćanje postavki putem React Query-ja (kao fallback)
  const {
    data: freeShippingThresholdSetting,
    isLoading: isLoadingFreeShippingThresholdQuery,
  } = useGetSetting("freeShippingThreshold");
  const {
    data: standardShippingRateSetting,
    isLoading: isLoadingStandardShippingRateQuery,
  } = useGetSetting("standardShippingRate");

  // ✅ AŽURIRANA LOGIKA UČITAVANJA: Kombinira direktno učitavanje i React Query učitavanje
  const isLoading =
    isDirectlyLoading ||
    isLoadingFreeShippingThresholdQuery ||
    isLoadingStandardShippingRateQuery;

  if (isLoading) {
    return (
      <div className="flex items-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("cart.loading")}
      </div>
    );
  }

  // ✅ AŽURIRANA LOGIKA PRIORITIZACIJE VRIJEDNOSTI: prop > direct > query > default
  let finalFreeShippingThreshold =
    propFreeShippingThreshold !== undefined
      ? propFreeShippingThreshold
      : parseFloat(
          directValues?.freeShippingThreshold ||
            freeShippingThresholdSetting?.value ||
            "50",
        );
  // ✅ DODANO: Provjera za NaN i fallback na zadanu vrijednost
  if (isNaN(finalFreeShippingThreshold)) {
    finalFreeShippingThreshold = 50;
  }

  let finalStandardShippingRate =
    propStandardShippingRate !== undefined
      ? propStandardShippingRate
      : parseFloat(
          directValues?.standardShippingRate ||
            standardRateSetting?.value ||
            "5",
        );
  // ✅ DODANO: Provjera za NaN i fallback na zadanu vrijednost
  if (isNaN(finalStandardShippingRate)) {
    finalStandardShippingRate = 5;
  }

  // Ako je finalStandardShippingRate postavljen na 0, dostava je uvijek besplatna
  if (finalStandardShippingRate === 0) {
    return (
      <div className="flex justify-between py-2">
        <span className="text-muted-foreground">{t("cart.shipping")}:</span>
        <span className="font-medium text-green-600 dark:text-green-500">
          {t("cart.shippingFree")}
        </span>
      </div>
    );
  }

  const isFreeShipping =
    subtotal >= finalFreeShippingThreshold && finalFreeShippingThreshold > 0;
  const shippingCost = isFreeShipping ? 0 : finalStandardShippingRate;

  return (
    <div className="flex justify-between py-2">
      <span className="text-muted-foreground">{t("cart.shipping")}:</span>
      <span>
        {isFreeShipping ? (
          <span className="font-medium text-green-600 dark:text-green-500">
            {t("cart.shippingFree")}
          </span>
        ) : (
          <span>{shippingCost.toFixed(2)} €</span>
        )}
      </span>
    </div>
  );
}

// Komponenta za prikaz informacije o potrebnom iznosu za besplatnu dostavu
export function FreeShippingProgress({
  subtotal: propSubtotal, // ✅ PROMJENA: Preimenovano
  freeShippingThreshold: propFreeShippingThreshold,
  standardShippingRate: propStandardShippingRate,
}: ShippingCostCalculatorProps) {
  const { t, translateText } = useLanguage();
  // ✅ DODANO: Osigurajte da je subtotal uvijek valjan broj
  const subtotal = isNaN(propSubtotal) ? 0 : propSubtotal;

  // ✅ VRAĆENO: State za direktno dohvaćene vrijednosti i stanje učitavanja
  const [directValues, setDirectValues] = useState<{
    freeShippingThreshold: string;
    standardShippingRate: string;
  } | null>(null);
  const [isDirectlyLoading, setIsDirectlyLoading] = useState(true);

  // ✅ VRAĆENO: Direktan pristup API-ju za zaobilaženje React Query keša
  useEffect(() => {
    const fetchDirectData = async () => {
      try {
        setIsDirectlyLoading(true);
        const freeThresholdResponse = await fetch(
          "/api/settings/freeShippingThreshold",
        );
        const freeThresholdData = await freeThresholdResponse.json();

        const standardRateResponse = await fetch(
          "/api/settings/standardShippingRate",
        );
        const standardRateData = await standardRateResponse.json();

        console.log("Učitane postavke iz API-ja:", {
          freeShippingThreshold: freeThresholdData.value,
          standardShippingRate: standardRateData.value,
        });

        // Spremi najsvježije podatke u state
        setDirectValues({
          freeShippingThreshold: freeThresholdData.value,
          standardShippingRate: standardRateData.value,
        });

        // Ažuriraj i localStorage
        localStorage.setItem("freeShippingThreshold", freeThresholdData.value);
        localStorage.setItem("standardShippingRate", standardRateData.value);
      } catch (error) {
        console.error("Greška pri dohvaćanju postavki:", error);
      } finally {
        setIsDirectlyLoading(false);
      }
    };

    fetchDirectData();
  }, []);

  // ✅ PROMJENA OVDJE: Koristite useGetSetting za dohvaćanje postavki za besplatnu dostavu (kao fallback)
  const {
    data: freeShippingThresholdSetting,
    isLoading: isLoadingFreeThresholdQuery,
  } = useGetSetting("freeShippingThreshold");
  const { data: standardRateSetting, isLoading: isLoadingStandardRateQuery } =
    useGetSetting("standardShippingRate");

  // ✅ AŽURIRANA LOGIKA UČITAVANJA: Kombinira direktno učitavanje i React Query učitavanje
  const isLoading =
    isDirectlyLoading ||
    isLoadingFreeThresholdQuery ||
    isLoadingStandardRateQuery;

  if (isLoading) {
    return null;
  }

  // ✅ AŽURIRANA LOGIKA PRIORITIZACIJE VRIJEDNOSTI: prop > direct > query > default
  let finalFreeShippingThreshold =
    propFreeShippingThreshold !== undefined
      ? propFreeShippingThreshold
      : parseFloat(
          directValues?.freeShippingThreshold ||
            freeShippingThresholdSetting?.value ||
            "50",
        );
  // ✅ DODANO: Provjera za NaN i fallback na zadanu vrijednost
  if (isNaN(finalFreeShippingThreshold)) {
    finalFreeShippingThreshold = 50;
  }

  let finalStandardShippingRate =
    propStandardShippingRate !== undefined
      ? propStandardShippingRate
      : parseFloat(
          directValues?.standardShippingRate ||
            standardRateSetting?.value ||
            "5",
        );
  // ✅ DODANO: Provjera za NaN i fallback na zadanu vrijednost
  if (isNaN(finalStandardShippingRate)) {
    finalStandardShippingRate = 5;
  }

  // Ako je finalStandardShippingRate 0, dostava je uvijek besplatna, pa ne prikazujemo informaciju
  // Također, ako je prag za besplatnu dostavu 0 ili je već dosegnut prag, ne prikazujemo komponentu
  if (
    finalStandardShippingRate === 0 ||
    finalFreeShippingThreshold <= 0 ||
    subtotal >= finalFreeShippingThreshold
  ) {
    return null;
  }

  const remaining = finalFreeShippingThreshold - subtotal;
  const progressPercentage = Math.min(
    100,
    (subtotal / finalFreeShippingThreshold) * 100,
  );

  return (
    <div className="mt-2 p-3 bg-muted/40 rounded-md">
      <p className="text-sm mb-2">
        {translateText(
          t("cart.addMoreForFreeShipping").replace(
            "{amount}",
            remaining.toFixed(2),
          ),
        )}
      </p>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
}
