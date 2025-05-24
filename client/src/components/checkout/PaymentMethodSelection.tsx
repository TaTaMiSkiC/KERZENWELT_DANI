import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, CheckCircle, Building } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { FormControl } from "@/components/ui/form";

interface PaymentMethodSelectionProps {
  value: string;
  onValueChange: (value: string) => void;
  paymentMethods: Record<string, boolean>;
}

export default function PaymentMethodSelection({
  value,
  onValueChange,
  paymentMethods,
}: PaymentMethodSelectionProps) {
  const { t } = useLanguage();

  return (
    <FormControl>
      <RadioGroup
        value={value}
        onValueChange={onValueChange}
        className="flex flex-col space-y-2"
      >
        {/* Credit Card (Stripe) */}
        {paymentMethods.stripe && (
          <div
            className={`flex items-center space-x-2 border rounded-lg p-4 ${
              value === "stripe"
                ? "border-primary bg-accent bg-opacity-10"
                : "border-gray-200"
            }`}
          >
            <RadioGroupItem value="stripe" id="stripe" />
            <label
              htmlFor="stripe"
              className="flex items-center cursor-pointer w-full"
            >
              <CreditCard className="mr-2 h-5 w-5 text-primary" />
              <div className="flex-1">
                <span className="font-medium">Kreditkarte</span>
                <p className="text-sm text-gray-500">
                  Visa, Mastercard, American Express
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg"
                  alt="Visa"
                  className="h-6"
                />
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg"
                  alt="Mastercard"
                  className="h-6"
                />
              </div>
            </label>
          </div>
        )}

        {/* PayPal */}
        {paymentMethods.paypal && (
          <div
            className={`flex items-center space-x-2 border rounded-lg p-4 ${
              value === "paypal"
                ? "border-primary bg-accent bg-opacity-10"
                : "border-gray-200"
            }`}
          >
            <RadioGroupItem value="paypal" id="paypal" />
            <label
              htmlFor="paypal"
              className="flex items-center cursor-pointer w-full"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2 text-primary"
              >
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
              <div className="flex-1">
                <span className="font-medium">PayPal</span>
                <p className="text-sm text-gray-500">
                  Bezahlen Sie schnell und sicher mit PayPal
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <img
                  src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg"
                  alt="PayPal"
                  className="h-6"
                />
              </div>
            </label>
          </div>
        )}

        {/* Klarna */}
        {paymentMethods.klarna && (
          <div
            className={`flex items-center space-x-2 border rounded-lg p-4 ${
              value === "klarna"
                ? "border-primary bg-accent bg-opacity-10"
                : "border-gray-200"
            }`}
          >
            <RadioGroupItem value="klarna" id="klarna" />
            <label
              htmlFor="klarna"
              className="flex items-center cursor-pointer w-full"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2 text-primary"
              >
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
              <div className="flex-1">
                <span className="font-medium">Klarna</span>
                <p className="text-sm text-gray-500">Bezahlen Sie mit Klarna</p>
              </div>
              <div className="flex items-center space-x-2">
                <img
                  src="https://www.klarna.com/assets/sites/5/2020/04/27140600/Klarna-LogoRGB-Black.jpg"
                  alt="Klarna"
                  className="h-6"
                />
              </div>
            </label>
          </div>
        )}

        {/* EPS */}
        {paymentMethods.eps && (
          <div
            className={`flex items-center space-x-2 border rounded-lg p-4 ${
              value === "eps"
                ? "border-primary bg-accent bg-opacity-10"
                : "border-gray-200"
            }`}
          >
            <RadioGroupItem value="eps" id="eps" />
            <label
              htmlFor="eps"
              className="flex items-center cursor-pointer w-full"
            >
              <Building className="mr-2 h-5 w-5 text-primary" />
              <div className="flex-1">
                <span className="font-medium">EPS</span>
                <p className="text-sm text-gray-500">
                  Bezahlen Sie mit Ihrem Online-Banking
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/EPS-payment-system-logo.svg/1280px-EPS-payment-system-logo.svg.png"
                  alt="EPS"
                  className="h-6"
                />
              </div>
            </label>
          </div>
        )}

        {/* Bank Transfer */}
        {paymentMethods.bank && (
          <div
            className={`flex items-center space-x-2 border rounded-lg p-4 ${
              value === "bank"
                ? "border-primary bg-accent bg-opacity-10"
                : "border-gray-200"
            }`}
          >
            <RadioGroupItem value="bank" id="bank" />
            <label
              htmlFor="bank"
              className="flex items-center cursor-pointer w-full"
            >
              <Building className="mr-2 h-5 w-5 text-primary" />
              <div className="flex-1">
                <span className="font-medium">Überweisung</span>
                <p className="text-sm text-gray-500">
                  Bezahlen Sie per Banküberweisung
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Cash on Delivery */}
        {paymentMethods.cash && (
          <div
            className={`flex items-center space-x-2 border rounded-lg p-4 ${
              value === "cash"
                ? "border-primary bg-accent bg-opacity-10"
                : "border-gray-200"
            }`}
          >
            <RadioGroupItem value="cash" id="cash" />
            <label
              htmlFor="cash"
              className="flex items-center cursor-pointer w-full"
            >
              <CheckCircle className="mr-2 h-5 w-5 text-primary" />
              <div className="flex-1">
                <span className="font-medium">Nachnahme</span>
                <p className="text-sm text-gray-500">
                  Bezahlung bei Lieferung an den Paketboten
                </p>
              </div>
            </label>
          </div>
        )}

        {/* In-store Pickup */}
        {paymentMethods.pickup && (
          <div
            className={`flex items-center space-x-2 border rounded-lg p-4 ${
              value === "pickup"
                ? "border-primary bg-accent bg-opacity-10"
                : "border-gray-200"
            }`}
          >
            <RadioGroupItem value="pickup" id="pickup" />
            <label
              htmlFor="pickup"
              className="flex items-center cursor-pointer w-full"
            >
              <Building className="mr-2 h-5 w-5 text-primary" />
              <div className="flex-1">
                <span className="font-medium">Abholung im Geschäft</span>
                <p className="text-sm text-gray-500">
                  Zahlung bei Abholung in unserem Geschäft
                </p>
              </div>
            </label>
          </div>
        )}
      </RadioGroup>
    </FormControl>
  );
}