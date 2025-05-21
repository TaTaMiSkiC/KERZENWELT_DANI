import { MailService } from "@sendgrid/mail";

const mailService = new MailService();

// Initialize SendGrid with the API key
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("SENDGRID_API_KEY is not defined in environment variables");
}

// The business email address used as the sender
const FROM_EMAIL = "info@kerzenweltbydani.com";

interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from || FROM_EMAIL,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    console.log(`Email sent to ${params.to} with subject: ${params.subject}`);
    return true;
  } catch (error) {
    console.error("SendGrid email error:", error);
    return false;
  }
}

/**
 * Generate email verification HTML template
 */
export function generateVerificationEmailTemplate(
  username: string,
  verificationLink: string,
  language: string = "de",
): string {
  // Default to German if invalid language
  const validLanguages = ["de", "hr", "en", "it", "sl"];
  if (!validLanguages.includes(language)) {
    language = "de";
  }

  // Multi-language translation for email content
  const translations: Record<string, Record<string, string>> = {
    de: {
      title: "Bestätigen Sie Ihre E-Mail-Adresse",
      greeting: `Hallo ${username},`,
      message:
        "Vielen Dank für Ihre Registrierung bei Kerzenwelt by Dani. Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Registrierung abzuschließen.",
      button: "E-Mail bestätigen",
      expires: "Dieser Link ist 24 Stunden gültig.",
      ignore:
        "Wenn Sie diese E-Mail nicht angefordert haben, können Sie sie ignorieren.",
      thanks: "Vielen Dank,",
      team: "Das Kerzenwelt by Dani Team",
    },
    hr: {
      title: "Potvrdite svoju e-mail adresu",
      greeting: `Pozdrav ${username},`,
      message:
        "Hvala što ste se registrirali na Kerzenwelt by Dani. Molimo potvrdite svoju e-mail adresu kako biste završili registraciju.",
      button: "Potvrdi e-mail",
      expires: "Ova veza vrijedi 24 sata.",
      ignore: "Ako niste zatražili ovaj e-mail, možete ga ignorirati.",
      thanks: "Hvala,",
      team: "Tim Kerzenwelt by Dani",
    },
    en: {
      title: "Verify Your Email Address",
      greeting: `Hello ${username},`,
      message:
        "Thank you for registering with Kerzenwelt by Dani. Please verify your email address to complete your registration.",
      button: "Verify Email",
      expires: "This link is valid for 24 hours.",
      ignore: "If you did not request this email, you can safely ignore it.",
      thanks: "Thank you,",
      team: "The Kerzenwelt by Dani Team",
    },
    it: {
      title: "Verifica il tuo indirizzo email",
      greeting: `Ciao ${username},`,
      message:
        "Grazie per esserti registrato su Kerzenwelt by Dani. Verifica il tuo indirizzo email per completare la registrazione.",
      button: "Verifica email",
      expires: "Questo link è valido per 24 ore.",
      ignore: "Se non hai richiesto questa email, puoi ignorarla.",
      thanks: "Grazie,",
      team: "Il team di Kerzenwelt by Dani",
    },
    sl: {
      title: "Potrdite svoj e-poštni naslov",
      greeting: `Pozdravljeni ${username},`,
      message:
        "Zahvaljujemo se vam za registracijo na Kerzenwelt by Dani. Prosimo, potrdite svoj e-poštni naslov za dokončanje registracije.",
      button: "Potrdi e-pošto",
      expires: "Ta povezava velja 24 ur.",
      ignore:
        "Če tega e-poštnega sporočila niste zahtevali, ga lahko prezrete.",
      thanks: "Hvala,",
      team: "Ekipa Kerzenwelt by Dani",
    },
  };

  const t = translations[language];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t.title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .header img {
          max-width: 200px;
        }
        .content {
          background-color: #f9f9f9;
          padding: 30px;
          border-radius: 5px;
        }
        .button {
          display: inline-block;
          background-color: #D4AF37;
          color: white;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 4px;
          margin: 20px 0;
          font-weight: bold;
        }
        .footer {
          margin-top: 30px;
          font-size: 12px;
          color: #777;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Kerzenwelt by Dani</h1>
      </div>
      <div class="content">
        <h2>${t.title}</h2>
        <p>${t.greeting}</p>
        <p>${t.message}</p>
        <p style="text-align: center;">
          <a href="${verificationLink}" class="button">${t.button}</a>
        </p>
        <p><small>${t.expires}</small></p>
        <p><small>${t.ignore}</small></p>
        <p>${t.thanks}<br>${t.team}</p>
      </div>
      <div class="footer">
        <p>&copy; 2025 Kerzenwelt by Dani. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send verification email to user
 */
export async function sendVerificationEmail(
  email: string,
  username: string,
  token: string,
  language: string = "de",
): Promise<boolean> {
  try {
    // Build the verification link with the token
    // const verificationLink = `https://kerzenweltbydani.com/verify-email?token=${token}`;
    const verificationLink = `https://d07915c1-4b7a-458a-8b3d-720e6c5131b7-00-6gbh8d6ubmp1.spock.replit.dev/verify-email?token=${token}`;

    //const verificationLink = `https://kerzenwelt-by-dani.replit.app/verify-email?token=${token}`;
    // Generate the email HTML using our template
    const html = generateVerificationEmailTemplate(
      username,
      verificationLink,
      language,
    );

    // Get translated subject based on language
    const subjects = {
      de: "Bestätigen Sie Ihre E-Mail-Adresse - Kerzenwelt by Dani",
      hr: "Potvrdite svoju e-mail adresu - Kerzenwelt by Dani",
      en: "Verify Your Email Address - Kerzenwelt by Dani",
      it: "Verifica il tuo indirizzo email - Kerzenwelt by Dani",
      sl: "Potrdite svoj e-poštni naslov - Kerzenwelt by Dani",
    };

    const subject = subjects[language as keyof typeof subjects] || subjects.de;

    // Send the email
    return await sendEmail({
      to: email,
      subject: subject,
      html: html,
    });
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
}
