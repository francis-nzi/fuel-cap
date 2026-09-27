import { round4 } from "./protection";

export type LockScope = "station" | "provider" | "country";

export type PriceOption = {
  scopeType: LockScope;
  scopeId: string | null;
  label: string;
  providerName: string | null;
  unitPrice: number;
  currency: string;
  unit: string;
  stationCount: number;
  observedAt: string;
  latitude?: number;
  longitude?: number;
  referenceStationLabel?: string;
};

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round4(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

function latest(options: PriceOption[]) {
  return options.reduce((newest, option) => (option.observedAt > newest ? option.observedAt : newest), options[0]?.observedAt ?? new Date(0).toISOString());
}

/**
 * Brand and "anywhere" prices are the median of the stations they cover, so a single
 * outlier forecourt cannot set the price. Station prices pass through unchanged.
 */
export function normalizeOptions(options: PriceOption[], countryName: string): PriceOption[] {
  const stations = options.filter((option) => option.scopeType === "station");
  if (!stations.length) return options;
  const existingProviders = new Map(options.filter((option) => option.scopeType === "provider").map((option) => [option.providerName ?? option.label, option]));
  const byProvider = new Map<string, PriceOption[]>();
  for (const station of stations) {
    const key = station.providerName ?? "Independent";
    byProvider.set(key, [...(byProvider.get(key) ?? []), station]);
  }
  const providers: PriceOption[] = [...byProvider].map(([name, members]) => {
    const existing = existingProviders.get(name);
    return {
      scopeType: "provider", scopeId: existing?.scopeId ?? `brand-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: name, providerName: name,
      unitPrice: median(members.map((member) => member.unitPrice)), currency: members[0].currency, unit: members[0].unit,
      stationCount: members.length, observedAt: latest(members),
    };
  });
  const country: PriceOption = {
    scopeType: "country", scopeId: null, label: `Any eligible ${countryName} station`, providerName: null,
    unitPrice: median(stations.map((station) => station.unitPrice)), currency: stations[0].currency, unit: stations[0].unit,
    stationCount: stations.length, observedAt: latest(stations),
  };
  return [...stations, ...providers, country];
}

/** Moves every price by the same amount (used when the demo control publishes a market move). */
export function shiftOptions(options: PriceOption[], shift: number, observedAt?: string): PriceOption[] {
  if (!shift && !observedAt) return options;
  return options.map((option) => ({ ...option, unitPrice: round4(option.unitPrice + shift), observedAt: observedAt ?? option.observedAt }));
}

export const stationsByPrice = (options: PriceOption[]) =>
  options.filter((option) => option.scopeType === "station").sort((a, b) => a.unitPrice - b.unitPrice || a.label.localeCompare(b.label));
