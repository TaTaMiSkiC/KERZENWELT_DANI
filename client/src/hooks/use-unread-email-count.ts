// src/hooks/use-unread-email-count.ts
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface UnreadCountResponse {
  count: number;
}

export function useUnreadEmailCount() {
  const { data, isLoading, error } = useQuery<UnreadCountResponse>({
    queryKey: ["admin/emails/unread/count"],
    queryFn: async () => {
      console.log("[Frontend Hook] Fetching unread email count..."); // NEU: Log beim Start des Fetches
      const response = await apiRequest(
        "GET",
        "/api/admin/emails/unread/count",
      );
      if (!response.ok) {
        if (response.status === 403) {
          console.warn(
            "[Frontend Hook] Access denied to unread email count. (403 Forbidden)",
          );
          return { count: 0 };
        }
        if (response.status === 404) {
          console.warn(
            "[Frontend Hook] Unread email count endpoint not found. (404 Not Found)",
          );
          return { count: 0 };
        }
        const errorText = await response.text();
        console.error(
          `[Frontend Hook] Failed to fetch unread email count: ${response.status} - ${errorText}`,
        );
        throw new Error("Fehler beim Abrufen der Anzahl ungelesener E-Mails.");
      }
      const result = await response.json();
      console.log("[Frontend Hook] Received unread email count:", result.count); // NEU: Log des Ergebnisses
      return result;
    },
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000,
  });

  return {
    unreadCount: data?.count || 0,
    isLoadingUnreadCount: isLoading,
    errorUnreadCount: error,
  };
}
