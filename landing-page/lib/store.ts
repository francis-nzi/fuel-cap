import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { FunnelStep, PageView, Submission, SignupAnswers, UtmParams } from "./types";
import { FUNNEL_STEPS } from "./types";
import { supabaseConfigured, sbSelect, sbInsert, sbUpsert } from "./supabase";

/**
 * Data store for the waitlist funnel, contacts and page views.
 *
 * Two backends, chosen automatically at runtime:
 *   1. Supabase (PostgREST)  — used when SUPABASE_URL + SUPABASE_SECRET_KEY
 *      are set. This is the production path and persists across serverless
 *      invocations. Apply supabase/schema.sql once to create the tables.
 *   2. Local file store       — used otherwise, for `next dev` / self-hosted
 *      single-node use. Writes JSON under ./data. NOTE: on Vercel and other
 *      serverless hosts the filesystem is ephemeral/read-only, so configure
 *      Supabase before deploying there.
 *
 * The exported function signatures are the only surface the rest of the app
 * talks to, so swapping or adding a backend stays contained to this file.
 */

// ----------------------------------------------------------------------------
// Contacts type (kept here since it's store-local)
// ----------------------------------------------------------------------------
export type Contact = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  message: string;
  market?: string;
};

// ----------------------------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------------------------
function stepIndex(step: FunnelStep): number {
  return FUNNEL_STEPS.indexOf(step);
}

// ----------------------------------------------------------------------------
// Supabase row mapping (snake_case DB <-> camelCase app)
// ----------------------------------------------------------------------------
type SubmissionRow = {
  session_id: string;
  created_at: string;
  updated_at: string;
  completed: boolean;
  completed_at: string | null;
  furthest_step: FunnelStep;
  landing_market: string | null;
  answers: SignupAnswers;
  utm: UtmParams;
  referrer: string | null;
  user_agent: string | null;
};

function rowToSubmission(r: SubmissionRow): Submission {
  return {
    sessionId: r.session_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completed: r.completed,
    completedAt: r.completed_at ?? undefined,
    furthestStep: r.furthest_step,
    landingMarket: r.landing_market ?? undefined,
    answers: r.answers ?? {},
    utm: r.utm ?? {},
    referrer: r.referrer ?? undefined,
    userAgent: r.user_agent ?? undefined,
  };
}

function submissionToRow(s: Submission): SubmissionRow {
  return {
    session_id: s.sessionId,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    completed: s.completed,
    completed_at: s.completedAt ?? null,
    furthest_step: s.furthestStep,
    landing_market: s.landingMarket ?? null,
    answers: s.answers,
    utm: s.utm,
    referrer: s.referrer ?? null,
    user_agent: s.userAgent ?? null,
  };
}

// ----------------------------------------------------------------------------
// File store internals
// ----------------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const PAGEVIEWS_FILE = path.join(DATA_DIR, "pageviews.json");
const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");

const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(file: string, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(file) ?? Promise.resolve();
  const next = prev.then(task, task);
  queues.set(
    file,
    next.catch(() => undefined)
  );
  return next;
}

