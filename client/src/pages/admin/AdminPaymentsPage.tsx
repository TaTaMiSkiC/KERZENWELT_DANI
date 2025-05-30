import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin/AdminLayout";
import { Loader2, CreditCard, Calculator, Settings } from "lucide-react";

const taxSettingsSchema = z.object({
  taxRate: z.string().min(0, "MwSt. Satz muss mindestens 0% sein"),
  taxIncluded: z.boolean(),
  currency: z.string().min(1, "Währung ist erforderlich"),
  currencySymbol: z.string().min(1, "Währungssymbol ist erforderlich"),
});

type TaxSettingsFormValues = z.infer<typeof taxSettingsSchema>;

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch current tax settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/settings"],
  });

  const form = useForm<TaxSettingsFormValues>({
    resolver: zodResolver(taxSettingsSchema),
    defaultValues: {
      taxRate: "0",
      taxIncluded: false,
      currency: "EUR",
      currencySymbol: "€",
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings && Array.isArray(settings)) {
      const settingsMap = settings.reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
      
      form.reset({
        taxRate: settingsMap.tax_rate || "0",
        taxIncluded: settingsMap.tax_included === "true",
        currency: settingsMap.currency || "EUR",
        currencySymbol: settingsMap.currency_symbol || "€",
      });
    }
  }, [settings, form]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: TaxSettingsFormValues) => {
      const settingsToUpdate = [
        { key: "tax_rate", value: data.taxRate.toString() },
        { key: "tax_included", value: data.taxIncluded.toString() },
        { key: "currency", value: data.currency },
        { key: "currency_symbol", value: data.currencySymbol },
      ];

      const responses = await Promise.all(
        settingsToUpdate.map(async (setting) => {
          // First try to update the existing setting
          const updateResponse = await fetch(`/api/settings/${setting.key}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: setting.value }),
            credentials: "include",
          });

          // If updating failed (setting doesn't exist), create it
          if (!updateResponse.ok && updateResponse.status === 404) {
            return fetch("/api/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(setting),
              credentials: "include",
            });
          }

          return updateResponse;
        })
      );

      // Check if all requests were successful
      responses.forEach(response => {
        if (!response.ok) {
          throw new Error("Failed to update settings");
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Postavke spremljene",
        description: "MwSt. postavke su uspješno ažurirane.",
      });
    },
    onError: () => {
      toast({
        title: "Greška",
        description: "Dogodila se greška prilikom spremanja postavki.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TaxSettingsFormValues) => {
    setIsLoading(true);
    updateSettingsMutation.mutate(data);
    setIsLoading(false);
  };

  if (settingsLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.payments.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.payments.subtitle")}
          </p>
        </div>

        <div className="grid gap-6">
          {/* Tax Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                MwSt. Postavke
              </CardTitle>
              <CardDescription>
                Upravljajte stopom MwSt. i načinom izračuna poreza
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MwSt. Satz (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="Unesite MwSt. satz (npr. 20)"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Postavite na 0% za uklanjanje MwSt. iz cijele aplikacije
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valuta</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="EUR"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currencySymbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Simbol valute</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="€"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="taxIncluded"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              MwSt. uključen u cijenu
                            </FormLabel>
                            <FormDescription>
                              Da li je MwSt. već uračunat u prikazane cijene proizvoda
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={isLoading || updateSettingsMutation.isPending}
                      className="min-w-[120px]"
                    >
                      {(isLoading || updateSettingsMutation.isPending) ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Spremanje...
                        </>
                      ) : (
                        "Spremi postavke"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Current Settings Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Trenutne postavke
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">
                    {form.watch("taxRate") || "0"}%
                  </div>
                  <div className="text-sm text-muted-foreground">MwSt. Satz</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">
                    {form.watch("currencySymbol") || "€"}
                  </div>
                  <div className="text-sm text-muted-foreground">Valuta</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">
                    {form.watch("taxIncluded") ? "Da" : "Ne"}
                  </div>
                  <div className="text-sm text-muted-foreground">Uključen u cijenu</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">
                    {parseFloat(form.watch("taxRate") || "0") === 0 ? "Isključen" : "Aktivan"}
                  </div>
                  <div className="text-sm text-muted-foreground">Status MwSt.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}