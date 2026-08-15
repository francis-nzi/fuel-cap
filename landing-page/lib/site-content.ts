import type { Market } from "./markets";

/**
 * Marketing-page content for the secondary pages (how-it-works, pricing, faq,
 * about, contact, legal). English, but market-aware where it matters (fuel
 * word, currency, station data source/count). The localized funnel + home copy
 * still comes from the per-language `Dictionary`.
 *
 * Nothing here is a live price or an offer — all figures are illustrative and
 * labelled as such, consistent with the product spec and the site footer.
 */

export type Step = { title: string; body: string };
export type Faq = { q: string; a: string };
export type PlanFeature = { label: string; included: boolean };
export type Plan = {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: PlanFeature[];
  highlighted?: boolean;
};

export function howItWorks(market: Market): {
  intro: string;
  steps: Step[];
  outcomes: { label: string; detail: string; tone: "rise" | "fall" | "flat" }[];
} {
  const fuel = market.fuelWord;
  return {
    intro: `FuelCap turns a locked ${fuel} price into a one-way bet in your favour. You fix today's price on the ${market.volumeUnit === "gal" ? "gallons" : "litres"} you plan to buy, then the market can only help you: if the pump rises you keep your lock, and if it falls below your lock you're refunded the difference.`,
    steps: [
      {
        title: "1 · Lock a price",
        body: `Choose a fuel grade and how much you plan to buy. FuelCap fixes the price at today's reference rate for your area — no consumer fees, no commitment.`,
      },
      {
        title: "2 · Stay protected both ways",
        body: `If the pump price rises above your lock, you still pay the locked price. If it falls below your lock, FuelCap automatically refunds the difference into your virtual tank. Heads you win, tails you win.`,
      },
      {
        title: "3 · Redeem at the pump",
        body: `Pay from your virtual tank with a QR code at any partner station. No single-brand lock-in, and your protection travels with you.`,
      },
    ],
    outcomes: [
      { label: "Pump rises", detail: "You still pay your locked price.", tone: "rise" },
      { label: "Pump falls", detail: `You're auto-refunded the difference — e.g. ${market.sampleRefundAmount} back on a typical fill.`, tone: "fall" },
      { label: "Pump flat", detail: "No change — you keep your certainty at no downside.", tone: "flat" },
    ],
  };
}

export function pricing(market: Market): { intro: string; plans: Plan[]; note: string } {
  const c = market.currencySymbol;
  // Illustrative FuelCap+ price, locale-formatted from the USD ~$3.99 anchor.
  const plusPrice =
    market.currency === "EUR"
      ? `${c}3,99`
      : market.currency === "GBP"
        ? `${c}3.49`
        : market.currency === "AUD"
          ? `${c}5.99`
          : `${c}3.99`;
  return {
    intro:
      "Using FuelCap costs drivers nothing. There are no consumer fees to lock, redeem, or get refunded — the business is funded in the mechanics, not on your back. FuelCap+ is an optional upgrade for heavy drivers.",
    plans: [
      {
        name: "FuelCap",
        price: c + "0",
        cadence: "forever",
        tagline: "Everything you need to cap your price.",
        features: [
          { label: "Lock today's price, no fees", included: true },
          { label: "Auto-refund when the pump drops", included: true },
          { label: "Redeem at any partner station", included: true },
          { label: "Share-ready savings scorecard", included: true },
          { label: "Larger caps & Auto-Cap", included: false },
          { label: "Family tank & priority alerts", included: false },
        ],
      },
      {
        name: "FuelCap+",
        price: plusPrice,
        cadence: "per month",
        tagline: "For commuters, drivers and families who fill up often.",
        highlighted: true,
        features: [
          { label: "Everything in FuelCap", included: true },
          { label: "Zero certainty spread on your lock", included: true },
          { label: "Larger caps & Auto-Cap", included: true },
          { label: "Family tank (share with the household)", included: true },
          { label: "Priority price alerts", included: true },
          { label: "Early access to new markets", included: true },
        ],
      },
    ],
    note: `Prices shown are illustrative and not yet an offer. FuelCap is in early access and not currently taking payment. Amounts are indicative in ${market.currency}.`,
  };
}

