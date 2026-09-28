// Stand-in for Supabase Auth (GoTrue) used only by the admin E2E suite (no Docker/Supabase CLI needed).
// Implements the parts of the Auth REST API the control room uses, with real TOTP (RFC 6238) checks,
// HS256 access tokens carrying aal / amr / session_id, and revocable sessions.
//   node tests/admin-auth/mock-supabase-auth.mjs            (PORT, MOCK_JWT_SECRET, MOCK_SERVICE_KEY, ADMIN_E2E_SEED)
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 54329);
const JWT_SECRET = process.env.MOCK_JWT_SECRET ?? "mock-jwt-secret-for-admin-e2e-only-0000000000";
const SERVICE_KEY = process.env.MOCK_SERVICE_KEY ?? "mock-service-role-key";
const SEED = process.env.ADMIN_E2E_SEED ?? fileURLToPath(new URL("./seed.json", import.meta.url));
const TOKEN_TTL = 3600;

/* ---------- TOTP (RFC 6238, SHA-1, 30 s, 6 digits) ---------- */
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(text) {
  let bits = "";
  for (const char of text.replace(/=+$/, "").toUpperCase()) bits += BASE32.indexOf(char).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function totp(secret, at = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
const totpMatches = (secret, code) => [-1, 0, 1].some((step) => totp(secret, Date.now() + step * 30_000) === code);
const newSecret = () => Array.from(randomBytes(20), (byte) => BASE32[byte % 32]).join("");

/* ---------- JWT ---------- */
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function signJwt(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  return `${head}.${body}.${createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url")}`;
}
function readJwt(token) {
  const [head, body, mac] = (token ?? "").split(".");
  if (!head || !body || !mac) return null;
  if (createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url") !== mac) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  return payload.exp > Date.now() / 1000 ? payload : null;
}

/* ---------- State ---------- */
let users, sessions, challenges, invites;
function reset() {
  const seed = JSON.parse(readFileSync(SEED, "utf8"));
  users = new Map(seed.users.map((user) => [user.id, {
    id: user.id, email: user.email, password: user.password,
    factors: user.totpSecret ? [{ id: randomUUID(), friendly_name: "Seeded authenticator", factor_type: "totp", status: "verified", secret: user.totpSecret, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] : [],
    created_at: new Date().toISOString(),
  }]));
  sessions = new Map();
  challenges = new Map();
  invites = new Map();
}
reset();

const publicFactor = ({ secret: _secret, ...factor }) => factor;
const userJson = (user) => ({
  id: user.id, aud: "authenticated", role: "authenticated", email: user.email, email_confirmed_at: user.created_at,
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: user.metadata ?? {},
  factors: user.factors.map(publicFactor), created_at: user.created_at, updated_at: new Date().toISOString(),
});
function issue(session) {
  const user = users.get(session.userId);
  const now = Math.floor(Date.now() / 1000);
  session.refreshToken = randomBytes(24).toString("base64url");
  const access_token = signJwt({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", aal: session.aal, amr: session.amr, session_id: session.id, iat: now, exp: now + TOKEN_TTL });
  return { access_token, token_type: "bearer", expires_in: TOKEN_TTL, expires_at: now + TOKEN_TTL, refresh_token: session.refreshToken, user: userJson(user) };
}
function openSession(user, method) {
  const session = { id: randomUUID(), userId: user.id, aal: "aal1", amr: [{ method, timestamp: Math.floor(Date.now() / 1000) }], revoked: false };
  sessions.set(session.id, session);
  return session;
}

/* ---------- HTTP ---------- */
const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", "x-supabase-api-version": "2024-01-01" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const fail = (res, status, code, msg) => send(res, status, { code, msg, error_code: code });
const readBody = (req) => new Promise((resolve) => { let raw = ""; req.on("data", (chunk) => { raw += chunk; }); req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } }); });
function authed(req) {
  const claims = readJwt((req.headers.authorization ?? "").replace(/^Bearer /, ""));
  if (!claims) return null;
  const session = sessions.get(claims.session_id);
  if (!session || session.revoked) return null;
  return { claims, session, user: users.get(claims.sub) };
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req);
  try {
    // Test-only helpers.
    if (path === "/__test/reset" && req.method === "POST") { reset(); return send(res, 200, { ok: true }); }
    if (path === "/__test/invite-link" && req.method === "GET") {
      const entry = [...invites.entries()].find(([, invite]) => invite.email === url.searchParams.get("email"));
      return entry ? send(res, 200, { token_hash: entry[0], type: "invite" }) : fail(res, 404, "not_found", "No invite for that email");
    }
    if (path === "/health") return send(res, 200, { ok: true });

    if (path === "/token" && req.method === "POST") {
      if (url.searchParams.get("grant_type") === "password") {
        const user = [...users.values()].find((candidate) => candidate.email === String(body.email ?? "").toLowerCase());
        if (!user || !user.password || user.password !== body.password) return fail(res, 400, "invalid_credentials", "Invalid login credentials");
        return send(res, 200, issue(openSession(user, "password")));
      }
      if (url.searchParams.get("grant_type") === "refresh_token") {
        const session = [...sessions.values()].find((candidate) => candidate.refreshToken === body.refresh_token && !candidate.revoked);
        if (!session) return fail(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
        return send(res, 200, issue(session));
      }
      return fail(res, 400, "unsupported_grant_type", "Unsupported grant type");
    }

    if (path === "/verify" && req.method === "POST") {
      const invite = invites.get(body.token_hash);
      if (!invite || invite.used || !["invite", "recovery"].includes(body.type)) return fail(res, 403, "otp_expired", "Email link is invalid or has expired");
      invite.used = true;
      return send(res, 200, issue(openSession(users.get(invite.userId), "otp")));
    }

    if (path === "/invite" && req.method === "POST") {
      if ((req.headers.authorization ?? "") !== `Bearer ${SERVICE_KEY}`) return fail(res, 401, "not_admin", "User not allowed");
      const email = String(body.email ?? "").toLowerCase();
      if ([...users.values()].some((user) => user.email === email)) return fail(res, 422, "email_exists", "A user with this email address has already been registered");
      const user = { id: randomUUID(), email, password: null, factors: [], metadata: body.data ?? {}, created_at: new Date().toISOString() };
      users.set(user.id, user);
      invites.set(randomBytes(16).toString("hex"), { email, userId: user.id, used: false });
      return send(res, 200, userJson(user));
    }

    const adminFactors = path.match(/^\/admin\/users\/([^/]+)\/factors(?:\/([^/]+))?$/);
    if (adminFactors) {
      if ((req.headers.authorization ?? "") !== `Bearer ${SERVICE_KEY}`) return fail(res, 401, "not_admin", "User not allowed");
      const user = users.get(adminFactors[1]);
      if (!user) return fail(res, 404, "user_not_found", "User not found");
      if (req.method === "GET" && !adminFactors[2]) return send(res, 200, user.factors.map(publicFactor));
      if (req.method === "DELETE" && adminFactors[2]) {
        user.factors = user.factors.filter((factor) => factor.id !== adminFactors[2]);
        return send(res, 200, { id: adminFactors[2] });
      }
    }

    const who = authed(req);
    if (path === "/user" && req.method === "GET") return who ? send(res, 200, userJson(who.user)) : fail(res, 403, "bad_jwt", "invalid JWT");
    if (path === "/user" && req.method === "PUT") {
      if (!who) return fail(res, 403, "bad_jwt", "invalid JWT");
      if (typeof body.password === "string") who.user.password = body.password;
      return send(res, 200, userJson(who.user));
    }
    if (path === "/logout" && req.method === "POST") {
      if (who) who.session.revoked = true;
      return send(res, 204);
    }
    if (path === "/factors" && req.method === "POST") {
      if (!who) return fail(res, 403, "bad_jwt", "invalid JWT");
      const hasVerified = who.user.factors.some((factor) => factor.status === "verified");
      if (hasVerified && who.session.aal !== "aal2") return fail(res, 422, "insufficient_aal", "AAL2 required to enroll a new factor");
      const factor = { id: randomUUID(), friendly_name: body.friendly_name, factor_type: "totp", status: "unverified", secret: newSecret(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      who.user.factors.push(factor);
      const uri = `otpauth://totp/${encodeURIComponent(body.issuer ?? "FuelCap")}:${encodeURIComponent(who.user.email)}?secret=${factor.secret}&issuer=${encodeURIComponent(body.issuer ?? "FuelCap")}`;
      return send(res, 200, { id: factor.id, type: "totp", friendly_name: factor.friendly_name, totp: { qr_code: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#eee"/><text x="10" y="95" font-size="10">mock QR</text></svg>`, secret: factor.secret, uri } });
    }
    const factorMatch = path.match(/^\/factors\/([^/]+)(\/challenge|\/verify)?$/);
    if (factorMatch) {
      if (!who) return fail(res, 403, "bad_jwt", "invalid JWT");
      const factor = who.user.factors.find((candidate) => candidate.id === factorMatch[1]);
      if (!factor) return fail(res, 404, "mfa_factor_not_found", "Factor not found");
      if (req.method === "DELETE" && !factorMatch[2]) {
        if (factor.status === "verified" && who.session.aal !== "aal2") return fail(res, 422, "insufficient_aal", "AAL2 required");
        who.user.factors = who.user.factors.filter((candidate) => candidate.id !== factor.id);
        return send(res, 200, { id: factor.id });
      }
      if (factorMatch[2] === "/challenge") {
        const challenge = { id: randomUUID(), factorId: factor.id, userId: who.user.id, expires: Date.now() + 5 * 60_000 };
        challenges.set(challenge.id, challenge);
        return send(res, 200, { id: challenge.id, type: "totp", expires_at: Math.floor(challenge.expires / 1000) });
      }
      if (factorMatch[2] === "/verify") {
        const challenge = challenges.get(body.challenge_id);
        if (!challenge || challenge.factorId !== factor.id || challenge.expires < Date.now()) return fail(res, 422, "mfa_challenge_expired", "Challenge expired");
        challenges.delete(challenge.id);
        if (!totpMatches(factor.secret, String(body.code ?? ""))) return fail(res, 422, "mfa_verification_failed", "Invalid TOTP code entered");
        factor.status = "verified";
        who.session.aal = "aal2";
        who.session.amr = [...who.session.amr.filter((entry) => entry.method !== "totp"), { method: "totp", timestamp: Math.floor(Date.now() / 1000) }];
        return send(res, 200, issue(who.session));
      }
    }
    return fail(res, 404, "not_found", `No mock for ${req.method} ${path}`);
  } catch (error) {
    return fail(res, 500, "unexpected_failure", error instanceof Error ? error.message : String(error));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`mock Supabase Auth on http://127.0.0.1:${PORT}`));
