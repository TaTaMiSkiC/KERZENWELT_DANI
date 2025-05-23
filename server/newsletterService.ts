// Newsletter Service Implementation
import { storage } from './storage';
import { Subscriber, InsertSubscriber } from '@shared/schema';
import { generateRandomString } from './utils';

/**
 * Generiert einen eindeutigen Rabattcode
 * @returns Ein zufälliger Rabattcode für neue Abonnenten
 */
export function generateDiscountCode(): string {
  // Generiere einen 8-stelligen alphanumerischen Code
  return `NL-${generateRandomString(8)}`;
}

/**
 * Verarbeitet ein neues Newsletter-Abonnement
 * @param email E-Mail des neuen Abonnenten
 * @param language Bevorzugte Sprache des Abonnenten
 * @returns Das erstellte Abonnement mit Rabattcode
 */
export async function processSubscription(email: string, language: string = 'de'): Promise<Subscriber> {
  // Prüfe, ob der Abonnent bereits existiert
  const existingSubscriber = await storage.getSubscriberByEmail(email);
  if (existingSubscriber) {
    return existingSubscriber;
  }
  
  // Generiere einen eindeutigen Rabattcode
  const discountCode = generateDiscountCode();
  
  // Erstelle den neuen Abonnenten in der Datenbank
  const subscriberData: InsertSubscriber = {
    email,
    language,
    discountCode
  };
  
  return await storage.createSubscriber(subscriberData);
}

/**
 * Prüft, ob ein Rabattcode gültig ist und nicht verwendet wurde
 * @param code Der zu prüfende Rabattcode
 * @returns true wenn der Code gültig ist, sonst false
 */
export async function isValidDiscountCode(code: string): Promise<boolean> {
  const subscriber = await storage.getSubscriberByDiscountCode(code);
  
  // Code ist gültig, wenn der Abonnent existiert und der Code nicht verwendet wurde
  return !!subscriber && !subscriber.discountUsed;
}

/**
 * Markiert einen Rabattcode als verwendet
 * @param code Der als verwendet zu markierende Rabattcode
 * @returns true wenn erfolgreich markiert, sonst false
 */
export async function markDiscountCodeAsUsed(code: string): Promise<boolean> {
  const subscriber = await storage.getSubscriberByDiscountCode(code);
  if (!subscriber) return false;
  
  return await storage.markDiscountAsUsed(subscriber.email);
}