export type MarketCode = "US" | "CA" | "GB";

export type Market = {
  code: MarketCode;
  name: string;
  currency: "USD" | "CAD" | "GBP";
  locale: string;
  unit: "gal" | "L";
  fuelWord: "gas" | "fuel";
  livePrice: number;
  lockedPrice: number;
  defaultVolume: number;
  maxVolume: number;
};

export const markets: Record<MarketCode, Market> = {
  US: {
    code: "US", name: "United States", currency: "USD", locale: "en-US",
    unit: "gal", fuelWord: "gas", livePrice: 3.87, lockedPrice: 3.42,
    defaultVolume: 45, maxVolume: 80,
  },
  CA: {
    code: "CA", name: "Canada", currency: "CAD", locale: "en-CA",
    unit: "L", fuelWord: "gas", livePrice: 1.71, lockedPrice: 1.63,
    defaultVolume: 160, maxVolume: 300,
  },
  GB: {
    code: "GB", name: "United Kingdom", currency: "GBP", locale: "en-GB",
    unit: "L", fuelWord: "fuel", livePrice: 1.49, lockedPrice: 1.42,
    defaultVolume: 160, maxVolume: 300,
  },
};

export function money(value: number, market: Market, digits = 2) {
  return new Intl.NumberFormat(market.locale, {
    style: "currency",
    currency: market.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
