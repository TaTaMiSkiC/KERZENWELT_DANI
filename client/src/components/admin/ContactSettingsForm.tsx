import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// Definicija sheme za validaciju forme
const contactFormSchema = z.object({
  address: z.string().min(1, { message: "Adresa je obavezna" }),
  city: z.string().min(1, { message: "Grad je obavezan" }),
  postalCode: z.string().min(1, { message: "Poštanski broj je obavezan" }),
  phone: z.string().min(1, { message: "Broj telefona je obavezan" }),
  email: z.string().email({ message: "Unesite valjanu email adresu" }),
  workingHours: z.string().min(1, { message: "Radno vrijeme je obavezno" }),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function ContactSettingsForm() {
  const { toast } = useToast();

  // Dohvaćanje trenutnih postavki
  const { data: contactData, isLoading } = useQuery({
    queryKey: ["/api/settings/contact"],
    queryFn: async () => {
      const res = await fetch("/api/settings/contact");
      if (!res.ok) {
        throw new Error("Neuspješno dohvaćanje kontakt podataka");
      }
      return await res.json();
    },
  });

  // Definicija forme
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      address: "",
      city: "",
      postalCode: "",
      phone: "",
      email: "",
      workingHours: "",
    },
  });

  // Ažuriranje podataka forme kada se dohvate podaci
  React.useEffect(() => {
    if (contactData) {
      form.reset({
        address: contactData.address || "",
        city: contactData.city || "",
        postalCode: contactData.postalCode || "",
        phone: contactData.phone || "",
        email: contactData.email || "",
        workingHours: contactData.workingHours || "",
      });
    }
  }, [contactData, form]);

  // Mutacija za ažuriranje postavki
  const updateMutation = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      const response = await apiRequest("POST", "/api/settings/contact", data);
      if (!response.ok) {
        throw new Error("Neuspješno ažuriranje kontakt podataka");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/contact"] });
      toast({
        title: "Uspješno spremljeno",
        description: "Kontakt podaci su uspješno ažurirani.",
      });
    },
    onError: (error) => {
      toast({
        title: "Greška",
        description: `Neuspješno ažuriranje: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Submit handler
  const onSubmit = (data: ContactFormValues) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold mb-4">Kontakt podaci</h2>
      <p className="text-muted-foreground mb-6">
        Ovi podaci će se prikazivati u podnožju stranice i na kontakt stranici.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Österreich" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grad</FormLabel>
                  <FormControl>
                    <Input placeholder="Villach" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poštanski broj</FormLabel>
                  <FormControl>
                    <Input placeholder="9500" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl>
                    <Input placeholder="00436603878221" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="info@kerzenweltbydani.vom" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="workingHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Radno vrijeme</FormLabel>
                  <FormControl>
                    <Input placeholder="Mo -Fr: 13:00 - 20:00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full md:w-auto"
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Spremi promjene
          </Button>
        </form>
      </Form>
    </div>
  );
}
