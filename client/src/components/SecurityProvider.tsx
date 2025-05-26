import { useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { initializeSecurity } from "@/utils/security";

interface SecurityProviderProps {
  children: ReactNode;
}

export function SecurityProvider({ children }: SecurityProviderProps) {
  const { user } = useAuth();

  useEffect(() => {
    // Initialize security measures based on user role
    // Check if user is admin by username or isAdmin field
    const isAdmin = user?.username === 'MiskicAdmin' || user?.isAdmin === true;
    initializeSecurity(isAdmin);
  }, [user]);

  return <>{children}</>;
}