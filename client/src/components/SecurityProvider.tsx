// client/src/components/SecurityProvider.tsx
import React, { useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth"; // Pretpostavka da ćeš prilagoditi use-auth.tsx
import { initializeSecurity } from "../utils/security"; // Uvezi security funkciju

interface SecurityProviderProps {
  children: ReactNode;
}

export const SecurityProvider = ({ children }: SecurityProviderProps) => {
  const { user, isLoading } = useAuth(); // Dobij korisnika i status učitavanja iz useAuth

  // isAdmin će biti true samo ako user postoji i user.is_admin je true
  const isAdmin = user?.is_admin === true;

  useEffect(() => {
    // Aktiviraj sigurnosne mjere tek nakon što se korisnik učita
    if (!isLoading) {
      initializeSecurity(isAdmin); // Proslijedi isAdmin status
    }
  }, [isLoading, isAdmin]); // Efekt se ponovno pokreće kada se promijeni isLoading ili isAdmin

  // SecurityProvider samo renderira djecu
  return <>{children}</>;
};
