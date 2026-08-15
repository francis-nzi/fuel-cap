"use client";

import { createContext, useContext, useState, useCallback } from "react";
import SignupOverlay from "./SignupOverlay";
import type { Dictionary } from "@/lib/i18n";
import type { Market } from "@/lib/markets";

type SignupContextValue = {
  openSignup: () => void;
  closeSignup: () => void;
  market: Market;
  dict: Dictionary;
};

const SignupContext = createContext<SignupContextValue | null>(null);

export function useSignup() {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error("useSignup must be used within SignupProvider");
  return ctx;
}

export default function SignupProvider({
  market,
  dict,
  children,
}: {
  market: Market;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const openSignup = useCallback(() => setIsOpen(true), []);
  const closeSignup = useCallback(() => setIsOpen(false), []);

  return (
    <SignupContext.Provider value={{ openSignup, closeSignup, market, dict }}>
      {children}
      {isOpen && <SignupOverlay onClose={closeSignup} market={market} dict={dict} />}
    </SignupContext.Provider>
  );
}
