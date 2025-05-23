import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Instagram } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

interface InstagramPost {
  id: string;
  media_url: string;
  permalink: string;
  caption?: string;
  thumbnail_url?: string;
}

interface InstagramGalleryProps {
  accessToken?: string;
  limit?: number;
}

export default function InstagramGallery({
  accessToken,
  limit = 8,
}: InstagramGalleryProps) {
  const { t } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const [manualPosts, setManualPosts] = useState<InstagramPost[]>([]);

  // Dohvati postavke za Instagram token iz baze podataka ako nije dodan putem propsa
  const { data: tokenData } = useQuery({
    queryKey: ["/api/settings/instagram_token"],
    queryFn: async () => {
      try {
        if (accessToken) return { value: accessToken };
        const response = await fetch("/api/settings/instagram_token");
        if (!response.ok) return { value: "" };
        return await response.json();
      } catch (error) {
        console.error("Greška pri dohvaćanju Instagram tokena:", error);
        return { value: "" };
      }
    },
    enabled: !accessToken,
  });

  const token = accessToken || tokenData?.value;

  // Dohvati Instagram objave pomoću tokena
  const {
    data: instagramData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/instagram/media", token],
    queryFn: async () => {
      if (!token) return [];

      try {
        const response = await fetch(
          `https://graph.instagram.com/me/media?fields=id,caption,media_url,permalink,thumbnail_url&access_token=${token}&limit=16`,
        );
        if (!response.ok)
          throw new Error("Neuspješno dohvaćanje Instagram objava");
        const data = await response.json();
        return data.data as InstagramPost[];
      } catch (error) {
        console.error("Greška pri dohvaćanju Instagram objava:", error);
        return [];
      }
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5, // 5 minuta
  });

  // Učitaj ručno dodane objave iz baze ako nema tokena
  useEffect(() => {
    async function loadManualPosts() {
      if (!token && manualPosts.length === 0) {
        try {
          const response = await fetch("/api/instagram/manual");
          if (response.ok) {
            const data = await response.json();
            setManualPosts(data);
          }
        } catch (error) {
          console.error("Greška pri dohvaćanju ručno dodanih slika:", error);
        }
      }
    }

    loadManualPosts();
  }, [token, manualPosts.length]);

  // Koristi Instagram podatke ili ručno dodane slike
  const posts = token ? instagramData || [] : manualPosts;

  // Odredi koje objave prikazati
  const visiblePosts = showAll ? posts : posts?.slice(0, limit);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(limit)].map((_, i) => (
          <Skeleton key={i} className="w-full aspect-square rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">
          Beim Abrufen des Instagram-Inhalts ist ein Fehler aufgetreten.
        </p>
        <Button
          variant="outline"
          className="flex items-center"
          onClick={() =>
            window.open(
              "https://www.instagram.com/kerzenwelt_by_dani/",
              "_blank",
            )
          }
        >
          <Instagram className="mr-2 h-4 w-4" />
          Besuchen Sie unser Instagram
        </Button>
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="mb-4">Derzeit sind keine Instagram-Bilder verfügbar..</p>
        <Button
          variant="outline"
          className="flex items-center"
          onClick={() =>
            window.open(
              "https://www.instagram.com/kerzenwelt_by_dani/",
              "_blank",
            )
          }
        >
          <Instagram className="mr-2 h-4 w-4" />
          Besuchen Sie unser Instagram
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {visiblePosts.map((post) => (
          <a
            key={post.id}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-90 transition-opacity"
          >
            <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <picture>
                  <source 
                    srcSet={post.media_url ? post.media_url.replace(/\.(jpg|jpeg|png)$/i, '.webp') : (post.thumbnail_url ? post.thumbnail_url.replace(/\.(jpg|jpeg|png)$/i, '.webp') : '')} 
                    type="image/webp" 
                  />
                  <img
                    src={post.media_url || post.thumbnail_url}
                    alt={post.caption || "Instagram slika"}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                    width="300"
                    height="300"
                  />
                </picture>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

      {posts.length > limit && (
        <div className="text-center">
          <Button onClick={() => setShowAll(!showAll)} variant="outline">
            {showAll ? "Prikaži manje" : "Prikaži više"}
          </Button>
        </div>
      )}

      <div className="text-center pt-4">
        <a
          href="https://www.instagram.com/kerzenwelt_by_dani/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-primary hover:text-primary/80"
        >
          <Instagram size={20} className="mr-2" />
          {t("instagram.followUs")}
        </a>
      </div>
    </div>
  );
}
