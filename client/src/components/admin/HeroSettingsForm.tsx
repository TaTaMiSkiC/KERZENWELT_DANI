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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Define title item structure that matches schema.ts
type TitleItem = {
  text: string;
  fontSize: string;
  fontWeight: string;
  color: string;
  fontFamily?: string;
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

// Font family options
const fontFamilies = [
  { value: "font-default", label: "Standard (System)" },
  { value: "font-serif", label: "Serif" },
  { value: "font-mono", label: "Monospace" },
  { value: "font-cursive", label: "Cursive" },
  { value: "font-montserrat", label: "Montserrat" },
  { value: "font-playfair", label: "Playfair Display" },
  { value: "font-roboto", label: "Roboto" },
  { value: "font-open-sans", label: "Open Sans" },
  { value: "font-lato", label: "Lato" },
  { value: "font-dancing-script", label: "Dancing Script" },
];

// Default title items for each language
const defaultTitleItems = {
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
  ],
};

const defaultHeroSettings: HeroSettings = {
  titleText: defaultTitleItems,
  subtitleText: {
    de: "Entdecken Sie unsere einzigartige Sammlung handgefertigter Kerzen, perfekt für jede Gelegenheit.",
    hr: "Otkrijte našu jedinstvenu kolekciju ručno izrađenih svijeća, savršenih za svaku prigodu.",
    en: "Discover our unique collection of handcrafted candles, perfect for any occasion.",
    it: "Scopri la nostra collezione unica di candele artigianali, perfette per ogni occasione.",
    sl: "Odkrijte našo edinstveno zbirko ročno izdelanih sveč, popolnih za vsako priložnost."
  },
  subtitleFontSize: "lg md:text-xl",
  subtitleFontWeight: "normal",
  subtitleColor: "white opacity-90"
};

