import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import logoImg from "@assets/Kerzenwelt by Dani.png";

// Funkcija za prevođenje načina plaćanja
export const getPaymentMethodText = (
  method: string,
  lang: string,
  translations: any,
) => {
  const t = translations;

  if (!method)
    return lang === "hr"
      ? "Nije definirano"
      : lang === "de"
        ? "Nicht definiert"
        : "Not defined";

  switch (method) {
    case "cash":
      return t.cash;
    case "bank_transfer":
      return t.bank;
    case "paypal":
      return t.paypal;
    case "credit_card":
      return t.credit_card;
    default:
      // Za nepoznati tip, vrati formatiran tekst
      const formattedMethod = method
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      return formattedMethod;
  }
};

// Funkcija za generiranje PDF-a identična onoj u order-details-page.tsx
export const generateInvoicePdf = (data: any, toast: any) => {
  try {
    console.log(
      "Početak generiranja PDF-a, dobiveni podaci:",
      JSON.stringify(data, null, 2),
    );

    // Određivanje jezika računa
    const lang = data.language || "hr";
    console.log("Korišteni jezik:", lang);

    // Određivanje datuma
    const currentDate = new Date();
    const formattedDate = format(currentDate, "dd.MM.yyyy.");

    // Broj računa
    const invoiceNumber = data.invoiceNumber || "i450";

    // Definiranje prijevoda za PDF
    const translations: Record<string, Record<string, string>> = {
      hr: {
        title: "RAČUN",
        date: "Datum računa",
        invoiceNo: "Broj računa",
        buyer: "Podaci o kupcu",
        seller: "Prodavatelj",
        item: "Proizvod",
        quantity: "Količina",
        price: "Cijena/kom",
        total: "Ukupno",
        subtotal: "Međuzbroj",
        tax: "PDV (0%)",
        totalAmount: "UKUPNO",
        paymentInfo: "Informacije o plaćanju",
        paymentMethod: "Način plaćanja",
        paymentStatus: "Status plaćanja",
        cash: "Gotovina",
        bank: "Bankovni prijenos",
        paypal: "PayPal",
        credit_card: "Kreditna kartica",
        paid: "Plaćeno",
        unpaid: "U obradi",
        deliveryAddress: "Adresa za dostavu",
        handInvoice: "Ručni račun",
        thankYou: "Hvala Vam na narudžbi",
        generatedNote:
          "Ovo je automatski generirani račun i valjan je bez potpisa i pečata",
        exemptionNote:
          "Poduzetnik nije u sustavu PDV-a, PDV nije obračunat temeljem odredbi posebnog postupka oporezivanja za male porezne obveznike.",
        orderItems: "Stavke narudžbe",
        shipping: "Dostava",
        customerNote: "Napomena kupca",
      },
      en: {
        title: "INVOICE",
        date: "Invoice date",
        invoiceNo: "Invoice number",
        buyer: "Buyer information",
        seller: "Seller",
        item: "Product",
        quantity: "Quantity",
        price: "Price/unit",
        total: "Total",
        subtotal: "Subtotal",
        tax: "VAT (0%)",
        totalAmount: "TOTAL",
        paymentInfo: "Payment information",
        paymentMethod: "Payment method",
        paymentStatus: "Payment status",
        cash: "Cash",
        bank: "Bank transfer",
        paypal: "PayPal",
        credit_card: "Credit card",
        paid: "Paid",
        unpaid: "Processing",
        deliveryAddress: "Delivery address",
        handInvoice: "Hand invoice",
        thankYou: "Thank you for your order",
        generatedNote:
          "This is an automatically generated invoice and is valid without signature or stamp",
        exemptionNote:
          "The entrepreneur is not in the VAT system, VAT is not calculated based on the provisions of the special taxation procedure for small taxpayers.",
        orderItems: "Order items",
        shipping: "Shipping",
        customerNote: "Customer note",
      },
      de: {
        title: "RECHNUNG",
        date: "Rechnungsdatum",
        invoiceNo: "Rechnungsnummer",
        buyer: "Käuferinformationen",
        seller: "Verkäufer",
        item: "Produkt",
        quantity: "Menge",
        price: "Preis/Stück",
        total: "Gesamt",
        subtotal: "Zwischensumme",
        tax: "MwSt. (0%)",
        totalAmount: "GESAMTBETRAG",
        paymentInfo: "Zahlungsinformationen",
        paymentMethod: "Zahlungsmethode",
        paymentStatus: "Zahlungsstatus",
        cash: "Barzahlung",
        bank: "Banküberweisung",
        paypal: "PayPal",
        credit_card: "Kreditkarte",
        paid: "Bezahlt",
        unpaid: "In Bearbeitung",
        deliveryAddress: "Lieferadresse",
        handInvoice: "Handrechnung",
        thankYou: "Vielen Dank für Ihre Bestellung",
        generatedNote:
          "Dies ist eine automatisch generierte Rechnung und ist ohne Unterschrift und Stempel gültig",
        exemptionNote:
          "Der Unternehmer ist nicht im Mehrwertsteuersystem, MwSt. wird nicht berechnet gemäß den Bestimmungen des Kleinunternehmerregelung.",
        orderItems: "Bestellpositionen",
        shipping: "Versand",
        customerNote: "Kundenhinweis",
      },
    };

    // Odabir prijevoda
    const t = translations[lang] || translations.hr;

    // Funkcija za dobivanje teksta načina plaćanja ovisno o odabranoj vrijednosti i jeziku
    const getPaymentStatusText = (status: string | undefined) => {
      if (!status) return t.unpaid;
      return status === "completed" ? t.paid : t.unpaid;
    };

    // Proširujemo jsPDF s lastAutoTable interfejsom
    interface ExtendedJsPDF extends jsPDF {
      lastAutoTable?: {
        finalY: number;
      };
    }

    // Kreiraj novi PDF dokument
    const doc = new jsPDF() as ExtendedJsPDF;

    // Postavljanje osnovnih detalja
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    // Gornji dio - Logo s lijeve strane i naslov na desnoj
    try {
      // Dodajemo logo
      doc.addImage(logoImg, "PNG", 20, 15, 30, 30);
    } catch (error) {
      console.error("Pogreška pri učitavanju loga:", error);
    }

    // Formatiranje datuma i broja računa
    doc.setTextColor(218, 165, 32); // Zlatna boja (RGB)
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Kerzenwelt by Dani", 55, 24);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); // Vraćanje na crnu boju
    doc.setFont("helvetica", "normal");
    doc.text("Ossiacher Zeile 30, 9500 Villach, Österreich", 55, 30);
    doc.text("Email: info@kerzenweltbydani.com", 55, 35);

    // Naslov i broj računa na desnoj strani
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(t.title, 190, 24, { align: "right" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`${t.invoiceNo}: ${invoiceNumber}`, 190, 32, { align: "right" });
    doc.text(`${t.date}: ${formattedDate}`, 190, 38, { align: "right" });

    // Horizontalna linija
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 45, 190, 45);

    // Podaci o kupcu
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${t.buyer}:`, 20, 55);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 57, 190, 57);
    doc.setFont("helvetica", "normal");

    let customerY = 62;

    // Dodajemo informacije o kupcu
    if (data.customerName) {
      doc.text(data.customerName, 20, customerY);
      customerY += 5;
    }

    if (data.customerEmail) {
      doc.text(`Email: ${data.customerEmail}`, 20, customerY);
      customerY += 5;
    }

    if (data.customerAddress) {
      doc.text(`${t.deliveryAddress}: ${data.customerAddress}`, 20, customerY);
      customerY += 5;
    }

    if (data.customerPostalCode || data.customerCity) {
      doc.text(
        `${data.customerPostalCode || ""} ${data.customerCity || ""}`,
        20,
        customerY,
      );
      customerY += 5;
    }

    if (data.customerCountry) {
      doc.text(data.customerCountry, 20, customerY);
      customerY += 5;
    }

    // Dodajemo napomene kupca u istoj liniji s podacima o kupcu ako postoje
    if (data.customerNote) {
      // Postavljanje teksta napomene pored podataka o kupcu
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${t.customerNote}:`, 120, 55); // Ista pozicija (Y) kao i "Podaci o kupcu"
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      // Napravimo potreban broj redova za napomenu - maksimalno 3 reda
      const noteLines = doc.splitTextToSize(data.customerNote, 65); // Nešto uži prostor za napomene
      const maxLines = Math.min(3, noteLines.length); // Maksimalno 3 reda

      for (let i = 0; i < maxLines; i++) {
        doc.text(noteLines[i], 120, 62 + i * 5); // Počinjemo ispod naslova napomene
      }
    }

    // Stavke narudžbe
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${t.orderItems}:`, 20, customerY + 5);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, customerY + 7, 190, customerY + 7);

    // Priprema podataka za tablicu
    let items = [];

    if (data.items && Array.isArray(data.items)) {
      items = data.items.map((item: any) => {
        let productName = item.productName || "";

        let details = [];

        // Dodaj miris ako postoji
        if (item.scentName || item.selectedScent) {
          // Koristi prijevod za riječ "Miris"
          const scentLabel =
            lang === "hr" ? "Miris" : lang === "de" ? "Duft" : "Scent";
          details.push(
            `${scentLabel}: ${item.scentName || item.selectedScent}`,
          );
        }

        // Dodaj boju/boje
        if (item.colorName || item.selectedColor) {
          // Koristi prijevod za riječ "Boja" ili "Boje"
          const colorSingular =
            lang === "hr" ? "Boja" : lang === "de" ? "Farbe" : "Color";
          const colorPlural =
            lang === "hr" ? "Boje" : lang === "de" ? "Farben" : "Colors";
          const colorPrefix = item.hasMultipleColors
            ? colorPlural
            : colorSingular;
          details.push(
            `${colorPrefix}: ${item.colorName || item.selectedColor}`,
          );
        }

        // Spoji naziv proizvoda s detaljima
        const detailsText = details.length > 0 ? `\n${details.join("\n")}` : "";
        const fullName = `${productName}${detailsText}`;
        const price = parseFloat(item.price).toFixed(2);
        const total = (parseFloat(item.price) * item.quantity).toFixed(2);

        return [fullName, item.quantity, `${price} €`, `${total} €`];
      });
    } else {
      // Dodajemo ručno barem jednu stavku ako nema podataka
      items = [["Proizvod nije specificiran", 1, "0.00 €", "0.00 €"]];
    }

    // Dodavanje tablice
    autoTable(doc, {
      head: [
        [
          t.item,
          t.quantity.replace(/\s+/g, " "), // Osigurajmo da nema višestrukih razmaka
          t.price,
          t.total,
        ],
      ],
      body: items,
      startY: customerY + 10,
      margin: { left: 20, right: 20 },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "left",
        valign: "middle",
        fontSize: 10,
        cellPadding: 5,
        minCellWidth: 30, // Osigurajmo da ćelije zaglavlja budu dovoljno široke
        overflow: "visible", // Osigurajmo da tekst ne bude prekinut
      },
      bodyStyles: {
        textColor: [0, 0, 0],
        fontSize: 10,
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 30, halign: "center" }, // Povećali smo širinu stupca "Menge" s 20 na 30
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
    });

    // Izračunavanje ukupnog iznosa
    let subtotal =
      data.items && Array.isArray(data.items)
        ? data.items.reduce(
            (sum: number, item: any) =>
              sum + parseFloat(item.price) * item.quantity,
            0,
          )
        : 0;

    // Sigurnosna provjera za shippingCost - ako ne postoji, stavi 0
    const shippingCost = data.shippingCost
      ? parseFloat(data.shippingCost)
      : 5.0;

    // Ukupan iznos s dostavom
    const total = parseFloat(data.total) || subtotal + shippingCost;

    // Dohvati poziciju nakon tablice
    const finalY = (doc as any).lastAutoTable.finalY || 200;

    // Dodavanje ukupnog iznosa
    doc.setFontSize(10);
    doc.text(`${t.subtotal}:`, 160, finalY + 10, { align: "right" });
    doc.text(`${subtotal.toFixed(2)} €`, 190, finalY + 10, { align: "right" });

    // Dodaj troškove dostave ako postoje
    doc.text(`${t.shipping}:`, 160, finalY + 15, { align: "right" });
    doc.text(`${shippingCost.toFixed(2)} €`, 190, finalY + 15, {
      align: "right",
    });

    // Zbog jednostavnosti porezni model, stavljamo PDV 0%
    doc.text(`${t.tax}:`, 160, finalY + 20, { align: "right" });
    doc.text("0.00 €", 190, finalY + 20, { align: "right" });

    // Ukupan iznos
    doc.setFont("helvetica", "bold");
    doc.text(`${t.totalAmount}:`, 160, finalY + 25, { align: "right" });
    doc.text(`${total.toFixed(2)} €`, 190, finalY + 25, { align: "right" });
    doc.setFont("helvetica", "normal");

    // Informacije o plaćanju
    doc.setDrawColor(200, 200, 200);
    doc.line(20, finalY + 30, 190, finalY + 30);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${t.paymentInfo}:`, 20, finalY + 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const paymentMethod = getPaymentMethodText(
      data.paymentMethod || "bank_transfer",
      lang,
      t,
    );
    const paymentStatus = getPaymentStatusText(data.paymentStatus);

    doc.text(`${t.paymentMethod}: ${paymentMethod}`, 20, finalY + 45);
    doc.text(`${t.paymentStatus}: ${paymentStatus}`, 20, finalY + 50);

    // Zahvala za narudžbu
    doc.setFontSize(10);
    doc.text(`${t.thankYou}!`, 105, finalY + 65, { align: "center" });

    // Podnožje s informacijama o tvrtki
    doc.setFontSize(8);
    doc.text(
      "Kerzenwelt by Dani | Ossiacher Zeile 30, 9500 Villach, Österreich | Email: info@kerzenweltbydani.com | Telefon: 004366038787621",
      105,
      finalY + 75,
      { align: "center" },
    );
    doc.text(`${t.generatedNote}.`, 105, finalY + 80, { align: "center" });
    doc.text("Steuernummer: 61 154/7175", 105, finalY + 85, {
      align: "center",
    });
    doc.text(`${t.exemptionNote}`, 105, finalY + 90, { align: "center" });

    // Spremi i preuzmi PDF
    doc.save(`invoice-${invoiceNumber}.pdf`);
  } catch (error) {
    console.error("Greška pri generiranju PDF-a:", error);
    console.log(
      "Stack trace:",
      error instanceof Error ? error.stack : "Nema stack trace-a",
    );

    toast({
      title: "Greška",
      description: "Došlo je do pogreške pri generiranju PDF računa.",
      variant: "destructive",
    });
  }
};
