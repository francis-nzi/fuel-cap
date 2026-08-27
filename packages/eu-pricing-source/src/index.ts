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

export type OfficialWorkbookKind = "WITH_TAXES" | "WITHOUT_TAXES";
export type OfficialSourceEvidenceStatus = "EVIDENCE_ACCEPTED" | "EVIDENCE_REJECTED";

export interface OfficialWorkbookEvidence {
  readonly kind: OfficialWorkbookKind;
  readonly sourceUrl: `https://${string}`;
  readonly observedAt: string;
  readonly contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  readonly contentLength: number;
  readonly sha256: `sha256:${string}`;
  readonly containerMagic: "PK\u0003\u0004";
  readonly worksheetNames: readonly ["Sheet1"];
  readonly publisher: "EUROPEAN_COMMISSION_DG_ENERGY";
  readonly provenance: "OFFICIAL_SOURCE_EVIDENCE";
  readonly licenceEvidence: "EC_LEGAL_NOTICE_CC_BY_4_UNLESS_OTHERWISE_INDICATED";
  readonly licenceApproval: "PENDING_CHECKER";
  readonly permittedUses: readonly ["EVIDENCE_REVIEW"];
  readonly publicationEligible: false;
  readonly quoteEligible: false;
  readonly settlementEligible: false;
}

export interface OfficialSourceEvidenceDecision {
  readonly status: OfficialSourceEvidenceStatus;
  readonly issues: readonly string[];
  readonly evidence: readonly OfficialWorkbookEvidence[];
}

const OFFICIAL_DOCUMENT_HOST = "energy.ec.europa.eu";
const EXPECTED_OFFICIAL_KINDS = ["WITH_TAXES", "WITHOUT_TAXES"] as const;

export const officialWeeklyBulletinGate2Evidence: readonly OfficialWorkbookEvidence[] = [
  {
    kind: "WITH_TAXES",
    sourceUrl: "https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en?filename=Weekly+Oil+Bulletin+Weekly+prices+with+Taxes+-+2024-02-19.xlsx",
    observedAt: "2026-08-27T20:08:00Z",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    contentLength: 14_158,
    sha256: "sha256:6bd0f4d658d49bcc9a1bb652d3e9baa44c55c0319f1da1fafdb752c35de91c3c",
    containerMagic: "PK\u0003\u0004",
    worksheetNames: ["Sheet1"],
    publisher: "EUROPEAN_COMMISSION_DG_ENERGY",
    provenance: "OFFICIAL_SOURCE_EVIDENCE",
    licenceEvidence: "EC_LEGAL_NOTICE_CC_BY_4_UNLESS_OTHERWISE_INDICATED",
    licenceApproval: "PENDING_CHECKER",
    permittedUses: ["EVIDENCE_REVIEW"],
    publicationEligible: false,
    quoteEligible: false,
    settlementEligible: false,
  },
  {
    kind: "WITHOUT_TAXES",
    sourceUrl: "https://energy.ec.europa.eu/document/download/78311f92-68f8-4b82-b5cf-1293beeaae77_en?filename=Weekly+Oil+Bulletin+Weekly+prices+without+taxes+-+2024-02-19.xlsx",
    observedAt: "2026-08-27T20:08:00Z",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    contentLength: 17_335,
    sha256: "sha256:ace16948eb111f7a5ddf35f1c80a1fa633701167f13645b7aaa5d9f9ad7820b0",
    containerMagic: "PK\u0003\u0004",
    worksheetNames: ["Sheet1"],
    publisher: "EUROPEAN_COMMISSION_DG_ENERGY",
    provenance: "OFFICIAL_SOURCE_EVIDENCE",
    licenceEvidence: "EC_LEGAL_NOTICE_CC_BY_4_UNLESS_OTHERWISE_INDICATED",
    licenceApproval: "PENDING_CHECKER",
    permittedUses: ["EVIDENCE_REVIEW"],
    publicationEligible: false,
    quoteEligible: false,
    settlementEligible: false,
  },
] as const;

