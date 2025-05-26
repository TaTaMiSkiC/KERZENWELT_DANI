import { NewsletterSubscribe } from "@/components/NewsletterSubscribe";
import { useLanguage } from "@/hooks/use-language";

export default function NewsletterPage() {
  const { t } = useLanguage();
  
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6">{t("newsletter.title")}</h1>
        <p className="text-center mb-8 text-gray-600">
          {t("newsletter.subtitle")}
        </p>
        
        <div className="mt-8">
          <NewsletterSubscribe />
        </div>
        
        <div className="mt-12 bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Why Subscribe?</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Get a 10% discount on your first order</li>
            <li>Be the first to know about new product launches</li>
            <li>Receive exclusive offers and promotions</li>
            <li>Get seasonal gift ideas and inspiration</li>
          </ul>
        </div>
      </div>
    </div>
  );
}