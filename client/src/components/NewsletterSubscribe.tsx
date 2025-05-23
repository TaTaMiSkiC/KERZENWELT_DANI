import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Define the subscription schema
const subscribeSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  language: z.string().default("en")
});

type SubscribeFormData = z.infer<typeof subscribeSchema>;

export function NewsletterSubscribe() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [discountCode, setDiscountCode] = useState("");

  const form = useForm<SubscribeFormData>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: {
      email: "",
      language: "en"
    }
  });

  async function onSubmit(data: SubscribeFormData) {
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setDiscountCode(result.discountCode);
        toast({
          title: "Successfully subscribed!",
          description: "Thank you for subscribing to our newsletter.",
        });
      } else {
        toast({
          title: "Subscription failed",
          description: result.message || "Something went wrong. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Subscription error:", error);
      toast({
        title: "Subscription failed",
        description: "An error occurred while subscribing. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Reset the form to initial state
  const resetForm = () => {
    setSuccess(false);
    setDiscountCode("");
    form.reset();
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-center">Subscribe to our Newsletter</h2>
      
      {success ? (
        <div className="text-center">
          <div className="mb-4">
            <p className="text-green-600 font-medium mb-2">Thank you for subscribing!</p>
            <p>Your discount code:</p>
            <div className="bg-gray-100 p-3 rounded-md my-2 font-mono text-lg text-center">
              {discountCode}
            </div>
            <p className="text-sm text-gray-600 mt-2">Use this code at checkout to get 10% off your first order.</p>
          </div>
          <Button onClick={resetForm}>Subscribe another email</Button>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="your.email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Subscribing..." : "Subscribe"}
            </Button>
            
            <p className="text-xs text-gray-500 mt-2 text-center">
              By subscribing, you agree to receive our newsletter and marketing emails. You can unsubscribe at any time.
            </p>
          </form>
        </Form>
      )}
    </div>
  );
}