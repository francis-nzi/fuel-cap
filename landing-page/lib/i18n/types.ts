export type Dictionary = {
  hero: {
    badge: string;
    headlineLine1: string;
    headlineLine2: string;
    subhead: string;
    priceRisesLabel: string;
    priceFallsLabel: string;
    youWin: string;
    tagline: string;
    cta: string;
    ctaSub: string;
  };
  viral: {
    eyebrow: string;
    headline: string;
    feature1Eyebrow: string;
    feature1Headline: string;
    feature1Quote: string;
    feature1Body: string;
    feature2Eyebrow: string;
    feature2Headline: string;
    feature2Quote: string;
    feature2Body: string;
    feature3Eyebrow: string;
    feature3Headline: string;
    feature3Quote: string;
    feature3Body: string;
    cta: string;
  };
  how: {
    eyebrow: string;
    headline: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
  };
  guarantee: {
    headline: string;
    item1Label: string;
    item1Detail: string;
    item2Label: string;
    item2Detail: string;
    item3Label: string;
    item3Detail: string;
    builtFor: string;
    audience1: string;
    audience2: string;
    audience3: string;
  };
  finalCta: {
    headlineLine1: string;
    headlineLine2: string;
    body: string;
    cta: string;
  };
  footer: {
    tagline: string;
    disclaimer: string;
    changeMarket: string;
  };
  stickyCta: string;
  signup: {
    backAria: string;
    noFeesLine: string;
    country: {
      eyebrow: string;
      question: string;
      options: Record<
        | "usa"
        | "canada"
        | "uk"
        | "france"
        | "germany"
        | "spain"
        | "italy"
        | "austria"
        | "australia",
        string
      >;
    };
    state: {
      eyebrow: string;
      question: string;
      options: Record<"nsw" | "qld" | "wa", string>;
    };
    gender: {
      eyebrow: string;
      question: string;
      options: { male: string; female: string; unspecified: string };
    };
    ageRange: {
      eyebrow: string;
      question: string;
      options: Record<"18-24" | "25-34" | "35-44" | "45-54" | "55-plus", string>;
    };
    driverType: {
      eyebrow: string;
      question: string;
      options: Record<"commuter" | "rideshare-delivery" | "parent" | "other", string>;
    };
    fillFrequency: {
      eyebrow: string;
      question: string;
      options: Record<"1-2" | "3-4" | "5-8" | "9-plus", string>;
    };
    postal: {
      eyebrow: string;
      question: string;
      cta: string;
      errorInvalid: string;
    };
    email: {
      eyebrow: string;
      question: string;
      placeholder: string;
      cta: string;
      errorInvalid: string;
    };
    success: {
      headline: string;
      body: string;
      done: string;
    };
  };
};
