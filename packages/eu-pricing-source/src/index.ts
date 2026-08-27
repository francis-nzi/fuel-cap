export const EU_PRICING_SOURCE_CONTRACT_VERSION = "eu-pricing-source@0.1.0" as const;
export const EU_COUNTRIES = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"] as const;
export type EuCountryCode = typeof EU_COUNTRIES[number];
export type EuCurrency = "EUR" | "CZK" | "DKK" | "HUF" | "PLN" | "RON" | "SEK";
export type EuBulletinProduct = "PETROL_95" | "ROAD_DIESEL";
export type TaxBasis = "WITH_TAXES" | "WITHOUT_TAXES";
export type PricePresentation = "NATIONAL" | "EUR";
export type EuReleaseQualityCode = "SCHEMA_DRIFT" | "HASH_INVALID" | "COUNTRY_COVERAGE" | "DUPLICATE_ROW" | "VALUE_INVALID" | "TIMESTAMP_INVALID" | "FUTURE_RELEASE" | "STALE" | "CORRECTION_INVALID";

export const EU_CURRENCY_BY_COUNTRY: Readonly<Record<EuCountryCode, EuCurrency>> = {
  AT:"EUR",BE:"EUR",BG:"EUR",HR:"EUR",CY:"EUR",CZ:"CZK",DK:"DKK",EE:"EUR",FI:"EUR",FR:"EUR",DE:"EUR",GR:"EUR",HU:"HUF",IE:"EUR",IT:"EUR",LV:"EUR",LT:"EUR",LU:"EUR",MT:"EUR",NL:"EUR",PL:"PLN",PT:"EUR",RO:"RON",SK:"EUR",SI:"EUR",ES:"EUR",SE:"SEK",
};
export const REQUIRED_HEADERS = ["country","product","taxBasis","nationalCurrency","nationalPricePer1000LMinor4","eurPricePer1000LMinor4"] as const;

export interface SyntheticBulletinRow { readonly country: EuCountryCode; readonly product: EuBulletinProduct; readonly taxBasis: TaxBasis; readonly nationalCurrency: EuCurrency; readonly nationalPricePer1000LMinor4: number; readonly eurPricePer1000LMinor4: number; }
export interface SyntheticBulletinWorkbook { readonly fixture: true; readonly source: "EU_WEEKLY_OIL_BULLETIN"; readonly schemaVersion: typeof EU_PRICING_SOURCE_CONTRACT_VERSION; readonly fileName: string; readonly fileHash: `sha256:${string}`; readonly effectiveDate: string; readonly publishedAt: string; readonly headers: readonly string[]; readonly rows: readonly SyntheticBulletinRow[]; readonly supersedesFileHash: `sha256:${string}` | null; }
export interface EuWeeklyBenchmarkObservation { readonly observationId: string; readonly country: EuCountryCode; readonly geographicScope: "COUNTRY"; readonly product: EuBulletinProduct; readonly taxBasis: TaxBasis; readonly presentation: PricePresentation; readonly currency: EuCurrency; readonly pricePer1000LMinor4: number; readonly effectiveDate: string; readonly publishedAt: string; readonly provenance: "OFFICIAL_BENCHMARK_FIXTURE"; readonly permittedUses: readonly ["DISPLAY","SIMULATE"]; readonly quoteEligible: false; readonly settlementEligible: false; readonly sourceFileHash: `sha256:${string}`; readonly rowLineage: string; }
export interface EuReleaseDecision { readonly disposition: "ACCEPTED" | "QUARANTINED" | "CORRECTION"; readonly issues: readonly Readonly<{ code: EuReleaseQualityCode; detail: string }>[]; readonly observations: readonly EuWeeklyBenchmarkObservation[]; readonly countryCount: number; readonly rowCount: number; }

const products = ["PETROL_95","ROAD_DIESEL"] as const; const taxBases = ["WITH_TAXES","WITHOUT_TAXES"] as const;
export function createSyntheticBulletinWorkbook(overrides: Partial<SyntheticBulletinWorkbook> = {}): SyntheticBulletinWorkbook {
  const rows = EU_COUNTRIES.flatMap((country, countryIndex) => products.flatMap((product, productIndex) => taxBases.map((taxBasis, taxIndex) => {
    const eur = 6_000_000 + countryIndex * 10_000 + productIndex * 500_000 + taxIndex * 1_500_000;
    const currency = EU_CURRENCY_BY_COUNTRY[country]; const multiplier = currency === "EUR" ? 1 : ({CZK:25,DKK:7,HUF:390,PLN:4,RON:5,SEK:11} as const)[currency];
    return { country, product, taxBasis, nationalCurrency: currency, nationalPricePer1000LMinor4: eur * multiplier, eurPricePer1000LMinor4: eur };
  })));
  return { fixture: true, source: "EU_WEEKLY_OIL_BULLETIN", schemaVersion: EU_PRICING_SOURCE_CONTRACT_VERSION, fileName: "synthetic-eu-weekly-oil-bulletin-2026-08-24.xlsx", fileHash: "sha256:synthetic-eu-wob-2026-08-24-v1", effectiveDate: "2026-08-24", publishedAt: "2026-08-27T08:00:00Z", headers: REQUIRED_HEADERS, rows, supersedesFileHash: null, ...overrides };
}

