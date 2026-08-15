import type { LanguageCode } from "./markets";

/**
 * Site chrome (top-nav + footer) labels, kept separate from the strict funnel
 * `Dictionary` so the marketing shell can grow without touching every screen's
 * copy. Nav/footer link labels are fully localized; long-form page bodies live
 * in `site-content.ts` (English, market-aware) for now.
 */
export type SiteChrome = {
  nav: {
    howItWorks: string;
    pricing: string;
    faq: string;
    about: string;
    cta: string;
    openMenu: string;
    closeMenu: string;
  };
  footer: {
    product: string;
    company: string;
    legalHeading: string;
    linkHome: string;
    linkHowItWorks: string;
    linkPricing: string;
    linkFaq: string;
    linkAbout: string;
    linkContact: string;
    linkPrivacy: string;
    linkTerms: string;
    rights: string;
    trademark: string;
  };
};

const en: SiteChrome = {
  nav: {
    howItWorks: "How it works",
    pricing: "Pricing",
    faq: "FAQ",
    about: "About",
    cta: "Get early access",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  footer: {
    product: "Product",
    company: "Company",
    legalHeading: "Legal",
    linkHome: "Home",
    linkHowItWorks: "How it works",
    linkPricing: "Pricing",
    linkFaq: "FAQ",
    linkAbout: "About",
    linkContact: "Contact",
    linkPrivacy: "Privacy",
    linkTerms: "Terms",
    rights: "All rights reserved.",
    trademark: "FuelCap™ and the FuelCap roundel are trademarks of FuelCap.",
  },
};

const fr: SiteChrome = {
  nav: {
    howItWorks: "Comment ça marche",
    pricing: "Tarifs",
    faq: "FAQ",
    about: "À propos",
    cta: "Accès anticipé",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },
  footer: {
    product: "Produit",
    company: "Entreprise",
    legalHeading: "Mentions légales",
    linkHome: "Accueil",
    linkHowItWorks: "Comment ça marche",
    linkPricing: "Tarifs",
    linkFaq: "FAQ",
    linkAbout: "À propos",
    linkContact: "Contact",
    linkPrivacy: "Confidentialité",
    linkTerms: "Conditions",
    rights: "Tous droits réservés.",
    trademark: "FuelCap™ et le logo FuelCap sont des marques de FuelCap.",
  },
};

const de: SiteChrome = {
  nav: {
    howItWorks: "So funktioniert's",
    pricing: "Preise",
    faq: "FAQ",
    about: "Über uns",
    cta: "Früher Zugang",
    openMenu: "Menü öffnen",
    closeMenu: "Menü schließen",
  },
  footer: {
    product: "Produkt",
    company: "Unternehmen",
    legalHeading: "Rechtliches",
    linkHome: "Startseite",
    linkHowItWorks: "So funktioniert's",
    linkPricing: "Preise",
    linkFaq: "FAQ",
    linkAbout: "Über uns",
    linkContact: "Kontakt",
    linkPrivacy: "Datenschutz",
    linkTerms: "AGB",
    rights: "Alle Rechte vorbehalten.",
    trademark: "FuelCap™ und das FuelCap-Logo sind Marken von FuelCap.",
  },
};

const es: SiteChrome = {
  nav: {
    howItWorks: "Cómo funciona",
    pricing: "Precios",
    faq: "Preguntas",
    about: "Nosotros",
    cta: "Acceso anticipado",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
  },
  footer: {
    product: "Producto",
    company: "Empresa",
    legalHeading: "Legal",
    linkHome: "Inicio",
    linkHowItWorks: "Cómo funciona",
    linkPricing: "Precios",
    linkFaq: "Preguntas",
    linkAbout: "Nosotros",
    linkContact: "Contacto",
    linkPrivacy: "Privacidad",
    linkTerms: "Términos",
    rights: "Todos los derechos reservados.",
    trademark: "FuelCap™ y el logotipo de FuelCap son marcas de FuelCap.",
  },
};

const it: SiteChrome = {
  nav: {
    howItWorks: "Come funziona",
    pricing: "Prezzi",
    faq: "FAQ",
    about: "Chi siamo",
    cta: "Accesso anticipato",
    openMenu: "Apri menu",
    closeMenu: "Chiudi menu",
  },
  footer: {
    product: "Prodotto",
    company: "Azienda",
    legalHeading: "Note legali",
    linkHome: "Home",
    linkHowItWorks: "Come funziona",
    linkPricing: "Prezzi",
    linkFaq: "FAQ",
    linkAbout: "Chi siamo",
    linkContact: "Contatti",
    linkPrivacy: "Privacy",
    linkTerms: "Termini",
    rights: "Tutti i diritti riservati.",
    trademark: "FuelCap™ e il logo FuelCap sono marchi di FuelCap.",
  },
};

const CHROME: Record<LanguageCode, SiteChrome> = { en, fr, de, es, it };

export function getSiteChrome(language: LanguageCode): SiteChrome {
  return CHROME[language] ?? CHROME.en;
}