export function assessOfficialSourceEvidence(evidence: readonly OfficialWorkbookEvidence[]): OfficialSourceEvidenceDecision {
  const issues: string[] = [];
  const kinds = evidence.map(({ kind }) => kind);
  if (evidence.length !== EXPECTED_OFFICIAL_KINDS.length || EXPECTED_OFFICIAL_KINDS.some((kind) => !kinds.includes(kind)) || new Set(kinds).size !== kinds.length) issues.push("Exactly one with-taxes and one without-taxes workbook are required.");
  for (const item of evidence) {
    let url: URL | undefined;
    try { url = new URL(item.sourceUrl); } catch { issues.push(`${item.kind}: source URL is invalid.`); }
    if (url && (url.protocol !== "https:" || url.hostname !== OFFICIAL_DOCUMENT_HOST || !url.pathname.startsWith("/document/download/") || !url.searchParams.get("filename")?.toLowerCase().endsWith(".xlsx"))) issues.push(`${item.kind}: source is not a pinned Commission XLSX document URL.`);
    if (!Number.isFinite(Date.parse(item.observedAt))) issues.push(`${item.kind}: observation time is invalid.`);
    if (item.contentLength <= 0 || !/^sha256:[a-f0-9]{64}$/.test(item.sha256) || item.containerMagic !== "PK\u0003\u0004") issues.push(`${item.kind}: immutable XLSX identity is invalid.`);
    if (item.worksheetNames.length !== 1 || item.worksheetNames[0] !== "Sheet1") issues.push(`${item.kind}: workbook structure drifted from the observed single-sheet shape.`);
    if (item.licenceApproval !== "PENDING_CHECKER" || item.permittedUses.join() !== "EVIDENCE_REVIEW" || item.publicationEligible || item.quoteEligible || item.settlementEligible) issues.push(`${item.kind}: Gate 2 evidence exceeded its permitted-use boundary.`);
  }
  return { status: issues.length ? "EVIDENCE_REJECTED" : "EVIDENCE_ACCEPTED", issues, evidence: issues.length ? [] : evidence };
}

export const officialWeeklyBulletinGate2Decision = assessOfficialSourceEvidence(officialWeeklyBulletinGate2Evidence);

export type EuPublicationState = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUBLISHED" | "ROLLED_BACK";
export type EuReleaseHealth = "CURRENT" | "STALE" | "EXPIRED" | "QUARANTINED";
export interface EuBenchmarkConfiguration { readonly configurationId: string; readonly version: number; readonly state: EuPublicationState; readonly makerId: string; readonly checkerId: string | null; readonly sourceEvidenceHashes: readonly `sha256:${string}`[]; readonly countries: readonly EuCountryCode[]; readonly products: readonly EuBulletinProduct[]; readonly taxBases: readonly TaxBasis[]; readonly licenceApproval: "CHECKER_APPROVED"; readonly attribution: string; readonly freshnessCurrentDays: 10; readonly freshnessExpiredDays: 17; readonly rollbackReference: string; readonly evidenceDigest: `sha256:${string}`; readonly requestedAt: string; readonly approvedAt: string | null; readonly publishedAt: string | null; readonly supersedesConfigurationId: string | null; }
export interface EuBenchmarkRelease { readonly releaseId: string; readonly configurationId: string; readonly sourceFileHash: `sha256:${string}`; readonly effectiveDate: string; readonly publishedAt: string; readonly ingestedAt: string; readonly state: "PUBLISHED" | "QUARANTINED" | "ROLLED_BACK"; readonly health: EuReleaseHealth; readonly observationCount: number; readonly countryCount: number; readonly provenance: "OFFICIAL_BENCHMARK_FIXTURE"; readonly permittedUses: readonly ["DISPLAY", "SIMULATE"]; readonly quoteEligible: false; readonly settlementEligible: false; readonly reasonCodes: readonly string[]; readonly correctionOfReleaseId: string | null; }
export interface EuBenchmarkMonitoring { readonly assessedAt: string; readonly current: number; readonly stale: number; readonly expired: number; readonly quarantined: number; readonly corrected: number; readonly activeReleaseId: string | null; readonly publicationHealthy: boolean; readonly alerts: readonly string[]; }

