import "server-only";
import { readFileSync } from "node:fs";
import { demoOrganisations, roleCodes, type RoleCode } from "@fuelcap/authz";
import { usesMemoryStore, type AuthConfig } from "./config";
import { createServiceClient, createUserClient } from "./supabase";

export type StaffRecord = {
  userId: string;
  email: string;
  displayName: string;
  roles: RoleCode[];
  organisationIds: string[];
  active: boolean;
  invitedBy: string | null;
  createdAt: string;
};

export type AuditOutcome = "success" | "failure" | "denied" | "info";
export type AuditRecord = {
  id?: number;
  occurredAt: string;
  event: string;
  outcome: AuditOutcome;
  userId: string | null;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  detail: Record<string, unknown>;
};

type StaffRow = { user_id: string; email: string; display_name: string; roles: string[]; organisation_ids: string[]; active: boolean; invited_by: string | null; created_at: string };
type AuditRow = { id: number; occurred_at: string; event: string; outcome: AuditOutcome; user_id: string | null; email: string | null; ip: string | null; user_agent: string | null; detail: Record<string, unknown> };

export const allOrganisationIds = () => demoOrganisations.map(({ organisationId }) => organisationId);
const isRole = (value: string): value is RoleCode => (roleCodes as readonly string[]).includes(value);

const fromRow = (row: StaffRow): StaffRecord => ({
  userId: row.user_id, email: row.email, displayName: row.display_name, roles: row.roles.filter(isRole),
  organisationIds: row.organisation_ids, active: row.active, invitedBy: row.invited_by, createdAt: row.created_at,
});
const fromAuditRow = (row: AuditRow): AuditRecord => ({
  id: row.id, occurredAt: row.occurred_at, event: row.event, outcome: row.outcome, userId: row.user_id,
  email: row.email, ip: row.ip, userAgent: row.user_agent, detail: row.detail,
});

/* ---------- In-memory store (E2E only) ---------- */

type MemoryStore = { staff: Map<string, StaffRecord>; audit: AuditRecord[] };
const memoryHolder = globalThis as typeof globalThis & { __fuelcapAdminStore?: MemoryStore };

function memory(): MemoryStore {
  if (!usesMemoryStore()) throw new Error("MEMORY_STORE_DISABLED");
  if (!memoryHolder.__fuelcapAdminStore) {
    const staff = new Map<string, StaffRecord>();
    const seedPath = process.env.ADMIN_E2E_SEED;
    if (seedPath) {
      const seed = JSON.parse(readFileSync(seedPath, "utf8")) as { users: { id: string; email: string; name: string; roles: string[]; staff?: boolean }[] };
      for (const user of seed.users.filter((entry) => entry.staff !== false)) {
        staff.set(user.id, { userId: user.id, email: user.email, displayName: user.name, roles: user.roles.filter(isRole), organisationIds: allOrganisationIds(), active: true, invitedBy: null, createdAt: new Date(0).toISOString() });
      }
    }
    memoryHolder.__fuelcapAdminStore = { staff, audit: [] };
  }
  return memoryHolder.__fuelcapAdminStore;
}

/* ---------- Staff ---------- */

/** Reads the signed-in person's own staff record as that user, so the aal2 row-level-security rule applies. */
export async function getOwnStaffRecord(config: AuthConfig, userId: string, accessToken: string): Promise<StaffRecord | null> {
  if (usesMemoryStore()) return memory().staff.get(userId) ?? null;
  const { data, error } = await createUserClient(config, accessToken).from("admin_staff").select("*").eq("user_id", userId).maybeSingle<StaffRow>();
  if (error) throw new Error(`STAFF_LOOKUP_FAILED: ${error.message}`);
  return data ? fromRow(data) : null;
}

/** Service-side lookup used during sign-in, before the session reaches aal2. */
export async function getStaffRecordAsService(config: AuthConfig, userId: string): Promise<StaffRecord | null> {
  if (usesMemoryStore()) return memory().staff.get(userId) ?? null;
  const { data, error } = await createServiceClient(config).from("admin_staff").select("*").eq("user_id", userId).maybeSingle<StaffRow>();
  if (error) throw new Error(`STAFF_LOOKUP_FAILED: ${error.message}`);
  return data ? fromRow(data) : null;
}

export async function listStaff(config: AuthConfig): Promise<StaffRecord[]> {
  if (usesMemoryStore()) return [...memory().staff.values()].sort((a, b) => a.email.localeCompare(b.email));
  const { data, error } = await createServiceClient(config).from("admin_staff").select("*").order("email");
  if (error) throw new Error(`STAFF_LIST_FAILED: ${error.message}`);
  return (data as StaffRow[]).map(fromRow);
}

export async function insertStaff(config: AuthConfig, record: StaffRecord) {
  if (usesMemoryStore()) {
    memory().staff.set(record.userId, record);
    return;
  }
  const { error } = await createServiceClient(config).from("admin_staff").upsert({
    user_id: record.userId, email: record.email, display_name: record.displayName, roles: record.roles,
    organisation_ids: record.organisationIds, active: record.active, invited_by: record.invitedBy,
  });
  if (error) throw new Error(`STAFF_INSERT_FAILED: ${error.message}`);
}

/** Disable (or re-enable) someone's control-room access. Takes effect on their next request. */
export async function setStaffActive(config: AuthConfig, userId: string, active: boolean) {
  if (usesMemoryStore()) {
    const record = memory().staff.get(userId);
    if (!record) throw new Error("STAFF_NOT_FOUND");
    memory().staff.set(userId, { ...record, active });
    return;
  }
  const { error, count } = await createServiceClient(config).from("admin_staff").update({ active }, { count: "exact" }).eq("user_id", userId);
  if (error) throw new Error(`STAFF_UPDATE_FAILED: ${error.message}`);
  if (!count) throw new Error("STAFF_NOT_FOUND");
}

/* ---------- Audit ---------- */

export async function appendAudit(config: AuthConfig, record: AuditRecord) {
  if (usesMemoryStore()) {
    const store = memory();
    store.audit.unshift({ ...record, id: store.audit.length + 1 });
    return;
  }
  const { error } = await createServiceClient(config).from("admin_audit_log").insert({
    occurred_at: record.occurredAt, event: record.event, outcome: record.outcome, user_id: record.userId,
    email: record.email, ip: record.ip, user_agent: record.userAgent, detail: record.detail,
  });
  if (error) throw new Error(`AUDIT_WRITE_FAILED: ${error.message}`);
}

export async function listAudit(config: AuthConfig, limit = 200): Promise<AuditRecord[]> {
  if (usesMemoryStore()) return memory().audit.slice(0, limit);
  const { data, error } = await createServiceClient(config).from("admin_audit_log").select("*").order("occurred_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`AUDIT_LIST_FAILED: ${error.message}`);
  return (data as AuditRow[]).map(fromAuditRow);
}
