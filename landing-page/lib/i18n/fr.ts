import type { Dictionary } from "./types";

const fr: Dictionary = {
  hero: {
    badge: "L'accès anticipé est ouvert",
    headlineLine1: "Plafonnez votre prix.",
    headlineLine2: "Ne payez jamais trop cher.",
    subhead:
      "Bloquez le prix de l'{fuelWord} d'aujourd'hui. Si le prix à la pompe passe sous votre prix bloqué, FuelCap vous rembourse automatiquement la différence — directement dans votre réservoir.",
    priceRisesLabel: "Le prix monte",
    priceFallsLabel: "Le prix baisse",
    youWin: "Vous gagnez",
    tagline: "Pile vous gagnez. Face vous gagnez.",
    cta: "Rejoindre l'accès anticipé",
    ctaSub: "Sans frais. Sans engagement. 30 secondes.",
  },
  viral: {
    eyebrow: "Fait pour être partagé",
    headline: "Trois moments que tout le monde a envie de partager",
    feature1Eyebrow: "Le moment viral",
    feature1Headline: "Dès que le prix baisse, vous êtes remboursé.",
    feature1Quote: "« L'essence a baissé. J'ai récupéré {refundAmount}. »",
    feature1Body:
      "Une célébration plein écran s'affiche dès que le prix à la pompe passe sous votre prix bloqué. Une vraie surprise que les gens capturent et partagent — pas un bon de réduction, un vrai remboursement.",
    feature2Eyebrow: "Le flex",
    feature2Headline: "Transformez vos économies en statut public.",
    feature2Quote: "« Je n'ai pas payé le plein tarif de l'essence depuis 6 mois. »",
    feature2Body:
      "Une carte de score prête à publier suit l'argent économisé et votre série sans plein tarif — un tap pour la partager en story, en reel ou sur TikTok.",
    feature3Eyebrow: "La boucle de croissance",
    feature3Headline: "Votre bande. De l'essence moins chère pour tout le monde.",
    feature3Quote:
      "« J'ai mis tout mon groupe WhatsApp là-dessus pour lutter contre l'essence à {highPrice}. »",
    feature3Body:
      "Chaque ami qui rejoint fait encore baisser votre prix bloqué au litre — partager, c'est dans votre intérêt, pas un service rendu.",
    cta: "Je veux en être",
  },
  how: {
    eyebrow: "Comment ça marche",
    headline: "Trois taps. Aucun inconvénient.",
    step1Title: "Bloquez un prix",
    step1Body:
      "Choisissez un carburant et un nombre de litres. Votre prix est bloqué au tarif du jour, sans frais.",
    step2Title: "Restez protégé",
    step2Body:
      "Le prix monte ? Vous payez toujours votre prix bloqué. Le prix baisse ? Vous êtes remboursé automatiquement de la différence.",
    step3Title: "Utilisez-le partout",
    step3Body:
      "Payez depuis votre réservoir virtuel avec un QR code dans n'importe quelle station partenaire — sans dépendre d'une seule enseigne.",
  },
  guarantee: {
    headline: "La garantie FuelCap",
    item1Label: "Le prix monte",
    item1Detail: "Vous payez toujours votre prix bloqué.",
    item2Label: "Le prix baisse",
    item2Detail: "Vous êtes remboursé automatiquement.",
    item3Label: "Vous changez d'avis",
    item3Detail: "Sans frais. Annulez et récupérez votre argent à tout moment.",
    builtFor: "Conçu pour",
    audience1: "Les trajets domicile-travail quotidiens",
    audience2: "Les chauffeurs VTC et livreurs",
    audience3: "Les familles qui roulent beaucoup",
  },
  finalCta: {
    headlineLine1: "Pile vous gagnez.",
    headlineLine2: "Face vous gagnez.",
    body: "Rejoignez l'accès anticipé et bloquez votre premier litre dès notre lancement dans votre région.",
    cta: "Rejoindre l'accès anticipé",
  },
  footer: {
    tagline: "Plafonnez votre prix. Ne payez jamais trop cher.",
    disclaimer:
      "FuelCap est en accès anticipé. Nous construisons le réseau de stations avant le lancement général — inscrivez-vous pour être parmi les premiers informés du lancement dans votre région.",
    changeMarket: "Vous n'êtes pas dans ce pays ?",
  },
  stickyCta: "Rejoindre l'accès anticipé — 30 secondes",
  signup: {
    backAria: "Retour",
    noFeesLine: "Pas de spam. Pas de frais. Annulez à tout moment.",
    country: {
      eyebrow: "D'abord, l'essentiel",
      question: "Où habitez-vous ?",
      options: {
        usa: "États-Unis",
        canada: "Canada",
        uk: "Royaume-Uni",
        france: "France",
        germany: "Allemagne",
        spain: "Espagne",
        italy: "Italie",
        austria: "Autriche",
        australia: "Australie",
      },
    },
    state: {
      eyebrow: "On y est presque",
      question: "Quel état ?",
      options: {
        nsw: "Nouvelle-Galles du Sud",
        qld: "Queensland",
        wa: "Australie-Occidentale",
      },
    },
    gender: {
      eyebrow: "Une question rapide pour commencer",
      question: "Vous êtes...",
      options: { male: "Un homme", female: "Une femme", unspecified: "Je préfère ne pas répondre" },
    },
    ageRange: {
      eyebrow: "Presque rien à faire",
      question: "Quelle est votre tranche d'âge ?",
      options: {
        "18-24": "18–24",
        "25-34": "25–34",
        "35-44": "35–44",
        "45-54": "45–54",
        "55-plus": "55+",
      },
    },
    driverType: {
      eyebrow: "Faisons connaissance",
      question: "Qu'est-ce qui vous décrit le mieux ?",
      options: {
        commuter: "Trajet domicile-travail quotidien",
        "rideshare-delivery": "Chauffeur VTC / livreur",
        parent: "Parent qui roule beaucoup",
        other: "Autre chose",
      },
    },
    fillFrequency: {
      eyebrow: "Dernier choix multiple, promis",
      question: "À quelle fréquence faites-vous le plein ?",
      options: {
        "1-2": "1 à 2 fois / mois",
        "3-4": "3 à 4 fois / mois",
        "5-8": "5 à 8 fois / mois",
        "9-plus": "9 fois ou plus / mois",
      },
    },
    postal: {
      eyebrow: "Pour savoir où nous lancer en premier",
      question: "Quel est votre code postal ?",
      cta: "Continuer",
      errorInvalid: "Entrez un code postal valide.",
    },
    email: {
      eyebrow: "Dernière étape — vous y êtes",
      question: "Où devons-nous envoyer votre accès anticipé ?",
      placeholder: "vous@email.com",
      cta: "Rejoindre l'accès anticipé",
      errorInvalid: "Entrez une adresse e-mail valide.",
    },
    success: {
      headline: "Vous êtes sur la liste !",
      body: "Nous vous enverrons un e-mail dès que FuelCap ouvre dans votre région. Pile vous gagnez, face vous gagnez.",
      done: "Terminé",
    },
  },
};

export default fr;
