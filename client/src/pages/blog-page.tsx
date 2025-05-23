import React from "react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import InstagramGallery from "@/components/InstagramGallery";
import { Instagram } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export default function SlikePage() {
  const { t } = useLanguage();
  
  // Dohvati sadržaj slike stranice iz baze
  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ["/api/pages/blog"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/pages/blog");
        
        if (!response.ok) {
          if (response.status === 404) {
            return { title: "Slike", content: "Pogledajte našu galeriju slika." };
          }
          throw new Error("Neuspješno dohvaćanje sadržaja stranice");
        }
        
        return await response.json();
      } catch (error) {
        console.error("Greška pri dohvaćanju stranice:", error);
        return { title: "Slike", content: "Pogledajte našu galeriju slika." };
      }
    }
  });

  return (
    <>
      <Helmet>
        <title>{pageData?.title || "Slike"} | Kerzenwelt by Dani</title>
        <meta 
          name="description" 
          content="Pogledajte najnovije fotografije naših proizvoda i kreacija na Instagram galeriji Kerzenwelt by Dani."
        />
      </Helmet>
      
      <Layout>
        <div className="container py-8 md:py-12">
          <div className="mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {isLoading ? <Skeleton className="h-10 w-[250px] mx-auto" /> : pageData?.title || "Slike"}
            </h1>
            <div className="text-muted-foreground max-w-2xl mx-auto">
              {isLoading ? (
                <Skeleton className="h-4 w-full mx-auto mb-4" />
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Instagram size={18} /> 
                  <span>{t("instagram.followUsText")}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="max-w-7xl mx-auto">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="w-full aspect-square rounded-md" />
                ))}
              </div>
            ) : (
              <>
                {pageData?.content && (
                  <Card className="mb-8 mx-auto">
                    <CardContent className="pt-6">
                      <div 
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: pageData.content.replace(/\n/g, '<br />') 
                        }}
                      />
                    </CardContent>
                  </Card>
                )}
                
                <InstagramGallery />
              </>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}