async function readJsonFile<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeJsonFile<T>(file: string, data: T[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

// ----------------------------------------------------------------------------
// Submissions
// ----------------------------------------------------------------------------
export async function getSubmissions(): Promise<Submission[]> {
  if (supabaseConfigured()) {
    const rows = await sbSelect<SubmissionRow>(
      "submissions",
      "select=*&order=created_at.desc"
    );
    return rows.map(rowToSubmission);
  }
  return readJsonFile<Submission>(SUBMISSIONS_FILE);
}

export async function upsertSubmission(input: {
  sessionId: string;
  step: FunnelStep;
  answers?: SignupAnswers;
  utm?: UtmParams;
  referrer?: string;
  userAgent?: string;
  completed?: boolean;
  landingMarket?: string;
}): Promise<Submission> {
  const now = new Date().toISOString();

  function merge(existing: Submission | undefined): Submission {
    if (!existing) {
      return {
        sessionId: input.sessionId,
        createdAt: now,
        updatedAt: now,
        completed: !!input.completed,
        completedAt: input.completed ? now : undefined,
        furthestStep: input.step,
        landingMarket: input.landingMarket,
        answers: input.answers ?? {},
        utm: input.utm ?? {},
        referrer: input.referrer,
        userAgent: input.userAgent,
      };
    }
    return {
      ...existing,
      updatedAt: now,
      completed: existing.completed || !!input.completed,
      completedAt: existing.completedAt ?? (input.completed ? now : undefined),
      furthestStep:
        stepIndex(input.step) > stepIndex(existing.furthestStep)
          ? input.step
          : existing.furthestStep,
      landingMarket: existing.landingMarket ?? input.landingMarket,
      answers: { ...existing.answers, ...input.answers },
      utm: { ...existing.utm, ...input.utm },
      referrer: existing.referrer ?? input.referrer,
      userAgent: existing.userAgent ?? input.userAgent,
    };
  }

  if (supabaseConfigured()) {
    const existingRows = await sbSelect<SubmissionRow>(
      "submissions",
      `select=*&session_id=eq.${encodeURIComponent(input.sessionId)}&limit=1`
    );
    const merged = merge(existingRows[0] ? rowToSubmission(existingRows[0]) : undefined);
    const [row] = await sbUpsert<SubmissionRow>(
      "submissions",
      submissionToRow(merged),
      "session_id"
    );
    return row ? rowToSubmission(row) : merged;
  }

  return enqueue(SUBMISSIONS_FILE, async () => {
    const submissions = await readJsonFile<Submission>(SUBMISSIONS_FILE);
    const idx = submissions.findIndex((s) => s.sessionId === input.sessionId);
    const merged = merge(idx === -1 ? undefined : submissions[idx]);
    if (idx === -1) submissions.push(merged);
    else submissions[idx] = merged;
    await writeJsonFile(SUBMISSIONS_FILE, submissions);
    return merged;
  });
}

// ----------------------------------------------------------------------------
// Page views
// ----------------------------------------------------------------------------
export async function getPageViews(): Promise<PageView[]> {
  if (supabaseConfigured()) {
    type Row = {
      id: string;
      timestamp: string;
      utm: UtmParams;
      referrer: string | null;
      user_agent: string | null;
      path: string;
      market: string | null;
    };
    const rows = await sbSelect<Row>("pageviews", "select=*&order=timestamp.desc");
    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      utm: r.utm ?? {},
      referrer: r.referrer ?? undefined,
      userAgent: r.user_agent ?? undefined,
      path: r.path,
      market: r.market ?? undefined,
    }));
  }
  return readJsonFile<PageView>(PAGEVIEWS_FILE);
}

export async function addPageView(input: {
  utm?: UtmParams;
  referrer?: string;
  userAgent?: string;
  path: string;
  market?: string;
}): Promise<PageView> {
  const entry: PageView = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    utm: input.utm ?? {},
    referrer: input.referrer,
    userAgent: input.userAgent,
    path: input.path,
    market: input.market,
  };

  if (supabaseConfigured()) {
    await sbInsert("pageviews", {
      id: entry.id,
      timestamp: entry.timestamp,
      utm: entry.utm,
      referrer: entry.referrer ?? null,
      user_agent: entry.userAgent ?? null,
      path: entry.path,
      market: entry.market ?? null,
    });
    return entry;
  }

  return enqueue(PAGEVIEWS_FILE, async () => {
    const pageViews = await readJsonFile<PageView>(PAGEVIEWS_FILE);
    pageViews.push(entry);
    await writeJsonFile(PAGEVIEWS_FILE, pageViews);
    return entry;
  });
}

// ----------------------------------------------------------------------------
// Contacts
// ----------------------------------------------------------------------------
export async function addContact(input: {
  name: string;
  email: string;
  message: string;
  market?: string;
}): Promise<Contact> {
  const entry: Contact = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: input.name,
    email: input.email,
    message: input.message,
    market: input.market,
  };

  if (supabaseConfigured()) {
    await sbInsert("contacts", {
      id: entry.id,
      created_at: entry.createdAt,
      name: entry.name,
      email: entry.email,
      message: entry.message,
      market: entry.market ?? null,
    });
    return entry;
  }

  return enqueue(CONTACTS_FILE, async () => {
    const contacts = await readJsonFile<Contact>(CONTACTS_FILE);
    contacts.push(entry);
    await writeJsonFile(CONTACTS_FILE, contacts);
    return entry;
  });
}

export async function getContacts(): Promise<Contact[]> {
  if (supabaseConfigured()) {
    type Row = {
      id: string;
      created_at: string;
      name: string;
      email: string;
      message: string;
      market: string | null;
    };
    const rows = await sbSelect<Row>("contacts", "select=*&order=created_at.desc");
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      name: r.name,
      email: r.email,
      message: r.message,
      market: r.market ?? undefined,
    }));
  }
  return readJsonFile<Contact>(CONTACTS_FILE);
}
