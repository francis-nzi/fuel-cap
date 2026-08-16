export type LanguageCode = "en" | "fr" | "de" | "es" | "it";

export type MarketId =
  | "usa"
  | "canada"
  | "uk"
  | "france"
  | "germany"
  | "spain"
  | "italy"
  | "austria"
  | "australia";

export type MarketState = {
  id: string;
  name: string;
  dataSource: string;
  stationCount: string;
};

export type Market = {
  id: MarketId;
  slug: string;
  name: string;
  flag: string;
  language: LanguageCode;
  locale: string;
  currency: string;
  currencySymbol: string;
  /** Only the UK mixes systems in practice: miles for distance, litres at the pump. */
  distanceUnit: "mi" | "km";
  volumeUnit: "L" | "gal";
  fuelWord: string;
  dataSource: string;
  stationCount: string;
  postalPlaceholder: string;
  /** RegExp source string (not a RegExp instance, so this stays serializable). */
  postalPattern: string;
  /** Illustrative, locale-formatted example amounts used in marketing copy — not live prices. */
  sampleRefundAmount: string;
  sampleHighPrice: string;
  states?: MarketState[];
};

export const MARKETS: Record<MarketId, Market> = {
  usa: {
    id: "usa",
    slug: "usa",
    name: "United States",
    flag: "🇺🇸",
    language: "en",
    locale: "en-US",
    currency: "USD",
    currencySymbol: "$",
    distanceUnit: "mi",
    volumeUnit: "gal",
    fuelWord: "gas",
    dataSource: "U.S. Energy Information Administration (EIA)",
    stationCount: "~145,000",
    postalPlaceholder: "10001",
    postalPattern: "^\\d{5}(?:-\\d{4})?$",
    sampleRefundAmount: "$6.20",
    sampleHighPrice: "$3.85",
  },
  canada: {
    id: "canada",
    slug: "canada",
    name: "Canada",
    flag: "🇨🇦",
    language: "en",
    locale: "en-CA",
    currency: "CAD",
    currencySymbol: "C$",
    distanceUnit: "km",
    volumeUnit: "L",
    fuelWord: "gas",
    dataSource: "Natural Resources Canada (NRCan)",
    stationCount: "~12,000",
    postalPlaceholder: "M5V 3A8",
    postalPattern: "^[ABCEGHJ-NPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z][ -]?\\d[ABCEGHJ-NPRSTV-Z]\\d$",
    sampleRefundAmount: "C$7.40",
    sampleHighPrice: "C$1.75",
  },
  uk: {
    id: "uk",
    slug: "uk",
    name: "United Kingdom",
    flag: "🇬🇧",
    language: "en",
    locale: "en-GB",
    currency: "GBP",
    currencySymbol: "£",
    distanceUnit: "mi",
    volumeUnit: "L",
    fuelWord: "petrol",
    dataSource: "GOV.UK Fuel Finder Scheme Portal",
    stationCount: "~8,300",
    postalPlaceholder: "SW1A 1AA",
    postalPattern: "^[A-Za-z]{1,2}\\d[A-Za-z\\d]?\\s?\\d[A-Za-z]{2}$",
    sampleRefundAmount: "£5.20",
    sampleHighPrice: "£1.65",
  },
  france: {
    id: "france",
    slug: "france",
    name: "France",
    flag: "🇫🇷",
    language: "fr",
    locale: "fr-FR",
    currency: "EUR",
    currencySymbol: "€",
    distanceUnit: "km",
    volumeUnit: "L",
    fuelWord: "essence",
    dataSource: "Ministère de l'Économie (data.gouv.fr)",
    stationCount: "~11,000",
    postalPlaceholder: "75001",
    postalPattern: "^\\d{5}$",
    sampleRefundAmount: "5,80 €",
    sampleHighPrice: "1,85 €",
  },
  germany: {
    id: "germany",
    slug: "germany",
    name: "Germany",
    flag: "🇩🇪",
    language: "de",
    locale: "de-DE",
    currency: "EUR",
    currencySymbol: "€",
    distanceUnit: "km",
    volumeUnit: "L",
    fuelWord: "Sprit",
    dataSource: "Bundeskartellamt (MTS-K Unit)",
    stationCount: "~14,500",
    postalPlaceholder: "10115",
    postalPattern: "^\\d{5}$",
    sampleRefundAmount: "6,10 €",
    sampleHighPrice: "1,90 €",
  },
  spain: {
    id: "spain",
    slug: "spain",
    name: "Spain",
    flag: "🇪🇸",
    language: "es",
    locale: "es-ES",
    currency: "EUR",
    currencySymbol: "€",
    distanceUnit: "km",
    volumeUnit: "L",
    fuelWord: "gasolina",
    dataSource: "Ministerio para la Transición Ecológica (Geoportal)",
    stationCount: "~11,500",
    postalPlaceholder: "28001",
    postalPattern: "^\\d{5}$",
    sampleRefundAmount: "5,40 €",
    sampleHighPrice: "1,70 €",
  },
  italy: {
    id: "italy",
    slug: "italy",
    name: "Italy",
    flag: "🇮🇹",
    language: "it",
    locale: "it-IT",
    currency: "EUR",
    currencySymbol: "€",
    distanceUnit: "km",
    volumeUnit: "L",
    fuelWord: "benzina",
    dataSource: "Osservaprezzi Carburanti (MIMIT)",
    stationCount: "~22,000",
    postalPlaceholder: "00100",
    postalPattern: "^\\d{5}$",
    sampleRefundAmount: "6,50 €",
    sampleHighPrice: "1,95 €",
  },
  austria: {
    id: "austria",
    slug: "austria",
    name: "Austria",
    flag: "🇦🇹",
    language: "de",
    locale: "de-AT",
    currency: "EUR",
    currencySymbol: "€",
    distanceUnit: "km",
    volumeUnit: "L",
    fuelWord: "Sprit",
    dataSource: "E-Control Spritpreisrechner API",
    stationCount: "~2,700",
    postalPlaceholder: "1010",
    postalPattern: "^\\d{4}$",
    sampleRefundAmount: "5,90 €",
    sampleHighPrice: "1,85 €",
  },
  australia: {
    id: "australia",
    slug: "australia",
    name: "Australia",
    flag: "🇦🇺",
    language: "en",
    locale: "en-AU",
    currency: "AUD",
    currencySymbol: "A$",
    distanceUnit: "km",
    volumeUnit: "L",
    fuelWord: "petrol",
    dataSource: "State government open data (see states)",
    stationCount: "~5,000",
    postalPlaceholder: "2000",
    postalPattern: "^\\d{4}$",
    sampleRefundAmount: "A$7.10",
    sampleHighPrice: "A$2.10",
    states: [
      {
        id: "nsw",
        name: "New South Wales",
        dataSource: "NSW Government FuelCheck Developer Portal",
        stationCount: "~2,500",
      },
      {
        id: "qld",
        name: "Queensland",
        dataSource: "Queensland Department of Transport Open Data",
        stationCount: "~1,500",
      },
      {
        id: "wa",
        name: "Western Australia",
        dataSource: "WA Consumer Protection (FuelWatch API)",
        stationCount: "~1,000",
      },
    ],
  },
};

export const MARKET_LIST: Market[] = Object.values(MARKETS);

export function isMarketId(value: string): value is MarketId {
  return value in MARKETS;
}

export function getMarket(id: string): Market | undefined {
  return isMarketId(id) ? MARKETS[id] : undefined;
}

/** Best-effort Accept-Language → market match, used by the root gateway redirect. */
export function detectMarketFromAcceptLanguage(acceptLanguage: string | null): MarketId {
  if (!acceptLanguage) return "uk";
  const lower = acceptLanguage.toLowerCase();

  if (lower.includes("en-ca") || lower.includes("fr-ca")) return "canada";
  if (lower.includes("en-us")) return "usa";
  if (lower.includes("en-au")) return "australia";
  if (lower.includes("de-at")) return "austria";
  if (lower.includes("fr")) return "france";
  if (lower.includes("de")) return "germany";
  if (lower.includes("es")) return "spain";
  if (lower.includes("it")) return "italy";
  if (lower.includes("en-gb") || lower.includes("en")) return "uk";

  return "uk";
}
