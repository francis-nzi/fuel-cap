import type { UtmParams } from "./types";

const SESSION_KEY = "fc_session_id";
const UTM_KEY = "fc_utm";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** Reads utm_* params from the current URL and persists them so they survive
 * the whole visit (in case the signup happens several page interactions later). */
export function captureUtmParams(): UtmParams {
  if (typeof window === "undefined") return {};

  const url = new URL(window.location.href);
  const fromUrl: UtmParams = {
    utm_source: url.searchParams.get("utm_source") ?? undefined,
    utm_medium: url.searchParams.get("utm_medium") ?? undefined,
    utm_campaign: url.searchParams.get("utm_campaign") ?? undefined,
    utm_content: url.searchParams.get("utm_content") ?? undefined,
    utm_term: url.searchParams.get("utm_term") ?? undefined,
  };

  const hasNewUtm = Object.values(fromUrl).some(Boolean);
  if (hasNewUtm) {
    window.localStorage.setItem(UTM_KEY, JSON.stringify(fromUrl));
    return fromUrl;
  }

  const stored = window.localStorage.getItem(UTM_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as UtmParams;
    } catch {
      return {};
    }
  }

  return {};
}
