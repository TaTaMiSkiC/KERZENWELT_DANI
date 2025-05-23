import React from "react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Phone, Mail, Clock, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  // Dohvati sadržaj kontakt stranice iz baze
  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ["/api/pages/contact"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/pages/contact");

        if (!response.ok) {
          if (response.status === 404) {
            return {
              title: "Kontakt",
              content: "Sadržaj stranice još nije unesen.",
            };
          }
          throw new Error("Neuspješno dohvaćanje sadržaja stranice");
        }

        return await response.json();
      } catch (error) {
        console.error("Greška pri dohvaćanju stranice:", error);
        return {
          title: "Kontakt",
          content: "Došlo je do greške pri dohvaćanju sadržaja.",
        };
      }
    },
  });

  // Dohvati kontakt podatke
  const { data: contactData, isLoading: contactLoading } = useQuery({
    queryKey: ["/api/settings/contact"],
    queryFn: async () => {
      const response = await fetch("/api/settings/contact");
      if (!response.ok) {
        throw new Error("Neuspješno dohvaćanje kontakt podataka");
      }
      return await response.json();
    },
  });

  const isLoading = pageLoading || contactLoading;

  return (
    <>
      <Helmet>
        <title>{pageData?.title || "Kontakt"} | Kerzenwelt by Dani</title>
        <meta
          name="description"
          content="Kontaktirajte Kerzenwelt by Dani - za sve informacije o našim proizvodima, narudžbama i dostavi. Stojimo vam na raspolaganju!"
        />
      </Helmet>

      <Layout>
        <div className="container py-8 md:py-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center">
            {pageLoading ? (
              <Skeleton className="h-10 w-[250px] mx-auto" />
            ) : (
              pageData?.title || "Kontakt"
            )}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Kontakt informacije */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-6">Kontakt</h2>

                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-full mb-4" />
                    <Skeleton className="h-6 w-full mb-4" />
                    <Skeleton className="h-6 w-4/5 mb-4" />
                    <Skeleton className="h-6 w-full mb-4" />
                    <Skeleton className="h-6 w-3/4 mb-4" />
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <MapPin className="h-5 w-5 mr-3 mt-0.5 text-primary" />
                      <div>
                        <p className="font-medium">Adresa:</p>
                        <p>{contactData?.address || "Nije uneseno"}</p>
                        <p>
                          {contactData?.postalCode || ""}{" "}
                          {contactData?.city || ""}
                        </p>
                        <p>{contactData?.country || ""}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Phone className="h-5 w-5 mr-3 mt-0.5 text-primary" />
                      <div>
                        <p className="font-medium">Telefon:</p>
                        <p>{contactData?.phone || "Nije uneseno"}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Mail className="h-5 w-5 mr-3 mt-0.5 text-primary" />
                      <div>
                        <p className="font-medium">E-mail:</p>
                        <p>{contactData?.email || "Nije uneseno"}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Clock className="h-5 w-5 mr-3 mt-0.5 text-primary" />
                      <div>
                        <p className="font-medium">Öffnungszeiten:</p>
                        <p>{contactData?.workingHours || "Nije uneseno"}</p>
                      </div>
                    </div>

                    {/* Društvene mreže */}
                    <div className="pt-4">
                      <p className="font-medium mb-2">Pratite nas:</p>
                      <div className="flex space-x-2">
                        {contactData?.instagram && (
                          <Button variant="outline" size="icon" asChild>
                            <a
                              href={contactData.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Instagram"
                            >
                              <Instagram className="h-5 w-5" />
                            </a>
                          </Button>
                        )}

                        {contactData?.facebook && (
                          <Button variant="outline" size="icon" asChild>
                            <a
                              href={contactData.facebook}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Facebook"
                            >
                              <Facebook className="h-5 w-5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Kontakt sadržaj */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-6">Über uns</h2>

                {pageLoading ? (
                  <>
                    <Skeleton className="h-4 w-full mb-4" />
                    <Skeleton className="h-4 w-full mb-4" />
                    <Skeleton className="h-4 w-4/5 mb-4" />
                    <Skeleton className="h-4 w-full mb-4" />
                    <Skeleton className="h-4 w-3/4 mb-4" />
                  </>
                ) : (
                  <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: pageData?.content
                        ? pageData.content.replace(/\n/g, "<br />")
                        : "Sadržaj stranice još nije unesen.",
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    </>
  );
}
