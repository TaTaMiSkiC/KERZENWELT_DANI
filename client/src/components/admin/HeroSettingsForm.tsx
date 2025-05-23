import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { heroSettingsSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Language } from "@/hooks/use-language";

// Define title item structure that matches schema.ts
type TitleItem = {
  text: string;
  fontSize: string;
  fontWeight: string;
  color: string;
};

// Define hero settings structure that matches schema.ts
type HeroSettings = {
  titleText: Record<string, TitleItem[]>;
  subtitleText: Record<string, string>;
  subtitleFontSize: string;
  subtitleFontWeight: string;
  subtitleColor: string;
};

interface HeroSettingsFormProps {
  initialData?: HeroSettings;
}

const supportedLanguages: { value: Language; label: string }[] = [
  { value: "de", label: "Deutsch" },
  { value: "hr", label: "Hrvatski" },
  { value: "en", label: "English" },
  { value: "it", label: "Italiano" },
  { value: "sl", label: "Slovenščina" },
];

const fontSizes = [
  { value: "sm", label: "Klein" },
  { value: "base", label: "Normal" },
  { value: "lg", label: "Groß" },
  { value: "xl", label: "Extra Groß" },
  { value: "2xl", label: "2XL" },
  { value: "3xl", label: "3XL" },
  { value: "4xl", label: "4XL" },
  { value: "5xl", label: "5XL" },
  { value: "6xl", label: "6XL" },
  { value: "4xl md:text-5xl lg:text-6xl", label: "Responsiv (Standard)" },
  { value: "lg md:text-xl", label: "Responsiv Untertitel (Standard)" },
];

const fontWeights = [
  { value: "thin", label: "Dünn (100)" },
  { value: "extralight", label: "Extraleicht (200)" },
  { value: "light", label: "Leicht (300)" },
  { value: "normal", label: "Normal (400)" },
  { value: "medium", label: "Mittel (500)" },
  { value: "semibold", label: "Halbfett (600)" },
  { value: "bold", label: "Fett (700)" },
  { value: "extrabold", label: "Extrafett (800)" },
  { value: "black", label: "Schwarz (900)" },
];

