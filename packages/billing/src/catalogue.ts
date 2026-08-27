export type BillingConcept = "CUSTOMER_FUNDING" | "PLUS_SUBSCRIPTION" | "B2B_INVOICE" | "PROTECTION_CHARGE" | "REFUND" | "WITHDRAWAL" | "FAILED_PAYMENT" | "COLLECTION" | "TAX" | "PROCESSOR_FEE" | "ACCOUNTING_EXPORT";
export type ChargeComponent = "MODELLED_PROTECTION_COST" | "MARGIN" | "BUFFER";
export type CatalogueItem = Readonly<{ itemId: string; version: number; concept: BillingConcept; name: string; currency: "USD" | "CAD" | "GBP"; amountMinor: number; billingPeriod: "ONE_TIME" | "MONTHLY" | "ANNUAL"; effectiveFrom: string; effectiveTo: string | null; active: boolean }>;
export type ComponentRate = Readonly<{ component: ChargeComponent; rateBps: number }>;
export type InvoiceLine = Readonly<{ lineId: string; concept: BillingConcept; catalogueItemId: string | null; description: string; quantity: number; unitAmountMinor: number; subtotalMinor: number; component: ChargeComponent | null; discountMinor: number; totalMinor: number; taxMinor: number; currency: "USD" | "CAD" | "GBP"; sourceReference: string }>;
export function selectCatalogueItem(items: readonly CatalogueItem[], itemId: string, at: string): CatalogueItem {
  const time = Date.parse(at); if (!Number.isFinite(time)) throw new Error("Billing effective time is invalid.");
  const matches = items.filter((i) => i.itemId === itemId && i.active && Date.parse(i.effectiveFrom) <= time && (i.effectiveTo === null || time < Date.parse(i.effectiveTo))).sort((a, b) => b.version - a.version);
  if (!matches[0]) throw new Error("No effective catalogue item was found."); return matches[0];
}
export function createCatalogueLine(item: CatalogueItem, quantity: number, sourceReference: string, taxMinor = 0): InvoiceLine {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !sourceReference.trim() || !Number.isSafeInteger(taxMinor) || taxMinor < 0) throw new Error("Invoice line requires positive quantity, source and valid tax.");
  const subtotalMinor = item.amountMinor * quantity; return { lineId: `${sourceReference}:${item.itemId}`, concept: item.concept, catalogueItemId: item.itemId, description: item.name, quantity, unitAmountMinor: item.amountMinor, subtotalMinor, component: null, discountMinor: 0, totalMinor: subtotalMinor + taxMinor, taxMinor, currency: item.currency, sourceReference };
}
export function createProtectionChargeLines(input: Readonly<{ sourceReference: string; currency: "USD" | "CAD" | "GBP"; referencePrice4dp: number; quantity4dp: number; rates: readonly ComponentRate[]; fuelCapPlus: boolean }>): readonly InvoiceLine[] {
  if (!input.sourceReference.trim() || !Number.isSafeInteger(input.referencePrice4dp) || input.referencePrice4dp <= 0 || !Number.isSafeInteger(input.quantity4dp) || input.quantity4dp <= 0) throw new Error("Protection charge requires valid source, price and quantity.");
  if (new Set(input.rates.map((r) => r.component)).size !== input.rates.length || input.rates.some((r) => !Number.isSafeInteger(r.rateBps) || r.rateBps < 0)) throw new Error("Component rates must be unique non-negative basis points.");
  return input.rates.map((rate) => { const exactNumerator = input.referencePrice4dp * input.quantity4dp * rate.rateBps; const subtotalMinor = Math.floor((exactNumerator + 5_000_000_000) / 10_000_000_000); const discountMinor = input.fuelCapPlus && rate.component === "MARGIN" ? subtotalMinor : 0; return { lineId: `${input.sourceReference}:${rate.component}`, concept: "PROTECTION_CHARGE", catalogueItemId: null, description: rate.component, quantity: 1, unitAmountMinor: subtotalMinor, subtotalMinor, component: rate.component, discountMinor, totalMinor: subtotalMinor - discountMinor, taxMinor: 0, currency: input.currency, sourceReference: input.sourceReference }; });
}