export function faqs(market: Market): Faq[] {
  const fuel = market.fuelWord;
  return [
    {
      q: `Is this too good to be true — how can ${fuel} protection be free?`,
      a: `FuelCap doesn't charge drivers to lock, redeem or get refunded. The business earns a small, direction-agnostic spread built into the locked price, plus float, wallet interchange and an optional subscription. Your safety net is funded from those mechanics and a hedged risk pool — not from a fee to you.`,
    },
    {
      q: "What happens if the pump price goes up after I lock?",
      a: "You still pay your locked price. That's the whole point of a cap — the ceiling protects you from rises.",
    },
    {
      q: "And if the price goes down?",
      a: `You're not stuck at the higher locked price. FuelCap automatically refunds the difference into your virtual tank, so you effectively get the lower price. That auto-refund is what removes the usual risk of prepaying for fuel.`,
    },
    {
      q: "Where do the prices come from?",
      a: `Every lock and refund settles against an authoritative reference price. In your market that's ${market.dataSource} (${market.stationCount} stations), captured at a defined snapshot and audit-logged.`,
    },
    {
      q: "Which stations can I use?",
      a: "FuelCap is designed to work across a network of partner stations rather than a single brand, so your protection isn't tied to one forecourt. Coverage grows through early access — the waitlist tells us where to launch first.",
    },
    {
      q: "Is FuelCap available now?",
      a: `Not yet. We're in early access and building the station network market by market. Join the waitlist and we'll email you the moment FuelCap opens in your area.`,
    },
    {
      q: "Is this a financial product or a way to speculate on fuel?",
      a: "No. FuelCap is prepaid fuel with a price guarantee for your own use — not a tradable instrument. You can't buy more protection than fuel you actually intend to use, and you can cancel and cash out your balance.",
    },
    {
      q: "Can I get my money back?",
      a: "Yes. Your prepaid balance is yours. There are no fees to cancel, and you can cash out your virtual tank at any time.",
    },
  ];
}

export function about(): {
  lead: string;
  story: string[];
  founder: {
    name: string;
    role: string;
    linkedin: string;
    bio: string[];
  };
} {
  return {
    lead: "FuelCap exists to give drivers something the fuel market never has: certainty, with no downside.",
    story: [
      "Fuel is one of the most frequent, most visible and most volatile costs in a household budget, yet drivers have almost no way to manage it. You can prepay — but then you're exposed if prices fall. You can wait — but then you're exposed if they rise. FuelCap removes both risks at once.",
      "The wedge is the safety net. Lock today's price, and if the pump falls below your lock we refund the difference automatically. That single mechanic turns prepaying from a gamble into a one-way bet in the driver's favour — and creates genuine “you got money back” moments worth sharing.",
      "Behind the simple app is a serious piece of financial engineering: a hedged, reinsured risk pool that funds the caps, priced with the same option maths used in commodity markets. It's built to be honest about the risks and disciplined about how the protection is funded.",
    ],
    founder: {
      name: "Francis Doherty",
      role: "Founder",
      linkedin: "https://www.linkedin.com/in/francis-doherty-34794322/",
      bio: [
        "FuelCap is the concept and work of Francis Doherty, a serial entrepreneur whose career sits where payments, technology and company-building meet.",
        "As a founder-member of Transguard Group in the UAE — a high-growth cash-management business — he built new cash-management and bullion-trading transaction systems across the MENA region. His doctoral research developed an early platform uniting payment processing, logistics and fulfilment: the same embedded-transaction thinking behind FuelCap.",
        "A 1st-Class Business Information Systems graduate who has founded or co-founded several companies (CCU International, Net Zero International, Bio Technical), he has repeatedly built the investment-grade models and plans used to raise capital, and brings a decade of financial-risk and restructuring experience from corporate recovery at Grant Thornton — directly relevant to FuelCap's risk-led design.",
      ],
    },
  };
}