export function createEuBenchmarkConfiguration(input: Readonly<Omit<EuBenchmarkConfiguration, "state" | "checkerId" | "approvedAt" | "publishedAt">>): EuBenchmarkConfiguration {
  if (!input.makerId.trim() || input.sourceEvidenceHashes.length !== 2 || new Set(input.sourceEvidenceHashes).size !== 2 || input.countries.length !== 27 || input.products.length !== 2 || input.taxBases.length !== 2 || !input.attribution.trim() || !input.rollbackReference.trim() || !/^sha256:[a-f0-9]{64}$/.test(input.evidenceDigest) || !Number.isFinite(Date.parse(input.requestedAt))) throw new Error("Complete source, mapping, licence, attribution and rollback evidence is required.");
  return { ...input, state: "PENDING_APPROVAL", checkerId: null, approvedAt: null, publishedAt: null };
}

export function approveEuBenchmarkConfiguration(configuration: EuBenchmarkConfiguration, input: Readonly<{ checkerId: string; assurance: "STEP_UP"; evidenceDigest: string; approvedAt: string }>): EuBenchmarkConfiguration {
  if (configuration.state !== "PENDING_APPROVAL") throw new Error("Only a pending configuration can be approved.");
  if (!input.checkerId.trim() || input.checkerId === configuration.makerId) throw new Error("Approval requires a different checker.");
  if (input.assurance !== "STEP_UP" || input.evidenceDigest !== configuration.evidenceDigest || !Number.isFinite(Date.parse(input.approvedAt)) || Date.parse(input.approvedAt) < Date.parse(configuration.requestedAt)) throw new Error("Fresh step-up approval of the exact evidence digest is required.");
  return { ...configuration, state: "APPROVED", checkerId: input.checkerId, approvedAt: input.approvedAt };
}

export function publishEuBenchmarkConfiguration(configuration: EuBenchmarkConfiguration, publishedAt: string): EuBenchmarkConfiguration {
  if (configuration.state !== "APPROVED" || !configuration.checkerId || !Number.isFinite(Date.parse(publishedAt)) || Date.parse(publishedAt) < Date.parse(configuration.approvedAt!)) throw new Error("Only an approved configuration can be published in order.");
  return { ...configuration, state: "PUBLISHED", publishedAt };
}

export function createEuBenchmarkRelease(configuration: EuBenchmarkConfiguration, decision: EuReleaseDecision, input: Readonly<{ releaseId: string; ingestedAt: string; correctionOfReleaseId?: string | null }>): EuBenchmarkRelease {
  if (configuration.state !== "PUBLISHED") throw new Error("A published configuration is required.");
  const observation = decision.observations[0];
  if (decision.disposition === "QUARANTINED" || !observation) return { releaseId: input.releaseId, configurationId: configuration.configurationId, sourceFileHash: "sha256:quarantined-no-publish", effectiveDate: "1970-01-01", publishedAt: input.ingestedAt, ingestedAt: input.ingestedAt, state: "QUARANTINED", health: "QUARANTINED", observationCount: 0, countryCount: decision.countryCount, provenance: "OFFICIAL_BENCHMARK_FIXTURE", permittedUses: ["DISPLAY","SIMULATE"], quoteEligible: false, settlementEligible: false, reasonCodes: decision.issues.map(({code})=>code), correctionOfReleaseId: input.correctionOfReleaseId ?? null };
  if (!Number.isFinite(Date.parse(input.ingestedAt)) || Date.parse(input.ingestedAt) < Date.parse(observation.publishedAt)) throw new Error("Valid ordered ingestion time is required.");
  return { releaseId: input.releaseId, configurationId: configuration.configurationId, sourceFileHash: observation.sourceFileHash, effectiveDate: observation.effectiveDate, publishedAt: observation.publishedAt, ingestedAt: input.ingestedAt, state: "PUBLISHED", health: "CURRENT", observationCount: decision.observations.length, countryCount: decision.countryCount, provenance: "OFFICIAL_BENCHMARK_FIXTURE", permittedUses: ["DISPLAY","SIMULATE"], quoteEligible: false, settlementEligible: false, reasonCodes: decision.disposition === "CORRECTION" ? ["CORRECTION_LINKED"] : [], correctionOfReleaseId: input.correctionOfReleaseId ?? null };
}