const defaultHeroSettings: HeroSettings = {
  titleText: {
    de: [
      { text: "Willkommen", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: "Kerzenwelt by Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: "Wo Kerzen Wärme und Stil vereinen", fontSize: "xl", fontWeight: "medium", color: "white" },
    ],
    hr: [
      { text: "Dobrodošli", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: "Svijet svijeća by Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: "Gdje se toplina i stil spajaju", fontSize: "xl", fontWeight: "medium", color: "white" },
    ],
    en: [
      { text: "Welcome", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: "The Candle World by Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: "Where warmth and style unite", fontSize: "xl", fontWeight: "medium", color: "white" },
    ],
    it: [
      { text: "Benvenuti", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: "Il mondo delle candele di Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: "Dove calore e stile si incontrano", fontSize: "xl", fontWeight: "medium", color: "white" },
    ],
    sl: [
      { text: "Dobrodošli", fontSize: "2xl", fontWeight: "medium", color: "white" },
      { text: "Svet sveč by Dani", fontSize: "4xl", fontWeight: "bold", color: "white" },
      { text: "Kjer se toplina in stil združita", fontSize: "xl", fontWeight: "medium", color: "white" },
    ]
  },
  subtitleText: {
    de: "Entdecken Sie unsere einzigartige Sammlung handgefertigter Kerzen, perfekt für jede Gelegenheit.",
    hr: "Otkrijte našu jedinstvenu kolekciju ručno izrađenih svijeća, savršenih za svaku prigodu.",
    en: "Discover our unique collection of handcrafted candles, perfect for any occasion.",
    it: "Scopri la nostra collezione unica di candele artigianali, perfette per ogni occasione.",
    sl: "Odkrijte našo edinstveno zbirko ročno izdelanih sveč, popolnih za vsako priložnost."
  },
  titleFontSize: "4xl md:text-5xl lg:text-6xl",
  titleFontWeight: "bold",
  titleColor: "white",
  subtitleFontSize: "lg md:text-xl",
  subtitleFontWeight: "normal",
  subtitleColor: "white opacity-90"
};

export default function HeroSettingsForm({ initialData }: HeroSettingsFormProps) {
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("de");
  
  // Merge initialData with default values
  const mergedData = initialData ?? defaultHeroSettings;
  
  // Create form
  const form = useForm<HeroSettings>({
    resolver: zodResolver(heroSettingsSchema),
    defaultValues: mergedData,
  });

  // Handle form submission
  const heroMutation = useMutation({
    mutationFn: async (data: HeroSettings) => {
      const response = await fetch("/api/settings/hero", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Beim Speichern der Heldenbereich-Einstellungen ist ein Fehler aufgetreten");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Erfolgreich gespeichert",
        description: "Die Heldenbereich-Einstellungen wurden erfolgreich aktualisiert.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/hero"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  function onSubmit(data: HeroSettings) {
    heroMutation.mutate(data);
  }

  // Preview styles for the form
  const getTitleStyle = () => {
    return {
      fontSize: getFontSizeValue(form.watch("titleFontSize")),
      fontWeight: getFontWeightValue(form.watch("titleFontWeight")),
      color: form.watch("titleColor"),
    };
  };

  const getSubtitleStyle = () => {
    return {
      fontSize: getFontSizeValue(form.watch("subtitleFontSize")),
      fontWeight: getFontWeightValue(form.watch("subtitleFontWeight")),
      color: form.watch("subtitleColor"),
    };
  };

  // Helper function to convert tailwind classes to CSS values for preview
  function getFontSizeValue(size: string) {
    // Handle responsive sizes by taking the first value
    const firstSize = size.split(" ")[0];
    const sizeMap: Record<string, string> = {
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
      "6xl": "3.75rem",
    };
    
    // Extract the size from something like "4xl" from "4xl md:text-5xl lg:text-6xl"
    const match = firstSize.match(/(\d?xl|\w+)$/);
    return match && sizeMap[match[0]] ? sizeMap[match[0]] : "1rem";
  }

  function getFontWeightValue(weight: string) {
    const weightMap: Record<string, string> = {
      thin: "100",
      extralight: "200",
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
      black: "900",
    };
    return weightMap[weight] || "400";
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-background p-4 rounded-md border">
          <h3 className="text-lg font-medium mb-3">Titel und Untertitel Vorschau</h3>
          <div className="p-4 bg-gray-800 rounded-md">
            {Array.isArray(form.watch(`titleText.${selectedLanguage}`)) && 
              form.watch(`titleText.${selectedLanguage}`).map((titlePart, index) => (
                <h1 
                  key={index}
                  style={{
                    ...getTitleStyle(),
                    fontSize: index === 0 ? "2.25rem" : index === 1 ? "3rem" : "1.875rem",
                    fontWeight: index === 1 ? "700" : "500",
                    marginBottom: "0.25rem"
                  }}
                >
                  {titlePart}
                </h1>
              ))
            }
            <p style={getSubtitleStyle()} className="mb-0 mt-3">
              {form.watch(`subtitleText.${selectedLanguage}`)}
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">Heldenbereich Text</h3>
          <Tabs value={selectedLanguage} onValueChange={(value) => setSelectedLanguage(value as Language)}>
            <TabsList className="mb-4">
              {supportedLanguages.map((lang) => (
                <TabsTrigger key={lang.value} value={lang.value}>
                  {lang.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {supportedLanguages.map((lang) => (
              <TabsContent key={lang.value} value={lang.value} className="space-y-4">
                <div className="border p-4 rounded-md mb-4">
                  <h3 className="font-medium mb-3">Titel Einstellungen ({lang.label})</h3>
                  {[0, 1, 2].map((index) => (
                    <FormField
                      key={index}
                      control={form.control}
                      name={`titleText.${lang.value}`}
                      render={({ field }) => (
                        <FormItem className="mb-3">
                          <FormLabel>Titel {index + 1}</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={`Titel Zeile ${index + 1}`} 
                              value={Array.isArray(field.value) ? (field.value[index] || '') : ''}
                              onChange={(e) => {
                                // Ensure field.value is an array
                                const currentValue = Array.isArray(field.value) ? field.value : [];
                                const newValue = [...currentValue];
                                newValue[index] = e.target.value;
                                field.onChange(newValue);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                <FormField
                  control={form.control}
                  name={`subtitleText.${lang.value}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Untertitel ({lang.label})</FormLabel>
                      <FormControl>
                        <Input placeholder="Untertitel eingeben" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Titel Styling</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="titleFontSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schriftgröße</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Schriftgröße auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fontSizes.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="titleFontWeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schriftstärke</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Schriftstärke auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fontWeights.map((weight) => (
                        <SelectItem key={weight.value} value={weight.value}>
                          {weight.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="titleColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Farbe</FormLabel>
                <div className="flex space-x-2">
                  <FormControl>
                    <Input type="text" placeholder="Farbe (z.B. white, #fff)" {...field} />
                  </FormControl>
                  <Input 
                    type="color" 
                    className="w-12 p-1 h-10" 
                    value={field.value.startsWith("#") ? field.value : "#ffffff"} 
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Untertitel Styling</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="subtitleFontSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schriftgröße</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Schriftgröße auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fontSizes.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subtitleFontWeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schriftstärke</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Schriftstärke auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fontWeights.map((weight) => (
                        <SelectItem key={weight.value} value={weight.value}>
                          {weight.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="subtitleColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Farbe</FormLabel>
                <div className="flex space-x-2">
                  <FormControl>
                    <Input type="text" placeholder="Farbe (z.B. white, #fff)" {...field} />
                  </FormControl>
                  <Input 
                    type="color" 
                    className="w-12 p-1 h-10" 
                    value={field.value.startsWith("#") ? field.value : "#ffffff"} 
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={heroMutation.isPending}>
          {heroMutation.isPending ? "Speichern..." : "Einstellungen speichern"}
        </Button>
      </form>
    </Form>
  );
}