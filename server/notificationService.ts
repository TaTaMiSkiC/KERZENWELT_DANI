import sgMail from "@sendgrid/mail";
import { db } from "./db"; // Pretpostavljam da je ovo točan import
import { Order } from "@shared/schema"; // Pretpostavljam da je ovo točan import

// Inicijalizacija SendGrid API-a
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn(
    "SENDGRID_API_KEY nije postavljen. E-mail obavijesti neće raditi.",
  );
}

// --- Konfiguracijske konstante (PREPORUČUJE SE SVE OVO DRŽATI U ZASEBNOJ 'config.ts' DATOTECI ILI U .env) ---
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "Kerzenwelt by Dani <info@kerzenweltbydani.com>";
const FROM_EMAIL =
  process.env.FROM_EMAIL || "Kerzenwelt by Dani <info@kerzenweltbydani.com>";

const LOGO_URL = "https://kerzenweltbydani.com/assets/new-logo-Cq0ZY76U.png";
const LOGO_ALT_TEXT = "Kerzenwelt by Dani Logo";
const BRAND_COLOR = "#D9B33C"; // Točan hex kod boje s loga: #F7941D

// Dodani placeholderi za ostale konstante koje se koriste
const ADMIN_PHONE = process.env.ADMIN_PHONE || "00436601234567"; // Zamijenite stvarnim brojem
const STORE_NAME = process.env.STORE_NAME || "Kerzenwelt by Dani";
const STORE_DOMAIN = process.env.STORE_DOMAIN || "https://kerzenweltbydani.com";
// --- Kraj konfiguracijskih konstanti ---

// --- Pomoćne HTML komponente (smjestite ovo prije funkcija za slanje maila) ---

// HTML za zaglavlje maila (Kerzenwelt by Dani s logom i crtom)
const getEmailHeader = (): string => {
  return `
    <div style="font-family: sans-serif; padding-bottom: 10px; text-align: center;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
        <tr>
          <td style="padding-right: 10px; vertical-align: middle;">
            <img src="${LOGO_URL}" alt="${LOGO_ALT_TEXT}" style="width: 40px; height: auto; display: block;">
          </td>
          <td style="vertical-align: middle; text-align: left;">
            <h1 style="color: ${BRAND_COLOR}; font-size: 24px; margin: 0; line-height: 1;">Kerzenwelt by Dani</h1>
          </td>
        </tr>
      </table>
      <hr style="border: none; border-top: 2px solid ${BRAND_COLOR}; width: 100%; max-width: 600px; margin: 20px auto;">
    </div>
  `;
};

// HTML za potpis maila
const getEmailSignature = (): string => {
  return `
    <p style="margin-top: 20px; text-align: center;">
      Mit freundlichen Grüßen,<br>
      Ihr Kerzenwelt by Dani<br>
      Telefon: <a href="tel:+00436603878221">0043 660 3878221</a><br>
      Website: <a href="https://kerzenweltbydani.com/" target="_blank">https://kerzenweltbydani.com/</a>
    </p>
  `;
};

// Funkcija za omotavanje glavnog HTML sadržaja u globalni layout
const getFullEmailHtml = (mainHtmlContent: string): string => {
  return `
    <div style="font-family: sans-serif; font-size: 15px; line-height: 1.4; color: #333333; text-align: center;">
      ${getEmailHeader()}
      <div style="max-width: 600px; margin: 0 auto; text-align: left;">
          ${mainHtmlContent}
      </div>
      ${getEmailSignature()}
    </div>
  `;
};
// --- Kraj pomoćnih HTML komponenti ---

// --- GLAVNE FUNKCIJE ZA SLANJE MAILA ---

// Generic email sending function (AŽURIRANA)
export async function sendEmail(params: {
  to: string;
  subject: string;
  text?: string;
  html: string; // Očekuje se samo glavni HTML sadržaj, layout se dodaje
  from?: string; // from je sada opcionalan, koristit ćemo FROM_EMAIL ako nije proslijeđen
}) {
  try {
    if (!process.env.SENDGRID_API_KEY || !FROM_EMAIL) {
      console.warn(
        "E-mail obavijest nije poslana: SENDGRID_API_KEY ili FROM_EMAIL nisu postavljeni.",
      );
      return false;
    }

    const emailFrom = params.from || FROM_EMAIL; // Koristi proslijeđeni 'from' ili globalni FROM_EMAIL

    // Glavni dio: omotavamo proslijeđeni HTML u naš layout
    const fullHtml = getFullEmailHtml(params.html);

    await sgMail.send({
      to: params.to,
      from: emailFrom,
      subject: params.subject,
      text: params.text, // Tekstualna verzija ostaje ista
      html: fullHtml, // Sada šaljemo HTML s kompletnim layoutom
    });
    return true;
  } catch (error) {
    0;
    console.error("SendGrid email error:", error);
    return false;
  }
}

