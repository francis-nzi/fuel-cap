// Protection pricing and pump settlement (Cost of Protection §5.3).
// Amounts are held to 4 dp internally and shown in cents, rounding half up.

export const STRIKE_MARKUP = 0.05;
export const BOUNDARY_MARKUP = 0.15;
export const CHARGE_RATE = 0.023;

function roundHalfUp(value: number, dp: number) {
  const factor = 10 ** dp;
  // The epsilon absorbs binary drift, e.g. 3.675 * 100 = 367.49999999999994.
  return (Math.sign(value) * Math.round(Math.abs(value) * factor + 1e-7)) / factor;
}

export const round4 = (value: number) => roundHalfUp(value, 4);
export const cents = (value: number) => roundHalfUp(value, 2);

export type Quote = {
  reference: number;
  strike: number;
  boundary: number;
  chargePerUnit: number;
  volume: number;
  held: number;
  charge: number;
  total: number;
};

export function quoteProtection(reference: number, volume: number): Quote {
  const strike = round4(reference * (1 + STRIKE_MARKUP));
  const boundary = round4(reference * (1 + BOUNDARY_MARKUP));
  const chargePerUnit = round4(reference * CHARGE_RATE);
  const held = round4(volume * strike);
  const charge = round4(volume * chargePerUnit);
  // The wallet is debited in cents; FuelCap absorbs the sub-cent remainder.
  return { reference, strike, boundary, chargePerUnit, volume, held, charge, total: cents(cents(held) + cents(charge)) };
}

/** Top-up when the wallet is short: at least 100, otherwise the shortfall rounded up to the next 50. */
export function topUpFor(total: number, wallet: number) {
  const shortfall = cents(total - wallet);
  if (shortfall <= 0) return 0;
  return Math.max(100, Math.ceil(shortfall / 50) * 50);
}

export type FillOutcome = "fall" | "cap" | "rise" | "spike";

export type Settlement = {
  outcome: FillOutcome;
  volume: number;
  pumpPrice: number;
  stationTotal: number;
  fromProtected: number;
  fromWallet: number;
  coveredByFuelCap: number;
  returnedToWallet: number;
  heldReleased: number;
};

export function settleFill(volume: number, pumpPrice: number, strike: number, boundary: number): Settlement {
  const stationTotal = cents(volume * pumpPrice);
  const heldReleased = round4(volume * strike);
  if (pumpPrice < strike) {
    const fromProtected = cents(volume * pumpPrice);
    return { outcome: "fall", volume, pumpPrice, stationTotal, fromProtected, fromWallet: 0, coveredByFuelCap: 0, returnedToWallet: cents((strike - pumpPrice) * volume), heldReleased };
  }
  const fromProtected = cents(heldReleased);
  if (pumpPrice <= boundary) {
    return { outcome: pumpPrice === strike ? "cap" : "rise", volume, pumpPrice, stationTotal, fromProtected, fromWallet: 0, coveredByFuelCap: cents((pumpPrice - strike) * volume), returnedToWallet: 0, heldReleased };
  }
  return { outcome: "spike", volume, pumpPrice, stationTotal, fromProtected, fromWallet: cents((pumpPrice - boundary) * volume), coveredByFuelCap: cents((boundary - strike) * volume), returnedToWallet: 0, heldReleased };
}
