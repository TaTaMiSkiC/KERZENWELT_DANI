// client/src/hooks/use-auth.tsx
import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
// Pobrini se da tvoj @shared/schema ima is_admin: boolean u definiciji SelectUser
import {
  insertUserSchema,
  User as SelectUser,
  InsertUser,
} from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  isAdmin: boolean; // <--- DODANO: isAdmin status
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { ReactNode }) {
  const { toast } = useToast();
  const { t } = useLanguage();

  const {
    data: user, // user objekt bi trebao sadržavati is_admin
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // <--- DODANO: Izračunaj isAdmin status
  const isAdmin = user?.is_admin === true;

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Login failed");
      }
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: t("auth.loginSuccessTitle"),
        description: t("auth.loginSuccessMessage", { username: user.username }),
      });
    },
    onError: (error: Error) => {
      // Handle the email verification error
      if (error.message === "email_not_verified") {
        toast({
          title: t("auth.verificationNeededTitle"),
          description: t("auth.emailNotVerified"),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("auth.loginErrorTitle"),
        description: t("auth.loginErrorMessage"),
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      const data = await res.json();

      // If it's a successful registration with verification required
      if (res.ok && data.message === "registration_success_verify_email") {
        // We still return the data so the UI can show the verification message
        return {
          ...data,
          message: "registration_success_verify_email",
        };
      }

      // Regular registration success
      if (res.ok) {
        return data;
      }

      // Error handling
      throw new Error(data.message || "Registration failed");
    },
    onSuccess: (response: any) => {
      // Only show the toast and set user data if it's not a verification required response
      if (response.message !== "registration_success_verify_email") {
        queryClient.setQueryData(["/api/user"], response);
        toast({
          title: t("auth.registerSuccessTitle"),
          description: t("auth.registerSuccessMessage", {
            username: response.username,
          }),
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: t("auth.registerErrorTitle"),
        description: error.message || t("auth.registerErrorMessage"),
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries({
        queryKey: ["/api/cart"],
      });
      toast({
        title: t("auth.logoutSuccessTitle"),
        description: t("auth.logoutSuccessMessage"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("auth.logoutErrorTitle"),
        description: error.message || t("auth.logoutErrorMessage"),
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        isAdmin, // <--- DODANO: Proslijedi isAdmin
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
