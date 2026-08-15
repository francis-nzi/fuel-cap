"use client";

import { useEffect, useRef, useState } from "react";
import {
  AGE_RANGE_VALUES,
  AU_STATE_VALUES,
  DRIVER_TYPE_VALUES,
  FILL_FREQUENCY_VALUES,
  GENDER_VALUES,
  STEP_ORDER,
  type StepKey,
} from "./steps";
import { captureUtmParams, getOrCreateSessionId } from "@/lib/tracking";
import { getMarket, MARKET_LIST, type Market } from "@/lib/markets";
import type { Dictionary } from "@/lib/i18n";
import type { SignupAnswers } from "@/lib/types";

type Phase = "form" | "awaiting-state" | "success";

async function postProgress(payload: Record<string, unknown>) {
  try {
    await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best-effort logging; never block the UI on network hiccups.
  }
}

export default function SignupOverlay({
  onClose,
  market,
  dict,
}: {
  onClose: () => void;
  market: Market;
  dict: Dictionary;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<SignupAnswers>({});
  const [textValue, setTextValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const sessionIdRef = useRef<string>("");
  const utmRef = useRef(captureUtmParams());

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
    utmRef.current = captureUtmParams();
    postProgress({
      sessionId: sessionIdRef.current,
      step: "started",
      utm: utmRef.current,
      landingMarket: market.id,
    });
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepKey: StepKey = STEP_ORDER[stepIndex];
  const totalSteps = STEP_ORDER.length;
  const progressPct = Math.round(((stepIndex + (phase === "success" ? 1 : 0)) / totalSteps) * 100);

  // The postal step validates against whichever country the user picked, not the page's own market.
  const selectedCountryMarket = getMarket(answers.country ?? "") ?? market;

  function persist(nextAnswers: SignupAnswers, step: StepKey, completed: boolean) {
    postProgress({
      sessionId: sessionIdRef.current,
      step,
      answers: nextAnswers,
      utm: utmRef.current,
      landingMarket: market.id,
      completed,
    });
  }

  function goToNextStep(nextAnswers: SignupAnswers, completed: boolean) {
    if (completed) {
      setPhase("success");
      return;
    }
    setTextValue("");
    setError(null);
    setStepIndex((i) => i + 1);
  }

  function handleCountryChoice(value: string) {
    const nextAnswers = { ...answers, country: value };
    setAnswers(nextAnswers);

    if (value === "australia") {
      persist(nextAnswers, "country", false);
      setPhase("awaiting-state");
      return;
    }

    persist(nextAnswers, "country", false);
    goToNextStep(nextAnswers, false);
  }

  function handleStateChoice(value: string) {
    const nextAnswers = { ...answers, state: value };
    setAnswers(nextAnswers);
    persist(nextAnswers, "country", false);
    setPhase("form");
    goToNextStep(nextAnswers, false);
  }

  function handleChoice(value: string) {
    if (stepKey === "country") {
      handleCountryChoice(value);
      return;
    }
    const nextAnswers = { ...answers, [stepKey]: value };
    setAnswers(nextAnswers);
    persist(nextAnswers, stepKey, false);
    goToNextStep(nextAnswers, false);
  }

  function validateText(key: TextStepKeyLocal, value: string): string | null {
    if (key === "zip") {
      const pattern = new RegExp(selectedCountryMarket.postalPattern, "i");
      return pattern.test(value.trim()) ? null : dict.signup.postal.errorInvalid;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : dict.signup.email.errorInvalid;
  }

  type TextStepKeyLocal = "zip" | "email";

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stepKey !== "zip" && stepKey !== "email") return;
    const validationError = validateText(stepKey, textValue);
    if (validationError) {
      setError(validationError);
      return;
    }
    const nextAnswers = { ...answers, [stepKey]: textValue.trim() };
    setAnswers(nextAnswers);
    const isLastStep = stepIndex === totalSteps - 1;
    persist(nextAnswers, stepKey, isLastStep);
    goToNextStep(nextAnswers, isLastStep);
  }

  function handleBack() {
    if (phase === "awaiting-state") {
      setPhase("form");
      return;
    }
    if (stepIndex === 0) {
      onClose();
      return;
    }
    setError(null);
    setTextValue("");
    setStepIndex((i) => i - 1);
  }

  const choiceContent = getChoiceContent(stepKey, dict);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-midnight text-white">
      <div className="flex items-center gap-3 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label={dict.signup.backAria}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg"
        >
          {stepIndex === 0 && phase !== "awaiting-state" ? "×" : "←"}
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-brand-emerald transition-all duration-300"
            style={{ width: `${phase === "success" ? 100 : progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {phase === "success" ? (
          <SuccessScreen dict={dict} onClose={onClose} />
        ) : phase === "awaiting-state" ? (
          <div className="mx-auto w-full max-w-sm">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-amber">
              {dict.signup.state.eyebrow}
            </p>
            <h2 className="font-display mb-8 text-3xl font-bold leading-tight">
              {dict.signup.state.question}
            </h2>
            <div className="flex flex-col gap-3">
              {AU_STATE_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleStateChoice(value)}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-left text-lg font-semibold transition hover:border-brand-emerald hover:bg-brand-emerald/10 active:scale-[0.99]"
                >
                  {dict.signup.state.options[value]}
                </button>
              ))}
            </div>
          </div>
        ) : stepKey === "country" ? (
          <div className="mx-auto w-full max-w-sm">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-amber">
              {dict.signup.country.eyebrow}
            </p>
            <h2 className="font-display mb-8 text-3xl font-bold leading-tight">
              {dict.signup.country.question}
            </h2>
            <div className="flex max-h-[52vh] flex-col gap-3 overflow-y-auto pr-1">
              {MARKET_LIST.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleChoice(m.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-left text-lg font-semibold transition hover:border-brand-emerald hover:bg-brand-emerald/10 active:scale-[0.99]"
                >
                  <span className="text-2xl leading-none">{m.flag}</span>
                  {dict.signup.country.options[m.id]}
                </button>
              ))}
            </div>
          </div>
        ) : choiceContent ? (
          <div className="mx-auto w-full max-w-sm">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-amber">
              {choiceContent.eyebrow}
            </p>
            <h2 className="font-display mb-8 text-3xl font-bold leading-tight">
              {choiceContent.question}
            </h2>
            <div className="flex flex-col gap-3">
              {choiceContent.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleChoice(opt.value)}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-left text-lg font-semibold transition hover:border-brand-emerald hover:bg-brand-emerald/10 active:scale-[0.99]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleTextSubmit} className="mx-auto w-full max-w-sm">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-amber">
              {stepKey === "zip" ? dict.signup.postal.eyebrow : dict.signup.email.eyebrow}
            </p>
            <h2 className="font-display mb-8 text-3xl font-bold leading-tight">
              {stepKey === "zip" ? dict.signup.postal.question : dict.signup.email.question}
            </h2>
            <input
              autoFocus
              type={stepKey === "email" ? "email" : "text"}
              inputMode={stepKey === "email" ? "email" : "text"}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={stepKey === "zip" ? selectedCountryMarket.postalPlaceholder : dict.signup.email.placeholder}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-lg font-semibold text-white placeholder:text-white/40 focus:border-brand-emerald focus:outline-none"
            />
            {error && <p className="mt-3 text-sm font-medium text-brand-coral">{error}</p>}
            <button
              type="submit"
              className="mt-6 w-full rounded-full bg-brand-emerald px-6 py-4 text-lg font-bold text-white transition hover:bg-brand-pine active:scale-[0.99]"
            >
              {stepKey === "zip" ? dict.signup.postal.cta : dict.signup.email.cta}
            </button>
            <p className="mt-4 text-center text-xs text-white/40">{dict.signup.noFeesLine}</p>
          </form>
        )}
      </div>
    </div>
  );
}

function getChoiceContent(stepKey: StepKey, dict: Dictionary) {
  switch (stepKey) {
    case "gender":
      return {
        eyebrow: dict.signup.gender.eyebrow,
        question: dict.signup.gender.question,
        options: GENDER_VALUES.map((v) => ({ value: v, label: dict.signup.gender.options[v] })),
      };
    case "ageRange":
      return {
        eyebrow: dict.signup.ageRange.eyebrow,
        question: dict.signup.ageRange.question,
        options: AGE_RANGE_VALUES.map((v) => ({ value: v, label: dict.signup.ageRange.options[v] })),
      };
    case "driverType":
      return {
        eyebrow: dict.signup.driverType.eyebrow,
        question: dict.signup.driverType.question,
        options: DRIVER_TYPE_VALUES.map((v) => ({ value: v, label: dict.signup.driverType.options[v] })),
      };
    case "fillFrequency":
      return {
        eyebrow: dict.signup.fillFrequency.eyebrow,
        question: dict.signup.fillFrequency.question,
        options: FILL_FREQUENCY_VALUES.map((v) => ({
          value: v,
          label: dict.signup.fillFrequency.options[v],
        })),
      };
    default:
      return null;
  }
}

function SuccessScreen({ dict, onClose }: { dict: Dictionary; onClose: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
      <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-brand-emerald/20">
        <span className="text-4xl">✅</span>
      </div>
      <h2 className="font-display mb-3 text-3xl font-bold leading-tight">{dict.signup.success.headline}</h2>
      <p className="mb-8 text-white/70">{dict.signup.success.body}</p>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-full bg-brand-amber px-6 py-4 text-lg font-bold text-brand-midnight transition active:scale-[0.99]"
      >
        {dict.signup.success.done}
      </button>
    </div>
  );
}
