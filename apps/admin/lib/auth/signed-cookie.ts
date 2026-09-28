import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-signed JSON for small server-issued cookies (idle clock, step-up grant). Not encrypted: never put secrets in them. */
export function sign(payload: object, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verify<T>(value: string | undefined, secret: string): T | null {
  if (!value) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export type IdleClock = { sid: string; last: number };
export type StepUpGrant = { sub: string; sid: string; iat: number; exp: number };
