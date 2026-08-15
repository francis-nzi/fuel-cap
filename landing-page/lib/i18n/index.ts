import type { LanguageCode } from "../markets";
import type { Dictionary } from "./types";
import en from "./en";
import fr from "./fr";
import de from "./de";
import es from "./es";
import it from "./it";

const DICTIONARIES: Record<LanguageCode, Dictionary> = { en, fr, de, es, it };

export function getDictionary(language: LanguageCode): Dictionary {
  return DICTIONARIES[language] ?? DICTIONARIES.en;
}

/**
 * Simple {token} interpolation. Capitalized token names (e.g. {FuelWord})
 * resolve to the capitalized form of the matching lowercase variable —
 * lets one `vars.fuelWord` value fill both sentence-start and mid-sentence
 * slots without keeping duplicate capitalized copies of every string.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const isCapitalized = key[0] === key[0].toUpperCase();
    const lookupKey = isCapitalized ? key[0].toLowerCase() + key.slice(1) : key;
    const value = vars[lookupKey] ?? "";
    if (!isCapitalized || !value) return value;
    return value[0].toUpperCase() + value.slice(1);
  });
}

export type { Dictionary };
