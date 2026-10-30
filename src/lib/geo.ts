import type { MarketCode } from "./markets";

export type Coords = { latitude: number; longitude: number };
export type Place = Coords & { label: string };

const EARTH_MILES = 3958.8;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in miles. */
export function milesBetween(a: Coords, b: Coords) {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Miles in the US and UK, kilometres in Canada. */
export function formatDistance(miles: number, market: MarketCode) {
  const km = market === "CA";
  const value = km ? miles * 1.609344 : miles;
  const unit = km ? "km" : "mi";
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${unit}`;
}

/** Where the demo is set when the person is not in that country, or hasn't shared a location. */
export const demoAreas: Record<MarketCode, Place> = {
  US: { latitude: 30.2672, longitude: -97.7431, label: "Austin, TX" },
  CA: { latitude: 43.6532, longitude: -79.3832, label: "Toronto, ON" },
  GB: { latitude: 51.5072, longitude: -0.1276, label: "central London" },
};

/** A location counts as "in the market" when a station is within this many miles. */
export const NEARBY_MILES = 60;

export function nearestMiles(from: Coords, points: Coords[]) {
  return points.reduce((best, point) => Math.min(best, milesBetween(from, point)), Number.POSITIVE_INFINITY);
}

/** UK postcodes, full or outward part only (e.g. "SW6 1AA" or "SW6"). */
export const looksLikeUkPostcode = (text: string) => /^[A-Z]{1,2}\d[A-Z\d]?(\s*\d[A-Z]{2})?$/i.test(text.trim());
/** US ZIP (12345) or Canadian postal code (M5V or M5V 2T6). */
export const looksLikeZip = (text: string) => /^\d{5}$/.test(text.trim()) || /^[A-Z]\d[A-Z](\s*\d[A-Z]\d)?$/i.test(text.trim());