export function assessEuBenchmarkMonitoring(releases: readonly EuBenchmarkRelease[], assessedAt: string): EuBenchmarkMonitoring {
  const assessed = Date.parse(assessedAt); if (!Number.isFinite(assessed)) throw new Error("A valid assessment clock is required.");
  const evaluated = releases.map((release): EuBenchmarkRelease => { if (release.state !== "PUBLISHED") return release; const age = (assessed-Date.parse(`${release.effectiveDate}T00:00:00Z`))/86_400_000; return { ...release, health: age <= 10 ? "CURRENT" : age <= 17 ? "STALE" : "EXPIRED" }; });
  const active = [...evaluated].reverse().find(({state,health})=>state === "PUBLISHED" && health === "CURRENT");
  const count = (health: EuReleaseHealth) => evaluated.filter((release)=>release.health === health).length;
  const alerts = [...(count("QUARANTINED") ? ["QUARANTINE_REVIEW_REQUIRED"] : []), ...(!active ? ["NO_CURRENT_RELEASE"] : []), ...(count("STALE") ? ["STALE_RELEASE_PRESENT"] : []), ...(count("EXPIRED") ? ["EXPIRED_RELEASE_PRESENT"] : [])];
  return { assessedAt, current: count("CURRENT"), stale: count("STALE"), expired: count("EXPIRED"), quarantined: count("QUARANTINED"), corrected: evaluated.filter(({correctionOfReleaseId})=>correctionOfReleaseId).length, activeReleaseId: active?.releaseId ?? null, publicationHealthy: Boolean(active) && !count("QUARANTINED"), alerts };
}

export function rollbackEuBenchmarkRelease(release: EuBenchmarkRelease, input: Readonly<{ makerId: string; checkerId: string; rollbackReference: string; rolledBackAt: string }>): EuBenchmarkRelease {
  if (release.state !== "PUBLISHED" || !input.makerId.trim() || !input.checkerId.trim() || input.makerId === input.checkerId || !input.rollbackReference.trim() || !Number.isFinite(Date.parse(input.rolledBackAt))) throw new Error("Rollback requires a published release, different principals and evidence.");
  return { ...release, state: "ROLLED_BACK", reasonCodes: [...release.reasonCodes, `ROLLED_BACK:${input.rollbackReference}`] };
}

const SEEDED_EU_CONFIGURATION_DIGEST = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
export const seededEuBenchmarkConfiguration = publishEuBenchmarkConfiguration(approveEuBenchmarkConfiguration(createEuBenchmarkConfiguration({ configurationId: "EU-BENCHMARK-CONFIG-1", version: 1, makerId: "principal-data", sourceEvidenceHashes: officialWeeklyBulletinGate2Evidence.map(({sha256})=>sha256), countries: EU_COUNTRIES, products, taxBases, licenceApproval: "CHECKER_APPROVED", attribution: "European Commission, Weekly Oil Bulletin; synthetic fixture transformation marked by FuelCap.", freshnessCurrentDays: 10, freshnessExpiredDays: 17, rollbackReference: "RB-EU-BENCHMARK-001", evidenceDigest: SEEDED_EU_CONFIGURATION_DIGEST, requestedAt: "2026-08-27T20:20:00Z", supersedesConfigurationId: null }), { checkerId: "principal-platform", assurance: "STEP_UP", evidenceDigest: SEEDED_EU_CONFIGURATION_DIGEST, approvedAt: "2026-08-27T20:21:00Z" }), "2026-08-27T20:22:00Z");
export const seededEuBenchmarkRelease = createEuBenchmarkRelease(seededEuBenchmarkConfiguration, syntheticEuWeeklyBulletinDecision, { releaseId: "EU-BENCHMARK-2026-08-24-V1", ingestedAt: "2026-08-27T20:23:00Z" });
export const seededEuBenchmarkMonitoring = assessEuBenchmarkMonitoring([seededEuBenchmarkRelease], "2026-08-27T20:24:00Z");