export default function HeroSettingsForm({ initialData }: HeroSettingsFormProps) {
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("de");
  
  // Process initial data to ensure it has the correct structure
  const processInitialData = (data: any): HeroSettings => {
    const processed = { ...defaultHeroSettings, ...data };
    
    // For each language, ensure titleText exists and has the correct structure
    supportedLanguages.forEach(lang => {
      // If titleText for this language doesn't exist or is an array of strings (old format)
      if (!processed.titleText[lang.value] || 
          (Array.isArray(processed.titleText[lang.value]) && 
          processed.titleText[lang.value].length > 0 && 
          typeof processed.titleText[lang.value][0] === 'string')) {
        
        // Convert string array to TitleItem array if needed
        if (Array.isArray(processed.titleText[lang.value]) && 
            typeof processed.titleText[lang.value][0] === 'string') {
          
          processed.titleText[lang.value] = (processed.titleText[lang.value] as string[]).map((text, index) => ({
            text,
            fontSize: index === 0 ? "2xl" : index === 1 ? "4xl" : "xl",
            fontWeight: index === 1 ? "bold" : "medium",
            color: "white"
          }));
        } else {
          // Use default title items for this language
          processed.titleText[lang.value] = defaultTitleItems[lang.value as keyof typeof defaultTitleItems];
        }
      }
    });
    
    return processed;
  };
  
  // Create form with processed initial data
  const form = useForm<HeroSettings>({
    resolver: zodResolver(heroSettingsSchema),
    defaultValues: processInitialData(initialData),
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
        throw new Error(error.message || "Beim Speichern der Hero-Einstellungen ist ein Fehler aufgetreten");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Erfolgreich gespeichert",
        description: "Die Hero-Einstellungen wurden erfolgreich aktualisiert.",
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

  // Function to get font size value in rems for preview
  function getFontSizeValue(size: string) {
    // Handle responsive sizes by taking the first value
    const firstSize = size?.split(" ")[0] || "";
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

  // Function to get font weight value for preview
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
    return weightMap[weight || "normal"] || "400";
  }

  // Add a new title line for current language
  function addTitleLine() {
    const currentTitles = form.getValues(`titleText.${selectedLanguage}`) || [];
    
    const newTitleItem: TitleItem = {
      text: "Neue Zeile",
      fontSize: "xl",
      fontWeight: "medium",
      color: "white"
    };
    
    form.setValue(`titleText.${selectedLanguage}`, [...currentTitles, newTitleItem], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  // Remove title line at specified index
  function removeTitleLine(index: number) {
    const currentTitles = form.getValues(`titleText.${selectedLanguage}`) || [];
    
    if (currentTitles.length <= 1) {
      toast({
        title: "Information",
        description: "Mindestens eine Titelzeile muss vorhanden sein.",
      });
      return;
    }
    
    const updatedTitles = currentTitles.filter((_, i) => i !== index);
    
    form.setValue(`titleText.${selectedLanguage}`, updatedTitles, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Language selection tabs */}
        <Tabs
          defaultValue="de"
          value={selectedLanguage}
          onValueChange={(value) => setSelectedLanguage(value as Language)}
          className="mb-4"
        >
          <TabsList className="mb-2">
            {supportedLanguages.map((lang) => (
              <TabsTrigger key={lang.value} value={lang.value}>
                {lang.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Preview box */}
        <Card className="bg-gray-800 text-white overflow-hidden">
          <CardHeader className="bg-gray-700 py-2">
            <CardTitle className="text-sm">Vorschau ({supportedLanguages.find(l => l.value === selectedLanguage)?.label})</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div>
              {form.watch(`titleText.${selectedLanguage}`)?.map((titleItem, index) => (
                <h1 
                  key={index}
                  className={`${index > 0 ? "mt-1" : ""} ${titleItem.fontFamily || ""}`}
                  style={{
                    color: titleItem.color || "white",
                    fontSize: getFontSizeValue(titleItem.fontSize),
                    fontWeight: getFontWeightValue(titleItem.fontWeight)
                  }}
                >
                  {titleItem.text}
                </h1>
              ))}
              <p 
                className="mt-3"
                style={{
                  color: form.watch("subtitleColor") || "white",
                  fontSize: getFontSizeValue(form.watch("subtitleFontSize")),
                  fontWeight: getFontWeightValue(form.watch("subtitleFontWeight"))
                }}
              >
                {form.watch(`subtitleText.${selectedLanguage}`)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Title section */}
        <div className="space-y-6">
          <h2 className="text-xl font-medium">Titel bearbeiten</h2>
          
          {form.watch(`titleText.${selectedLanguage}`)?.map((_, index) => (
            <Card key={index} className="border border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-md">Titelzeile {index + 1}</CardTitle>
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="sm"
                  onClick={() => removeTitleLine(index)}
                >
                  Entfernen
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <FormField
                  control={form.control}
                  name={`titleText.${selectedLanguage}.${index}.text`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Text</FormLabel>
                      <FormControl>
                        <Input placeholder="Titeltext eingeben" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`titleText.${selectedLanguage}.${index}.fontSize`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schriftgröße</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Schriftgröße" />
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
                    name={`titleText.${selectedLanguage}.${index}.fontWeight`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schriftstärke</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Schriftstärke" />
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`titleText.${selectedLanguage}.${index}.fontFamily`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schriftart</FormLabel>
                        <Select
                          value={field.value || "font-default"}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Schriftart wählen" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {fontFamilies.map((font) => (
                              <SelectItem key={font.value} value={font.value}>
                                {font.label}
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
                    name={`titleText.${selectedLanguage}.${index}.color`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Farbe</FormLabel>
                        <div className="flex space-x-2">
                          <FormControl>
                            <Input
                              placeholder="white, #ffffff"
                              {...field}
                            />
                          </FormControl>
                          {field.value?.startsWith('#') && (
                            <Input 
                              type="color" 
                              className="w-12 p-1" 
                              value={field.value} 
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            onClick={addTitleLine}
            className="mt-4"
            variant="outline"
          >
            Neue Titelzeile hinzufügen
          </Button>
        </div>

        {/* Subtitle section */}
        <div className="space-y-6">
          <h2 className="text-xl font-medium">Untertitel bearbeiten</h2>
          
          <Card>
            <CardContent className="pt-6 space-y-4">
              <FormField
                control={form.control}
                name={`subtitleText.${selectedLanguage}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Untertitel Text</FormLabel>
                    <FormControl>
                      <Input placeholder="Untertitel eingeben" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="my-4" />
              
              <h3 className="text-md font-medium">Untertitel-Stil (für alle Sprachen)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="subtitleFontSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schriftgröße</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Schriftgröße" />
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
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Schriftstärke" />
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

                <FormField
                  control={form.control}
                  name="subtitleColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Farbe</FormLabel>
                      <div className="flex space-x-2">
                        <FormControl>
                          <Input
                            placeholder="white, #ffffff"
                            {...field}
                          />
                        </FormControl>
                        {field.value?.startsWith('#') && (
                          <Input 
                            type="color" 
                            className="w-12 p-1" 
                            value={field.value} 
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Button
          type="submit"
          disabled={heroMutation.isPending}
          className="mt-8 w-full md:w-auto"
        >
          {heroMutation.isPending ? "Speichern..." : "Änderungen speichern"}
        </Button>
      </form>
    </Form>
  );
}