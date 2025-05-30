import { useQuery } from "@tanstack/react-query";

interface TaxSettings {
  taxRate: number;
  taxIncluded: boolean;
  currency: string;
  currencySymbol: string;
}

export function useTax() {
  // Fetch tax settings
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  // Parse settings into tax configuration
  const taxSettings: TaxSettings = {
    taxRate: 0,
    taxIncluded: false,
    currency: "EUR",
    currencySymbol: "€",
  };

  if (settings && Array.isArray(settings)) {
    const settingsMap = settings.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    taxSettings.taxRate = parseFloat(settingsMap.tax_rate || "0");
    taxSettings.taxIncluded = settingsMap.tax_included === "true";
    taxSettings.currency = settingsMap.currency || "EUR";
    taxSettings.currencySymbol = settingsMap.currency_symbol || "€";
  }

  // Helper functions for tax calculations
  const calculateTax = (price: number): number => {
    if (taxSettings.taxRate === 0) return 0;
    
    if (taxSettings.taxIncluded) {
      // Tax is included in price, calculate tax amount
      return (price * taxSettings.taxRate) / (100 + taxSettings.taxRate);
    } else {
      // Tax is not included, calculate tax on top
      return (price * taxSettings.taxRate) / 100;
    }
  };

  const calculateNetPrice = (price: number): number => {
    if (taxSettings.taxRate === 0) return price;
    
    if (taxSettings.taxIncluded) {
      // Remove tax from gross price to get net price
      return price - calculateTax(price);
    } else {
      // Price is already net
      return price;
    }
  };

  const calculateGrossPrice = (price: number): number => {
    if (taxSettings.taxRate === 0) return price;
    
    if (taxSettings.taxIncluded) {
      // Price is already gross
      return price;
    } else {
      // Add tax to net price to get gross price
      return price + calculateTax(price);
    }
  };

  const formatPrice = (price: number): string => {
    const formattedAmount = price.toFixed(2);
    return `${formattedAmount} ${taxSettings.currencySymbol}`;
  };

  const formatPriceWithTax = (price: number): string => {
    if (taxSettings.taxRate === 0) {
      return formatPrice(price);
    }

    const grossPrice = calculateGrossPrice(price);
    const netPrice = calculateNetPrice(price);
    const taxAmount = calculateTax(price);

    if (taxSettings.taxIncluded) {
      return `${formatPrice(grossPrice)} (inkl. ${taxSettings.taxRate}% MwSt.: ${formatPrice(taxAmount)})`;
    } else {
      return `${formatPrice(netPrice)} + ${taxSettings.taxRate}% MwSt. = ${formatPrice(grossPrice)}`;
    }
  };

  const shouldShowTax = (): boolean => {
    return taxSettings.taxRate > 0;
  };

  return {
    taxSettings,
    calculateTax,
    calculateNetPrice,
    calculateGrossPrice,
    formatPrice,
    formatPriceWithTax,
    shouldShowTax,
  };
}