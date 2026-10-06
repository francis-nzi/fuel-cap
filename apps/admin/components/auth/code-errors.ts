/** What to tell someone whose authenticator code was refused, by the API's error code (see lib/auth/mfa.ts). */
export type CodeContext = "enrol" | "sign_in" | "step_up";

/** True when the session has ended and the person should be sent back to sign in. */
export const sessionEnded = (error?: string) => error === "UNAUTHENTICATED" || error === "SESSION_EXPIRED";

export function codeErrorMessage(context: CodeContext, error?: string, reference?: string) {
  switch (error) {
    case "INVALID_CODE":
      if (context === "enrol") return "That code didn't match this QR code. Use the entry you just added. If your app also has an older \"FuelCap Control Room\" entry from an earlier attempt, delete it: only the newest one works.";
      if (context === "step_up") return "That code didn't work. Check your authenticator app and try the current code.";
      return "That code didn't match. Try the current code in your authenticator app.";
    case "SETUP_EXPIRED":
      return "This setup has expired: a newer QR code replaced it. Reload the page for a new QR code, and delete the old \"FuelCap Control Room\" entry from your app.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many attempts. Wait a few minutes, then try again with the current code.";
    default:
      return `We couldn't check your code just now. This isn't a problem with your code. Try again in a minute; if it keeps happening, tell a platform administrator${reference ? ` (reference: ${reference})` : ""}.`;
  }
}
