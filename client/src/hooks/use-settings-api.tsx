import {
  useQuery,
  useMutation,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query"; // Dodano UseQueryOptions, UseQueryResult
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface Setting {
  id: number;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

// ✅ NOVI PRILAGOĐENI HOOK za dohvaćanje pojedinačne postavke
// OVO JE FUNKCIJA KOJU TREBA POZVATI DIREKTNO UNUTAR KOMPONENTE ILI DRUGOG HOOK-a
export function useGetSetting(
  key: string,
  options?: UseQueryOptions<Setting, unknown, Setting, string[]>,
) {
  return useQuery<Setting>({
    queryKey: ["/api/settings", key],
    enabled: !!key, // Uključi upit samo ako 'key' postoji
    staleTime: 0, // Uvijek dohvaćaj svježe podatke
    refetchOnWindowFocus: true, // Osvježi podatke kada se prozor fokusira
    refetchOnMount: true, // Osvježi pri svakom mountanju komponente
    refetchInterval: 2000, // Osvježi svakih 2 sekunde (dok je razvoj)
    ...options, // Omogućuje prenošenje dodatnih opcija za useQuery
  });
}

// ✅ NOVI PRILAGOĐENI HOOK za dohvaćanje vrijednosti pojedinačne postavke
// Ako ćete ovo koristiti izvan 'useSettings', mora biti zaseban hook
// SADA OVAJ HOOK POZIVA useGetSetting
export function useSettingValue(key: string, defaultValue: string = "") {
  const { data, isLoading, error } = useGetSetting(key); // ✅ Hook pozvan unutar drugog hooka
  if (isLoading || error || !data) {
    return defaultValue;
  }
  return data.value;
}

export function useSettings() {
  const { toast } = useToast();

  // Hook za dohvaćanje svih postavki
  const allSettings = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
    staleTime: 1000 * 60 * 5, // 5 minuta
  });

  // Ovdje NEĆEMO uključivati getSetting kao što je bila.
  // Umjesto toga, komponenta koja treba pojedinačnu postavku će direktno zvati useGetSetting.

  // Hook za ažuriranje ili dodavanje nove vrijednosti postavke
  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      // Prvo provjerimo postoji li postavka
      const response = await apiRequest("GET", `/api/settings/${key}`);

      if (response.status === 200) {
        // Ako postoji, ažuriramo je
        const updatedResponse = await apiRequest(
          "PUT",
          `/api/settings/${key}`,
          { value },
        );
        return await updatedResponse.json();
      } else if (response.status === 404) {
        // Ako ne postoji, kreiramo novu
        const newResponse = await apiRequest("POST", "/api/settings", {
          key,
          value,
        });
        return await newResponse.json();
      } else {
        throw new Error("Error checking setting status");
      }
    },
    onSuccess: (data: Setting) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings", data.key] });
      toast({
        title: "Postavka spremljena",
        description: `Postavka "${data.key}" je uspješno spremljena.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri spremanju postavke",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Hook za brisanje postavke
  const deleteSetting = useMutation({
    mutationFn: async (key: string) => {
      await apiRequest("DELETE", `/api/settings/${key}`);
      return key;
    },
    onSuccess: (key: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings", key] });
      toast({
        title: "Postavka izbrisana",
        description: `Postavka "${key}" je uspješno izbrisana.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri brisanju postavke",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    allSettings,
    // getSetting više ne vraćamo ovdje, koristit će se izravno kao useGetSetting
    updateSetting,
    deleteSetting,
    // getSettingValue više ne vraćamo ovdje, koristit će se izravno kao useSettingValue
  };
}
