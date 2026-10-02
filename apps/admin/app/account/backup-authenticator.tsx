"use client";

import { useState } from "react";
import { EnrolAuthenticator } from "@/components/auth/mfa-forms";

export function BackupAuthenticator() {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="auth-secondary" onClick={() => setOpen(true)}>Add a backup authenticator</button>;
  return <EnrolAuthenticator backup onDone={() => window.location.reload()} />;
}
