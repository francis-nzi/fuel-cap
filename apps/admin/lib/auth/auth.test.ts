import { describe, expect, it } from "vitest";
import { hasFreshStepUp, totpVerifiedAt, type AuthClaims } from "./claims";
import { sign, verify, type StepUpGrant } from "./signed-cookie";

const secret = "x".repeat(40);
const now = 1_790_000_000;
const claims = (totpAt: number | null, sid = "session-1"): AuthClaims => ({
  sub: "user-1", session_id: sid, aal: "aal2",
  amr: [{ method: "password", timestamp: now - 3600 }, ...(totpAt === null ? [] : [{ method: "totp", timestamp: totpAt }])],
});
const grant = (iat: number, overrides: Partial<StepUpGrant> = {}): StepUpGrant => ({ sub: "user-1", sid: "session-1", iat, exp: iat + 300, ...overrides });

describe("signed cookies", () => {
  it("round-trips and rejects tampering or the wrong secret", () => {
    const value = sign({ sid: "s", last: 1 }, secret);
    expect(verify(value, secret)).toEqual({ sid: "s", last: 1 });
    const [body, mac] = value.split(".");
    const forged = `${Buffer.from(JSON.stringify({ sid: "s", last: 9e15 })).toString("base64url")}.${mac}`;
    expect(verify(forged, secret)).toBeNull();
    expect(verify(`${body}.${mac}x`, secret)).toBeNull();
    expect(verify(value, "y".repeat(40))).toBeNull();
    expect(verify(undefined, secret)).toBeNull();
  });
});

describe("step-up freshness", () => {
  it("reads the latest authenticator check from Supabase's amr claim", () => {
    expect(totpVerifiedAt(claims(now - 10))).toBe(now - 10);
    expect(totpVerifiedAt(claims(null))).toBeNull();
  });

  it("is fresh only with a matching grant and a TOTP check at step-up time, for 5 minutes", () => {
    expect(hasFreshStepUp(claims(now - 60), grant(now - 60), now)).toBe(true);
    expect(hasFreshStepUp(claims(now - 299), grant(now - 299), now)).toBe(true);
    expect(hasFreshStepUp(claims(now - 301), grant(now - 301), now)).toBe(false);
  });

  it("never counts the sign-in MFA check on its own", () => {
    expect(hasFreshStepUp(claims(now - 30), null, now)).toBe(false);
    // A grant issued after the last TOTP check (no code entered at step-up) doesn't count either.
    expect(hasFreshStepUp(claims(now - 200), grant(now - 30), now)).toBe(false);
  });

  it("is bound to the same user and session", () => {
    expect(hasFreshStepUp(claims(now - 30), grant(now - 30, { sub: "someone-else" }), now)).toBe(false);
    expect(hasFreshStepUp(claims(now - 30, "session-2"), grant(now - 30), now)).toBe(false);
    expect(hasFreshStepUp(claims(now - 30), grant(now - 30, { exp: now - 30 + 3600 }), now)).toBe(false);
  });
});
