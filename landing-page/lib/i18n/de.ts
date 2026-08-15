import type { Dictionary } from "./types";

const de: Dictionary = {
  hero: {
    badge: "Früher Zugang jetzt möglich",
    headlineLine1: "Deckel drauf.",
    headlineLine2: "Nie mehr zu viel zahlen.",
    subhead:
      "Sichere dir den heutigen {fuelWord}preis. Fällt der Preis an der Zapfsäule unter deinen Fixpreis, erstattet FuelCap dir automatisch die Differenz — direkt in deinen Tank.",
    priceRisesLabel: "Preis steigt",
    priceFallsLabel: "Preis fällt",
    youWin: "Du gewinnst",
    tagline: "Kopf, du gewinnst. Zahl, du gewinnst.",
    cta: "Frühen Zugang sichern",
    ctaSub: "Keine Gebühren. Keine Verpflichtung. Dauert 30 Sekunden.",
  },
  viral: {
    eyebrow: "Zum Weitersagen gemacht",
    headline: "Drei Momente, die man einfach teilen muss",
    feature1Eyebrow: "Der virale Moment",
    feature1Headline: "Fällt der {fuelWord}preis, bekommst du Geld zurück.",
    feature1Quote: "„{FuelWord}preis gefallen. Ich habe {refundAmount} zurückbekommen.“",
    feature1Body:
      "Sobald der Preis an der Zapfsäule unter deinen Fixpreis fällt, gibt's eine Vollbild-Feier. Eine echte Überraschung zum Screenshotten und Teilen — kein Gutschein, eine echte Rückerstattung.",
    feature2Eyebrow: "Zum Angeben",
    feature2Headline: "Aus privaten Ersparnissen wird öffentlicher Status.",
    feature2Quote: "„Seit 6 Monaten zahle ich nicht mehr den vollen {fuelWord}preis.“",
    feature2Body:
      "Eine fertige Score-Karte zeigt gespartes Geld und deine Serie ohne Vollpreis — ein Tap für Story, Reel oder TikTok.",
    feature3Eyebrow: "Die Wachstumsschleife",
    feature3Headline: "Deine Crew. Günstigerer {fuelWord} für alle.",
    feature3Quote: "„Ich hole meine ganze Gruppe rein, gegen {fuelWord} für {highPrice}.“",
    feature3Body:
      "Jede Freundin und jeder Freund, der beitritt, senkt deinen Fixpreis pro Liter noch weiter — Teilen lohnt sich für dich selbst, ist kein Gefallen.",
    cta: "Ich bin dabei",
  },
  how: {
    eyebrow: "So funktioniert's",
    headline: "Drei Taps. Kein Risiko.",
    step1Title: "Preis fixieren",
    step1Body: "Kraftstoffart und Litermenge wählen. Dein Preis wird zum heutigen Kurs fixiert, ohne Gebühren.",
    step2Title: "Geschützt bleiben",
    step2Body:
      "Preis steigt? Du zahlst weiter deinen Fixpreis. Preis fällt? Du bekommst die Differenz automatisch erstattet.",
    step3Title: "Überall einlösen",
    step3Body:
      "Bezahle aus deinem virtuellen Tank per QR-Code an jeder Partner-Tankstelle — nicht an eine Marke gebunden.",
  },
  guarantee: {
    headline: "Die FuelCap-Garantie",
    item1Label: "Preis steigt",
    item1Detail: "Du zahlst weiter deinen Fixpreis.",
    item2Label: "Preis fällt",
    item2Detail: "Du bekommst automatisch die Differenz erstattet.",
    item3Label: "Du überlegst es dir anders",
    item3Detail: "Keine Gebühren. Jederzeit kündbar und auszahlbar.",
    builtFor: "Gemacht für",
    audience1: "Tägliche Pendler:innen",
    audience2: "Fahrer:innen von Rideshare & Lieferdiensten",
    audience3: "Familien, die viel fahren",
  },
  finalCta: {
    headlineLine1: "Kopf, du gewinnst.",
    headlineLine2: "Zahl, du gewinnst.",
    body: "Sichere dir den frühen Zugang und fixiere deinen ersten Liter am Tag unseres Starts in deiner Region.",
    cta: "Frühen Zugang sichern",
  },
  footer: {
    tagline: "Deckel drauf. Nie mehr zu viel zahlen.",
    disclaimer:
      "FuelCap befindet sich im frühen Zugang. Wir bauen gerade das Tankstellennetz auf — trag dich ein, um beim Start in deiner Region ganz vorne dabei zu sein.",
    changeMarket: "Nicht in diesem Land?",
  },
  stickyCta: "Frühen Zugang sichern — 30 Sekunden",
  signup: {
    backAria: "Zurück",
    noFeesLine: "Kein Spam. Keine Gebühren. Jederzeit kündbar.",
    country: {
      eyebrow: "Zuerst das Wichtigste",
      question: "Wo wohnst du?",
      options: {
        uk: "Vereinigtes Königreich",
        france: "Frankreich",
        germany: "Deutschland",
        spain: "Spanien",
        italy: "Italien",
        austria: "Österreich",
        australia: "Australien",
      },
    },
    state: {
      eyebrow: "Fast geschafft",
      question: "Welches Bundesland?",
      options: { nsw: "New South Wales", qld: "Queensland", wa: "Western Australia" },
    },
    gender: {
      eyebrow: "Kurze Frage zum Einstieg",
      question: "Du bist...",
      options: { male: "Männlich", female: "Weiblich", unspecified: "Keine Angabe" },
    },
    ageRange: {
      eyebrow: "Fast geschenkt",
      question: "Wie alt bist du?",
      options: {
        "18-24": "18–24",
        "25-34": "25–34",
        "35-44": "35–44",
        "45-54": "45–54",
        "55-plus": "55+",
      },
    },
    driverType: {
      eyebrow: "Wir lernen dich kennen",
      question: "Was trifft am besten auf dich zu?",
      options: {
        commuter: "Tägliche:r Pendler:in",
        "rideshare-delivery": "Rideshare- / Lieferfahrer:in",
        parent: "Elternteil, das viel fährt",
        other: "Etwas anderes",
      },
    },
    fillFrequency: {
      eyebrow: "Letzte Auswahlfrage, versprochen",
      question: "Wie oft tankst du?",
      options: {
        "1-2": "1–2x / Monat",
        "3-4": "3–4x / Monat",
        "5-8": "5–8x / Monat",
        "9-plus": "9+ / Monat",
      },
    },
    postal: {
      eyebrow: "Damit wir wissen, wo wir zuerst starten",
      question: "Wie lautet deine Postleitzahl?",
      cta: "Weiter",
      errorInvalid: "Gib eine gültige Postleitzahl ein.",
    },
    email: {
      eyebrow: "Letzter Schritt — du bist dabei",
      question: "Wohin sollen wir deinen frühen Zugang schicken?",
      placeholder: "du@email.com",
      cta: "Frühen Zugang sichern",
      errorInvalid: "Gib eine gültige E-Mail-Adresse ein.",
    },
    success: {
      headline: "Du bist auf der Liste!",
      body: "Wir schreiben dir, sobald FuelCap in deiner Region startet. Kopf, du gewinnst. Zahl, du gewinnst.",
      done: "Fertig",
    },
  },
};

export default de;
