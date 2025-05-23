import sgMail from "@sendgrid/mail";
import { db } from "./db";
import { Order } from "@shared/schema";

// Inicijalizacija SendGrid API-a
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn(
    "SENDGRID_API_KEY nije postavljen. E-mail obavijesti neće raditi.",
  );
}

// Konfiguracijske konstante
const ADMIN_EMAIL = "info@kerzenweltbydani.com";
const ADMIN_PHONE = "+436603878221";
const STORE_NAME = "Kerzenwelt by Dani";
const FROM_EMAIL = "info@kerzenweltbydani.com";
const STORE_DOMAIN = "https://kerzenweltbydani.com";;

interface NotificationOptions {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
}

// Funkcija za slanje e-mail obavijesti
export async function sendEmailNotification(
  subject: string,
  htmlContent: string,
  to: string = ADMIN_EMAIL,
): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn(
        "E-mail obavijest nije poslana: SENDGRID_API_KEY nije postavljen.",
      );
      return false;
    }

    const msg = {
      to,
      from: FROM_EMAIL,
      subject,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log(`E-mail obavijest uspješno poslana na: ${to}`);
    return true;
  } catch (error) {
    console.error("Greška prilikom slanja e-mail obavijesti:", error);
    return false;
  }
}

// Funkcija za slanje SMS obavijesti (implementacija će ovisiti o SMS servisu)
export async function sendSmsNotification(
  message: string,
  to: string = ADMIN_PHONE,
): Promise<boolean> {
  // Ovo je simulacija, za pravu implementaciju potreban je API ključ za SMS servis
  // kao što je Twilio ili sličan servis
  console.log(`SMS obavijest bi bila poslana na ${to}: ${message}`);
  return true;
}

// Funkcija za slanje obavijesti o novoj narudžbi
export async function sendNewOrderNotification(
  order: Order,
  options: NotificationOptions = {},
): Promise<void> {
  const { emailEnabled = true, smsEnabled = true } = options;

  // Format cijene i datum
  const formattedPrice = order.total;
  const orderDate = new Date(order.createdAt).toLocaleDateString("de-AT");

  if (emailEnabled) {
    // Generiraj HTML sadržaj e-maila
    const emailSubject = `Nova narudžba #${order.id} - ${STORE_NAME}`;
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #D4AF37; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">Nova narudžba na ${STORE_NAME}</h2>
        <p>Poštovanje,</p>
        <p>Imate novu narudžbu na vašoj web trgovini.</p>
        
        <h3 style="background-color: #f7f7f7; padding: 10px;">Detalji narudžbe #${order.id}</h3>
        <p><strong>Datum:</strong> ${orderDate}</p>
        <p><strong>Ukupno:</strong> ${formattedPrice} EUR</p>
        <p><strong>Način plaćanja:</strong> ${order.paymentMethod}</p>
        <p><strong>Status:</strong> ${order.status}</p>
        
        <p style="margin-top: 30px;">Kliknite na poveznicu ispod za pregled detalja narudžbe:</p>
        <p><a href="${STORE_DOMAIN}/admin/orders/${order.id}" style="display: inline-block; background-color: #D4AF37; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pregledaj narudžbu</a></p>
        
        <p style="margin-top: 30px; color: #888; font-size: 12px;">Ova e-mail poruka je automatski generirana. Molimo vas ne odgovarajte na ovu poruku.</p>
      </div>
    `;

    sendEmailNotification(emailSubject, emailContent);
  }

  if (smsEnabled) {
    // Generiraj SMS poruku (kratak sadržaj)
    const smsMessage = `Nova narudžba #${order.id} na ${STORE_NAME} - Ukupno: ${formattedPrice} EUR`;
    sendSmsNotification(smsMessage);
  }
}

// Funkcija za obavijest o generiranom računu
export async function sendInvoiceGeneratedNotification(
  orderId: number,
  invoiceId: number,
  options: NotificationOptions = {},
): Promise<void> {
  const { emailEnabled = true, smsEnabled = true } = options;

  if (emailEnabled) {
    const emailSubject = `Novi račun kreiran - ${STORE_NAME}`;
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #D4AF37; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">Automatski kreiran račun na ${STORE_NAME}</h2>
        <p>Poštovanje,</p>
        <p>Automatski je kreiran novi račun za narudžbu #${orderId}.</p>
        
        <p style="margin-top: 30px;">Kliknite na poveznicu ispod za pregled detalja računa:</p>
        <p><a href="https://kerzenworld.com/admin/invoices/${invoiceId}" style="display: inline-block; background-color: #D4AF37; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pregledaj račun</a></p>
        
        <p style="margin-top: 30px; color: #888; font-size: 12px;">Ova e-mail poruka je automatski generirana. Molimo vas ne odgovarajte na ovu poruku.</p>
      </div>
    `;

    sendEmailNotification(emailSubject, emailContent);
  }

  if (smsEnabled) {
    const smsMessage = `Novi račun kreiran za narudžbu #${orderId} na ${STORE_NAME}`;
    sendSmsNotification(smsMessage);
  }
}
