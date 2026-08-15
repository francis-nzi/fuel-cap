"use client";

import { useSignup } from "./SignupContext";

export default function CTAButton({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { openSignup } = useSignup();
  return (
    <button type="button" onClick={openSignup} className={className}>
      {children}
    </button>
  );
}