// Funkcija za slanje e-mail obavijesti (AŽURIRANA - koristi sendEmail)
export async function sendEmailNotification(
  subject: string,
  htmlContent: string, // Glavni sadržaj maila
  to: string = ADMIN_EMAIL,
): Promise<boolean> {
  // Ova funkcija sada samo prosljeđuje poziv na generičku sendEmail funkciju,
  // osiguravajući da obje koriste isti mehanizam slanja i layout.
  return sendEmail({
    to,
    subject,
    html: htmlContent, // Proslijeđuje se samo glavni HTML, layout se dodaje unutar sendEmail
    from: FROM_EMAIL, // Osiguravamo da se koristi FROM_EMAIL definiran na vrhu
  });
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

// Funkcija za slanje obavijesti o novoj narudžbi (AŽURIRANA ZA NOVI LAYOUT)
export async function sendNewOrderNotification(
  order: Order,
  options: NotificationOptions = {},
): Promise<void> {
  const { emailEnabled = true, smsEnabled = true } = options;

  // Format cijene i datum
  const formattedPrice = order.total; // Pretpostavljam da je ovo već formatirano
  const orderDate = new Date(order.createdAt).toLocaleDateString("de-AT");

  if (emailEnabled) {
    const emailSubject = `Nova narudžba #${order.id} - ${STORE_NAME}`;
    // Glavni HTML sadržaj e-maila (bez vlastitog zaglavlja i podnožja)
    const emailContent = `
      <p>Poštovanje,</p>
      <p>Imate novu narudžbu na vašoj web trgovini.</p>

      <h3 style="background-color: #f7f7f7; padding: 10px; border-radius: 5px; text-align: center;">Detalji narudžbe #${order.id}</h3>
      <p><strong>Datum:</strong> ${orderDate}</p>
      <p><strong>Ukupno:</strong> ${formattedPrice} EUR</p>
      <p><strong>Način plaćanja:</strong> ${order.paymentMethod}</p>
      <p><strong>Status:</strong> ${order.status}</p>

      <p style="margin-top: 30px;">Kliknite na poveznicu ispod za pregled detalja narudžbe:</p>
      <p style="text-align: center;"><a href="${STORE_DOMAIN}/admin/orders/${order.id}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pregledaj narudžbu</a></p>

      <p style="margin-top: 30px; color: #888; font-size: 12px; text-align: center;">Ova e-mail poruka je automatski generirana. Molimo vas ne odgovarajte na ovu poruku.</p>
    `;

    sendEmailNotification(emailSubject, emailContent);
  }

  if (smsEnabled) {
    // Generiraj SMS poruku (kratak sadržaj)
    const smsMessage = `Nova narudžba #${order.id} na ${STORE_NAME} - Ukupno: ${formattedPrice} EUR`;
    sendSmsNotification(smsMessage);
  }
}

// Funkcija za obavijest o generiranom računu (AŽURIRANA ZA NOVI LAYOUT)
export async function sendInvoiceGeneratedNotification(
  orderId: number,
  invoiceId: number,
  options: NotificationOptions = {},
): Promise<void> {
  const { emailEnabled = true, smsEnabled = true } = options;

  if (emailEnabled) {
    const emailSubject = `Novi račun kreiran - ${STORE_NAME}`;
    // Glavni HTML sadržaj e-maila (bez vlastitog zaglavlja i podnožja)
    const emailContent = `
      <p>Poštovanje,</p>
      <p>Automatski je kreiran novi račun za narudžbu #${orderId}.</p>

      <p style="margin-top: 30px;">Kliknite na poveznicu ispod za pregled detalja računa:</p>
      <p style="text-align: center;"><a href="https://kerzenworld.com/admin/invoices/${invoiceId}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pregledaj račun</a></p>

      <p style="margin-top: 30px; color: #888; font-size: 12px; text-align: center;">Ova e-mail poruka je automatski generirana. Molimo vas ne odgovarajte na ovu poruku.</p>
    `;

    sendEmailNotification(emailSubject, emailContent);
  }

  if (smsEnabled) {
    const smsMessage = `Novi račun kreiran za narudžbu #${orderId} na ${STORE_NAME}`;
    sendSmsNotification(smsMessage);
  }
}
