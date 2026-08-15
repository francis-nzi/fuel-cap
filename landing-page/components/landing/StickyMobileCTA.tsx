import CTAButton from "@/components/signup/CTAButton";
import type { Dictionary } from "@/lib/i18n";

export default function StickyMobileCTA({ dict }: { dict: Dictionary }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur md:hidden">
      <CTAButton className="font-display block w-full rounded-full bg-brand-emerald px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-emerald/20 active:scale-[0.99]">
        {dict.stickyCta}
      </CTAButton>
    </div>
  );
}
