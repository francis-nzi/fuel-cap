import path from "node:path";

// Test-only settings: the admin app talks to the mock Supabase Auth server and keeps staff/audit in memory.
export const MOCK_AUTH_PORT = 54329;
export const ADMIN_SEED = path.resolve(__dirname, "seed.json");
export const ADMIN_SESSION_SECRET = "e2e-session-secret-not-for-production-0000000000";
export const MOCK_SERVICE_KEY = "mock-service-role-key";
export const MOCK_AUTH_URL = `http://127.0.0.1:${MOCK_AUTH_PORT}`;

export const adminE2eEnv = {
  ADMIN_SUPABASE_URL: MOCK_AUTH_URL,
  ADMIN_SUPABASE_ANON_KEY: "mock-anon-key",
  ADMIN_SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_KEY,
  ADMIN_SESSION_SECRET,
  ADMIN_SITE_URL: "http://127.0.0.1:3001",
  ADMIN_E2E: "true",
  ADMIN_DATA_BACKEND: "memory",
  ADMIN_E2E_SEED: ADMIN_SEED,
};

export const mockAuthServer = {
  command: "node tests/admin-auth/mock-supabase-auth.mjs",
  url: `${MOCK_AUTH_URL}/auth/v1/health`,
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
  env: { PORT: String(MOCK_AUTH_PORT), MOCK_SERVICE_KEY, ADMIN_E2E_SEED: ADMIN_SEED },
};
