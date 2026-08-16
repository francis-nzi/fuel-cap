import type { Dictionary } from "./types";

const it: Dictionary = {
  hero: {
    badge: "L'accesso anticipato è aperto",
    headlineLine1: "Blocca il tuo prezzo.",
    headlineLine2: "Non pagare mai troppo.",
    subhead:
      "Blocca il prezzo di oggi della {fuelWord}. Se il prezzo alla pompa scende sotto il tuo prezzo bloccato, FuelCap ti rimborsa automaticamente la differenza — direttamente nel tuo serbatoio.",
    priceRisesLabel: "Il prezzo sale",
    priceFallsLabel: "Il prezzo scende",
    youWin: "Vinci tu",
    tagline: "Testa vinci tu. Croce vinci tu.",
    cta: "Ottieni l'accesso anticipato",
    ctaSub: "Nessuna commissione. Nessun vincolo. Bastano 30 secondi.",
  },
  viral: {
    eyebrow: "Fatto per essere condiviso",
    headline: "Tre momenti che tutti vogliono condividere",
    feature1Eyebrow: "Il momento virale",
    feature1Headline: "Quando il prezzo della {fuelWord} scende, sei tu a guadagnarci.",
    feature1Quote: "«La benzina è scesa. Mi sono visto rimborsare {refundAmount}.»",
    feature1Body:
      "Appena il prezzo alla pompa scende sotto il tuo prezzo bloccato, parte una celebrazione a schermo intero. Una vera sorpresa da fare screenshot e condividere — non un buono sconto, un rimborso reale.",
    feature2Eyebrow: "Per vantarsi",
    feature2Headline: "Trasforma un risparmio privato in status pubblico.",
    feature2Quote: "«Sono 6 mesi che non pago la benzina a prezzo pieno.»",
    feature2Body:
      "Una scheda punteggio pronta da pubblicare mostra i soldi risparmiati e la tua striscia senza prezzo pieno — un tap per condividerla su Stories, Reels o TikTok.",
    feature3Eyebrow: "Il ciclo di crescita",
    feature3Headline: "Il tuo gruppo. Benzina più economica per tutti.",
    feature3Quote: "«Ho portato tutto il mio gruppo per combattere la benzina a {highPrice}.»",
    feature3Body:
      "Ogni amico che si iscrive abbassa ancora di più il tuo prezzo bloccato al litro — condividere conviene a te, non è un favore.",
    cta: "Voglio partecipare",
  },
  how: {
    eyebrow: "Come funziona",
    headline: "Tre tap. Zero rischi.",
    step1Title: "Blocca un prezzo",
    step1Body:
      "Scegli il tipo di carburante e quanti litri. Il tuo prezzo viene bloccato a quello di oggi, senza commissioni.",
    step2Title: "Resta protetto",
    step2Body:
      "Il prezzo sale? Paghi comunque il tuo prezzo bloccato. Il prezzo scende? Ricevi automaticamente il rimborso della differenza.",
    step3Title: "Usalo ovunque",
    step3Body:
      "Paga dal tuo serbatoio virtuale con un codice QR in qualsiasi stazione partner — senza vincoli a un solo marchio.",
  },
  guarantee: {
    headline: "La garanzia FuelCap",
    item1Label: "Il prezzo sale",
    item1Detail: "Paghi comunque il tuo prezzo bloccato.",
    item2Label: "Il prezzo scende",
    item2Detail: "Ricevi il rimborso automaticamente.",
    item3Label: "Cambi idea",
    item3Detail: "Nessuna commissione. Annulla e ritira il saldo quando vuoi.",
    builtFor: "Pensato per",
    audience1: "Pendolari quotidiani",
    audience2: "Autisti rideshare e rider delle consegne",
    audience3: "Famiglie che guidano molto",
  },
  finalCta: {
    headlineLine1: "Testa vinci tu.",
    headlineLine2: "Croce vinci tu.",
    body: "Unisciti all'accesso anticipato e blocca il tuo primo litro il giorno del lancio nella tua zona.",
    cta: "Ottieni l'accesso anticipato",
  },
  footer: {
    tagline: "Blocca il tuo prezzo. Non pagare mai troppo.",
    disclaimer:
      "FuelCap è in accesso anticipato. Stiamo costruendo la rete di stazioni prima del lancio generale — iscriviti alla lista d'attesa per essere tra i primi quando arriviamo nella tua zona.",
    changeMarket: "Non sei in questo paese?",
  },
  stickyCta: "Ottieni l'accesso anticipato — 30 secondi",
  signup: {
    backAria: "Indietro",
    noFeesLine: "Niente spam. Nessuna commissione. Annulla quando vuoi.",
    country: {
      eyebrow: "Prima le basi",
      question: "Dove vivi?",
      options: {
        usa: "Stati Uniti",
        canada: "Canada",
        uk: "Regno Unito",
        france: "Francia",
        germany: "Germania",
        spain: "Spagna",
        italy: "Italia",
        austria: "Austria",
        australia: "Australia",
      },
    },
    state: {
      eyebrow: "Ci siamo quasi",
      question: "Quale stato?",
      options: { nsw: "Nuovo Galles del Sud", qld: "Queensland", wa: "Australia Occidentale" },
    },
    gender: {
      eyebrow: "Una domanda veloce per iniziare",
      question: "Sei...",
      options: { male: "Uomo", female: "Donna", unspecified: "Preferisco non specificare" },
    },
    ageRange: {
      eyebrow: "Quasi un gioco da ragazzi",
      question: "Qual è la tua fascia d'età?",
      options: {
        "18-24": "18–24",
        "25-34": "25–34",
        "35-44": "35–44",
        "45-54": "45–54",
        "55-plus": "55+",
      },
    },
    driverType: {
      eyebrow: "Conosciamoci meglio",
      question: "Cosa ti descrive meglio?",
      options: {
        commuter: "Pendolare quotidiano",
        "rideshare-delivery": "Autista rideshare / rider delle consegne",
        parent: "Genitore che guida molto",
        other: "Altro",
      },
    },
    fillFrequency: {
      eyebrow: "Ultima domanda a scelta multipla, promesso",
      question: "Con che frequenza fai il pieno?",
      options: {
        "1-2": "1–2 volte / mese",
        "3-4": "3–4 volte / mese",
        "5-8": "5–8 volte / mese",
        "9-plus": "9+ volte / mese",
      },
    },
    postal: {
      eyebrow: "Per sapere dove lanciarci per primi",
      question: "Qual è il tuo CAP?",
      cta: "Continua",
      errorInvalid: "Inserisci un CAP valido.",
    },
    email: {
      eyebrow: "Ultimo passo — ci sei",
      question: "Dove inviamo il tuo accesso anticipato?",
      placeholder: "tu@email.com",
      cta: "Ottieni l'accesso anticipato",
      errorInvalid: "Inserisci un indirizzo email valido.",
    },
    success: {
      headline: "Sei in lista!",
      body: "Ti scriveremo appena FuelCap apre nella tua zona. Testa vinci tu, croce vinci tu.",
      done: "Fatto",
    },
  },
};

export default it;
