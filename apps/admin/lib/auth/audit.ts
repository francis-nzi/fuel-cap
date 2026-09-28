import "server-only";
import type { AuthConfig } from "./config";
import { appendAudit, type AuditOutcome } from "./store";

export type AuditEvent =
  | "SIGN_IN_SUCCEEDED" | "SIGN_IN_FAILED" | "SIGN_IN_DENIED_NOT_STAFF"
  | "PASSWORD_SET"
  | "MFA_ENROLL_STARTED" | "MFA_ENROLLED" | "MFA_VERIFY_SUCCEEDED" | "MFA_VERIFY_FAILED"
  | "STEP_UP_SUCCEEDED" | "STEP_UP_FAILED"
  | "GOVERNED_ACTION_ALLOWED" | "GOVERNED_ACTION_DENIED"
  | "STAFF_INVITED" | "STAFF_INVITE_FAILED" | "STAFF_DISABLED" | "STAFF_ENABLED"
  | "MFA_RESET_BY_ADMIN" | "MFA_FACTOR_REMOVED"
  | "SIGN_OUT" | "SESSION_TIMEOUT";

export type RequestMeta = { ip: string | null; userAgent: string | null };

export function requestMeta(headers: Headers): RequestMeta {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || headers.get("x-real-ip"), userAgent: headers.get("user-agent")?.slice(0, 300) ?? null };
}

/** Appends one audit record. A failed write is logged loudly but never turns into a sign-in bypass or crash. */
export async function audit(config: AuthConfig, event: AuditEvent, outcome: AuditOutcome, who: { userId?: string | null; email?: string | null }, meta: RequestMeta, detail: Record<string, unknown> = {}) {
  try {
    await appendAudit(config, { occurredAt: new Date().toISOString(), event, outcome, userId: who.userId ?? null, email: who.email ?? null, ip: meta.ip, userAgent: meta.userAgent, detail });
  } catch (error) {
    console.error(`[admin-audit] could not record ${event}:`, error instanceof Error ? error.message : error);
  }
}
