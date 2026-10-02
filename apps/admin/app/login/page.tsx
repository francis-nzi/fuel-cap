import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  timeout: "You were signed out after 30 minutes without activity. Sign in again to continue.",
  LINK_INVALID: "That link has expired or was already used. Ask a platform administrator to send a new invite.",
  NOT_STAFF: "This account doesn't have access to the control room.",
  ROLE_ASSIGNMENT_CONFLICT: "Your roles can't be combined in this environment. Ask a platform administrator to fix your access.",
  AUTH_NOT_CONFIGURED: "Sign-in isn't configured on this server yet.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string; error?: string }> }) {
  const { reason, error } = await searchParams;
  const notice = notices[reason ?? ""] ?? notices[error ?? ""];
  return (
    <AuthShell title="Sign in" lead="Use the email and password from your staff invite. You'll then confirm with your authenticator app.">
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      <LoginForm />
    </AuthShell>
  );
}
