import { describe, expect, it, vi } from "vitest";
import { classifyVerifyError, failureResponse, logVerifyFailure, mostUsefulFailure, verifyCode } from "./mfa";

describe("authenticator code failures", () => {
  it("only calls a failure a wrong code when Supabase says the code was wrong", () => {
    expect(classifyVerifyError({ code: "mfa_verification_failed", status: 422 })).toBe("WRONG_CODE");
    expect(classifyVerifyError({ status: 422, message: "Invalid TOTP code entered" })).toBe("WRONG_CODE");
    expect(classifyVerifyError({ code: "mfa_challenge_expired", status: 422 })).toBe("SETUP_EXPIRED");
    expect(classifyVerifyError({ code: "mfa_factor_not_found", status: 404 })).toBe("SETUP_EXPIRED");
    expect(classifyVerifyError({ code: "over_request_rate_limit", status: 429 })).toBe("TOO_MANY_ATTEMPTS");
    expect(classifyVerifyError({ code: "session_not_found", status: 403 })).toBe("SESSION_EXPIRED");
    expect(classifyVerifyError({ code: "mfa_ip_address_mismatch", status: 422 })).toBe("VERIFY_UNAVAILABLE");
    expect(classifyVerifyError({ code: "unexpected_failure", status: 500 })).toBe("VERIFY_UNAVAILABLE");
    expect(classifyVerifyError({})).toBe("VERIFY_UNAVAILABLE");
  });

  it("keeps INVALID_CODE for a wrong code and gives every other failure its own error", () => {
    expect(failureResponse.WRONG_CODE).toEqual({ status: 401, error: "INVALID_CODE" });
    expect(new Set(Object.values(failureResponse).map((response) => response.error)).size).toBe(5);
  });

  it("reports the more useful reason when several authenticators were tried", () => {
    const wrong = { reason: "WRONG_CODE" as const, id: 1 };
    const limited = { reason: "TOO_MANY_ATTEMPTS" as const, id: 2 };
    expect(mostUsefulFailure([wrong, limited])).toBe(limited);
    expect(mostUsefulFailure([wrong])).toBe(wrong);
  });

  it("logs Supabase's error code but never the code entered", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logVerifyFailure("enrol", "ed7b1086-045d-4e9e-afb1-331ce6cefe61", { code: "mfa_verification_failed", status: 422, message: "Invalid TOTP code entered" });
    expect(warn).toHaveBeenCalledWith("[mfa] enrol verify failed: factor=ed7b1086 supabase_code=mfa_verification_failed supabase_status=422");
    warn.mockRestore();
  });

  it("retries once with a new challenge when Supabase reports an IP address mismatch", async () => {
    const mismatch = { data: null, error: { code: "mfa_ip_address_mismatch", status: 422 } };
    const ok = { data: { access_token: "t" }, error: null };
    const challengeAndVerify = vi.fn().mockResolvedValueOnce(mismatch).mockResolvedValueOnce(ok);
    const client = { auth: { mfa: { challengeAndVerify } } } as unknown as Parameters<typeof verifyCode>[0];
    expect(await verifyCode(client, "factor-1", "123456")).toBe(ok);
    expect(challengeAndVerify).toHaveBeenCalledTimes(2);

    const wrong = { data: null, error: { code: "mfa_verification_failed", status: 422 } };
    const once = vi.fn().mockResolvedValue(wrong);
    expect(await verifyCode({ auth: { mfa: { challengeAndVerify: once } } } as unknown as Parameters<typeof verifyCode>[0], "factor-1", "123456")).toBe(wrong);
    expect(once).toHaveBeenCalledTimes(1);
  });
});
