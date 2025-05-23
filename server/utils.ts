/**
 * Utility functions for the application
 */

/**
 * Generates a random alphanumeric string of specified length
 * @param length Length of the string to generate
 * @returns Random alphanumeric string
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Formats a price to have two decimal places and use a specific currency format
 * @param price Price as a number or string
 * @param locale Locale for formatting (default: de-DE)
 * @param currency Currency code (default: EUR)
 * @returns Formatted price string
 */
export function formatPrice(price: number | string, locale: string = 'de-DE', currency: string = 'EUR'): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(numPrice);
}

/**
 * Formats a date according to the given locale
 * @param date Date to format
 * @param locale Locale for formatting (default: de-DE)
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, locale: string = 'de-DE'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Truncates text to specified length with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}