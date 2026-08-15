import type { Dictionary } from "./types";

const en: Dictionary = {
  hero: {
    badge: "Early access is open",
    headlineLine1: "Cap your price.",
    headlineLine2: "Never overpay.",
    subhead:
      "Lock today's {fuelWord} price. If the pump falls below your lock, FuelCap auto-refunds the difference — straight into your tank.",
    priceRisesLabel: "Price rises",
    priceFallsLabel: "Price falls",
    youWin: "You win",
    tagline: "Heads you win. Tails you win.",
    cta: "Get early access",
    ctaSub: "No fees. No commitment. Takes 30 seconds.",
  },
  viral: {
    eyebrow: "Built to travel",
    headline: "Three moments people can't help but share",
    feature1Eyebrow: "The viral moment",
    feature1Headline: "The moment {fuelWord} drops, you get paid.",
    feature1Quote: "“{FuelWord} dropped. I got {refundAmount} back.”",
    feature1Body:
      "A full-screen celebration fires the instant the pump falls below your lock. It's a genuine surprise people screenshot and post — not a coupon, an actual refund.",
    feature2Eyebrow: "The brag",
    feature2Headline: "Turn private savings into public status.",
    feature2Quote: "“I haven't paid full price for {fuelWord} in 6 months.”",
    feature2Body:
      "A ready-to-post scorecard tracks money saved and your no-full-price streak — one tap to Stories, Reels, or TikTok.",
    feature3Eyebrow: "The growth loop",
    feature3Headline: "Your squad. Cheaper {fuelWord} for everyone.",
    feature3Quote: "“Get my whole group chat on this to fight {highPrice} {fuelWord}.”",
    feature3Body:
      "Every friend who joins drops your locked price a little more per litre — sharing is self-interested, not a favour.",
    cta: "I want in",
  },
  how: {
    eyebrow: "How it works",
    headline: "Three taps. Zero downside.",
    step1Title: "Lock a price",
    step1Body: "Pick a fuel grade and how many litres. Your price is locked at today's rate, no fees.",
    step2Title: "Stay protected",
    step2Body:
      "Pump goes up? You still pay your locked price. Pump drops? You're auto-refunded the difference.",
    step3Title: "Redeem anywhere",
    step3Body:
      "Pay from your virtual tank with a QR code at any partner station — no single brand lock-in.",
  },
  guarantee: {
    headline: "The FuelCap guarantee",
    item1Label: "Pump rises",
    item1Detail: "You still pay your locked price.",
    item2Label: "Pump drops",
    item2Detail: "You're auto-refunded, automatically.",
    item3Label: "Change your mind",
    item3Detail: "No fees. Cancel & cash out anytime.",
    builtFor: "Built for",
    audience1: "Daily commuters",
    audience2: "Rideshare & delivery drivers",
    audience3: "Families who drive a lot",
  },
  finalCta: {
    headlineLine1: "Heads you win.",
    headlineLine2: "Tails you win.",
    body: "Join early access and lock your first litre the day we launch in your area.",
    cta: "Get early access",
  },
  footer: {
    tagline: "Cap your price. Never overpay.",
    disclaimer:
      "FuelCap is in early access. We're building the station network before general availability — join the waitlist to be first in line when we launch in your area.",
    changeMarket: "Not in this country?",
  },
  stickyCta: "Get early access — takes 30s",
  signup: {
    backAria: "Back",
    noFeesLine: "No spam. No fees. Cancel anytime.",
    country: {
      eyebrow: "First, the basics",
      question: "Where are you based?",
      options: {
        uk: "United Kingdom",
        france: "France",
        germany: "Germany",
        spain: "Spain",
        italy: "Italy",
        austria: "Austria",
        australia: "Australia",
      },
    },
    state: {
      eyebrow: "Just about there",
      question: "Which state?",
      options: { nsw: "New South Wales", qld: "Queensland", wa: "Western Australia" },
    },
    gender: {
      eyebrow: "Quick one to start",
      question: "Are you...",
      options: { male: "Male", female: "Female", unspecified: "Prefer not to say" },
    },
    ageRange: {
      eyebrow: "Almost nothing to it",
      question: "What's your age range?",
      options: {
        "18-24": "18–24",
        "25-34": "25–34",
        "35-44": "35–44",
        "45-54": "45–54",
        "55-plus": "55+",
      },
    },
    driverType: {
      eyebrow: "Getting to know you",
      question: "Which best describes you?",
      options: {
        commuter: "Daily commuter",
        "rideshare-delivery": "Rideshare / delivery driver",
        parent: "Parent who drives a lot",
        other: "Something else",
      },
    },
    fillFrequency: {
      eyebrow: "Last multiple choice, promise",
      question: "How often do you fill up?",
      options: {
        "1-2": "1–2x / month",
        "3-4": "3–4x / month",
        "5-8": "5–8x / month",
        "9-plus": "9+ / month",
      },
    },
    postal: {
      eyebrow: "So we know where to launch first",
      question: "What's your postcode?",
      cta: "Continue",
      errorInvalid: "Enter a valid postcode.",
    },
    email: {
      eyebrow: "Last step — you're in",
      question: "Where should we send your early access?",
      placeholder: "you@email.com",
      cta: "Get early access",
      errorInvalid: "Enter a valid email address.",
    },
    success: {
      headline: "You're on the list!",
      body: "We'll email you the moment FuelCap opens in your area. Heads you win, tails you win.",
      done: "Done",
    },
  },
};

export default en;
