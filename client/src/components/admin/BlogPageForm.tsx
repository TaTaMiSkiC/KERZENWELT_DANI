import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash, Instagram, Plus, Search } from "lucide-react";

interface BlogPageFormProps {
  initialData?: {
    id?: number;
    title: string;
    content: string;
  };
}

// Tip za Instagram sliku koju dodajemo ručno
interface ManualInstagramPost {
  id: string;
  media_url: string;
  permalink: string;
  caption?: string;
}

export default function BlogPageForm({ initialData }: BlogPageFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("content");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageLink, setNewImageLink] = useState("https://www.instagram.com/kerzenwelt_by_dani/");
  
  // Dohvati Instagram token iz baze
  const { data: instagramToken } = useQuery({
    queryKey: ["/api/settings/instagram_token"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/settings/instagram_token");
        if (!response.ok) {
          if (response.status === 404) return { value: "" };
          throw new Error("Greška pri dohvaćanju Instagram tokena");
        }
        return await response.json();
      } catch (error) {
        console.error("Greška:", error);
        return { value: "" };
      }
    }
  });
  
  // Dohvati ručno dodane Instagram slike
  const { data: manualImages, refetch: refetchImages } = useQuery({
    queryKey: ["/api/instagram/manual"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/instagram/manual");
        if (!response.ok) return [];
        return await response.json();
      } catch (error) {
        console.error("Greška:", error);
        return [];
      }
    }
  });
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      title: initialData?.title || "Bilder",
      content: initialData?.content || "",
    },
  });
  
  const saveMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const method = initialData?.id ? 'PUT' : 'POST';
      const endpoint = initialData?.id 
        ? `/api/pages` 
        : `/api/pages`;
      
      const payload = {
        id: initialData?.id,
        type: "blog",
        title: data.title,
        content: data.content,
      };
      
      const response = await apiRequest(method, endpoint, payload);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Neuspješno spremanje stranice");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Seite erfolgreich gespeichert",
        description: "Der Inhalt der Bilderseite wurde erfolgreich aktualisiert.",
      });
      
      // Osvježi podatke nakon uspješnog spremanja
      queryClient.invalidateQueries({ queryKey: ["/api/pages/blog"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler beim Speichern der Seite",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest('POST', "/api/instagram/token", { token });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Neuspješno spremanje Instagram tokena");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Token uspješno spremljen",
        description: "Instagram token je uspješno ažuriran.",
      });
      
      // Osvježi podatke nakon uspješnog spremanja
      queryClient.invalidateQueries({ queryKey: ["/api/settings/instagram_token"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri spremanju tokena",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const saveImagesMutation = useMutation({
    mutationFn: async (images: ManualInstagramPost[]) => {
      const response = await apiRequest('POST', "/api/instagram/manual", { images });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Neuspješno spremanje slika");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Slike uspješno spremljene",
        description: "Instagram slike su uspješno ažurirane.",
      });
      
      // Osvježi podatke nakon uspješnog spremanja
      refetchImages();
      setNewImageUrl("");
      setNewImageLink("https://www.instagram.com/kerzenwelt_by_dani/");
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri spremanju slika",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: { title: string; content: string }) => {
    saveMutation.mutate(data);
  };
  
  const handleTokenSave = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const tokenInput = form.elements.namedItem("instagram_token") as HTMLInputElement;
    
    if (tokenInput.value) {
      saveTokenMutation.mutate(tokenInput.value);
    } else {
      toast({
        title: "Greška",
        description: "Token ne može biti prazan",
        variant: "destructive",
      });
    }
  };
  
  const handleAddImage = () => {
    if (!newImageUrl) {
      toast({
        title: "Greška",
        description: "URL slike ne može biti prazan",
        variant: "destructive",
      });
      return;
    }
    
    // Kreiraj jedinstveni ID za novu sliku
    const newImage: ManualInstagramPost = {
      id: `manual-${Date.now()}`,
      media_url: newImageUrl,
      permalink: newImageLink || "https://www.instagram.com/kerzenwelt_by_dani/",
      caption: "Ručno dodana slika"
    };
    
    // Dodaj novu sliku u postojeće slike
    const updatedImages = [...(manualImages || []), newImage];
    saveImagesMutation.mutate(updatedImages);
  };
  
  const handleRemoveImage = (imageId: string) => {
    if (!manualImages) return;
    
    const updatedImages = manualImages.filter((img: ManualInstagramPost) => img.id !== imageId);
    saveImagesMutation.mutate(updatedImages);
  };
  
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="content">Glavni sadržaj</TabsTrigger>
        <TabsTrigger value="instagram">Instagram integracija</TabsTrigger>
        <TabsTrigger value="manual">Ručno dodavanje slika</TabsTrigger>
      </TabsList>
      
      <TabsContent value="content" className="mt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Naslov stranice</Label>
            <Input
              id="title"
              {...register("title", { required: "Naslov je obavezan" })}
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && (
              <p className="text-red-500 text-sm">{errors.title.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content">Glavni sadržaj (prikazuje se iznad slika)</Label>
            <Textarea
              id="content"
              {...register("content")}
              className={`min-h-[200px] ${errors.content ? "border-red-500" : ""}`}
              placeholder="Opcionalni sadržaj koji će se prikazati iznad Instagram galerije..."
            />
          </div>
          
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Spremanje..." : "Spremi promjene"}
          </Button>
        </form>
      </TabsContent>
      
      <TabsContent value="instagram" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Instagram integracija</CardTitle>
            <CardDescription>
              Dodajte Instagram token za automatsko dohvaćanje slika s vašeg Instagram profila
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTokenSave} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="instagram_token">Instagram Token</Label>
                <Input
                  id="instagram_token"
                  name="instagram_token"
                  defaultValue={instagramToken?.value || ""}
                  placeholder="Unesite vaš Instagram token za pristup slikama..."
                />
                <p className="text-xs text-muted-foreground">
                  Za dobivanje tokena potrebno je kreirati Facebook Developer račun i postaviti Instagram Basic Display aplikaciju.
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <Button type="submit">
                  Spremi token
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => window.open("https://developers.facebook.com/docs/instagram-basic-display-api/overview", "_blank")}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Upute za token
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="manual" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Ručno dodavanje slika</CardTitle>
            <CardDescription>
              Dodajte slike koje će se prikazati u Instagram galeriji ako nemate Instagram token
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="image_url">URL slike</Label>
                <Input
                  id="image_url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="image_link">Link na Instagram objavu</Label>
                <Input
                  id="image_link"
                  value={newImageLink}
                  onChange={(e) => setNewImageLink(e.target.value)}
                  placeholder="https://www.instagram.com/p/..."
                />
              </div>
              <Button 
                type="button" 
                onClick={handleAddImage}
                className="mb-0.5"
              >
                <Plus className="mr-2 h-4 w-4" />
                Dodaj
              </Button>
            </div>
            
            <div>
              <h3 className="font-medium mb-2 flex items-center">
                <Instagram className="mr-2 h-4 w-4" />
                Dodane slike
              </h3>
              
              {!manualImages || manualImages.length === 0 ? (
                <p className="text-muted-foreground italic text-sm">Nema ručno dodanih slika</p>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Slika</TableHead>
                        <TableHead>URL slike</TableHead>
                        <TableHead>Link</TableHead>
                        <TableHead className="w-[60px]">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manualImages.map((image: ManualInstagramPost) => (
                        <TableRow key={image.id}>
                          <TableCell>
                            <div className="h-10 w-10 rounded overflow-hidden">
                              <img 
                                src={image.media_url} 
                                alt="Thumbnail" 
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://placehold.co/100x100/e2e8f0/64748b?text=Error";
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs truncate max-w-[200px]">
                            {image.media_url}
                          </TableCell>
                          <TableCell className="font-mono text-xs truncate max-w-[200px]">
                            {image.permalink}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => handleRemoveImage(image.id)}
                            >
                              <Trash className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}