export function parseEuWeeklyBulletinFixture(workbook: SyntheticBulletinWorkbook, assessedAt: string, knownFileHashes: ReadonlySet<string> = new Set()): EuReleaseDecision {
  const issues: { code: EuReleaseQualityCode; detail: string }[] = [];
  if (!workbook.fixture || workbook.source !== "EU_WEEKLY_OIL_BULLETIN" || workbook.schemaVersion !== EU_PRICING_SOURCE_CONTRACT_VERSION || workbook.headers.join("|") !== REQUIRED_HEADERS.join("|")) issues.push({ code: "SCHEMA_DRIFT", detail: "Fixture identity, contract or exact headers changed." });
  if (!workbook.fileHash.startsWith("sha256:") || workbook.fileHash.length <= 7) issues.push({ code: "HASH_INVALID", detail: "A content-addressed workbook hash is required." });
  const effective = Date.parse(`${workbook.effectiveDate}T00:00:00Z`); const published = Date.parse(workbook.publishedAt); const assessed = Date.parse(assessedAt);
  if (![effective,published,assessed].every(Number.isFinite) || published < effective) issues.push({ code: "TIMESTAMP_INVALID", detail: "Effective, publication and assessment times must be valid and ordered." });
  if (Number.isFinite(published) && Number.isFinite(assessed) && published > assessed) issues.push({ code: "FUTURE_RELEASE", detail: "Publication is later than the assessment clock." });
  if (Number.isFinite(effective) && Number.isFinite(assessed) && (assessed-effective)/86_400_000 > 10) issues.push({ code: "STALE", detail: "Weekly release exceeds the ten-day current window." });
  const keys = workbook.rows.map(({country,product,taxBasis})=>`${country}|${product}|${taxBasis}`); if (new Set(keys).size !== keys.length) issues.push({ code: "DUPLICATE_ROW", detail: "Country/product/tax rows must be unique." });
  const expected = EU_COUNTRIES.flatMap((country)=>products.flatMap((product)=>taxBases.map((taxBasis)=>`${country}|${product}|${taxBasis}`)));
  if (workbook.rows.length !== expected.length || expected.some((key)=>!keys.includes(key))) issues.push({ code: "COUNTRY_COVERAGE", detail: "Exactly 27 countries and four required product/tax rows per country are required." });
  if (workbook.rows.some((row)=>!EU_COUNTRIES.includes(row.country) || row.nationalCurrency !== EU_CURRENCY_BY_COUNTRY[row.country] || !Number.isSafeInteger(row.nationalPricePer1000LMinor4) || !Number.isSafeInteger(row.eurPricePer1000LMinor4) || row.nationalPricePer1000LMinor4 <= 0 || row.eurPricePer1000LMinor4 <= 0)) issues.push({ code: "VALUE_INVALID", detail: "Country currency and positive integer four-decimal prices must be valid." });
  const seen = knownFileHashes.has(workbook.fileHash); if (seen && workbook.supersedesFileHash) issues.push({ code: "CORRECTION_INVALID", detail: "A known identical hash cannot be a correction." });
  if (workbook.supersedesFileHash && (!knownFileHashes.has(workbook.supersedesFileHash) || workbook.supersedesFileHash === workbook.fileHash)) issues.push({ code: "CORRECTION_INVALID", detail: "Correction must supersede a known distinct workbook hash." });
  if (issues.length) return { disposition: "QUARANTINED", issues, observations: [], countryCount: new Set(workbook.rows.map(({country})=>country)).size, rowCount: workbook.rows.length };
  const observations = workbook.rows.flatMap((row, index) => ([
    { presentation: "NATIONAL" as const, currency: row.nationalCurrency, price: row.nationalPricePer1000LMinor4 },
    { presentation: "EUR" as const, currency: "EUR" as const, price: row.eurPricePer1000LMinor4 },
  ].map((view): EuWeeklyBenchmarkObservation => ({ observationId: `EU-WOB-${workbook.effectiveDate}-${row.country}-${row.product}-${row.taxBasis}-${view.presentation}`, country: row.country, geographicScope: "COUNTRY", product: row.product, taxBasis: row.taxBasis, presentation: view.presentation, currency: view.currency, pricePer1000LMinor4: view.price, effectiveDate: workbook.effectiveDate, publishedAt: workbook.publishedAt, provenance: "OFFICIAL_BENCHMARK_FIXTURE", permittedUses: ["DISPLAY","SIMULATE"], quoteEligible: false, settlementEligible: false, sourceFileHash: workbook.fileHash, rowLineage: `rows[${index}]` }))));
  return { disposition: workbook.supersedesFileHash ? "CORRECTION" : "ACCEPTED", issues: [], observations, countryCount: EU_COUNTRIES.length, rowCount: workbook.rows.length };
}

export const syntheticEuWeeklyBulletin = createSyntheticBulletinWorkbook();
export const syntheticEuWeeklyBulletinDecision = parseEuWeeklyBulletinFixture(syntheticEuWeeklyBulletin, "2026-08-27T12:00:00Z");
