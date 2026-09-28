# FuelCap customer app — redesign build brief

Owner: Francis Doherty · Prepared 27 Sep 2026 · Demo: Tuesday 29 Sep 2026

**Files that come with this brief (same folder):**
- `REDESIGN_BRIEF.md`: this file, the spec.
- `prototype/Main.dc.html`: a clickable mockup of the target design. It is a
  reference for layout, copy and behaviour, not code to paste in. The whole
  flow logic is in the `<script>` block at the bottom (`confirmProtect`,
  `doFill`, the receipt logic). Screens are the `<sc-if>` blocks.
- `REVIEW_FINDINGS.md`: the usability review of the live app (d33bf11) with
  line references into `src/components/fuelcap-app.tsx`.

**Target code:** `fuel-cap-app/src/components/fuelcap-app.tsx` (835 lines). It is
deployed at https://fuel-cap-1.onrender.com.

---

## Ground rules

1. Work in two phases. Commit Phase 1 and deploy it on its own before you start
   Phase 2. **Phase 1 must be live and stable by Monday evening.** Only do
   Phase 2 if Phase 1 is done and there is time left. Otherwise Phase 2 goes on
   a branch.
2. Don't write to the shared demo data or the control-room customer record
   while testing. Use the E2E flag (`NEXT_PUBLIC_FUELCAP_E2E`) or a local store.
3. Keep `tsc --noEmit` clean and keep the existing Playwright/Vitest suites
   passing. Add tests for every acceptance check below that can be automated.
4. US market, dollars and gallons is the demo path. Don't break UK or Canada,
   but they don't have to be polished.
5. Tell the truth on screen. No hard-coded stats and no fake history. Label the
   app as a demonstrator ("DEMO", simulated money).

---

## Phase 1: pre-Tuesday fixes to the current app (about half a day)

| # | Fix | Where (current file) |
|---|-----|------|
| 1 | Finishing onboarding must **not** call `changeMarket("GB")`. Keep the current market. | :496 |
| 2 | If the wallet is short when locking, offer to add funds in the same step: "Add $X & protect". Don't send the user back to Wallet. | :375 |
| 3 | The pump price at redemption must come from the **selected market's** price, not the US control price + 0.35. | :427 |
| 4 | Keep wallet, tank, locks and transactions **separately for each market** (key the state by `marketCode`). | :154, :323 |
| 5 | Choosing a search result must **select that station**, and the quote must follow the selected station. | :248, :662 |
| 6 | UK "Anywhere" price: use the median or a representative price, not the highest one. The headline and the "best price" must use the same source as the list. | :113, :572 |
| 7 | Remove "Your advantage +$0.00". Only show an advantage figure when it's positive and real. | :542 |
| 8 | Keep customer state across a page refresh (localStorage in demo mode is fine), and don't show onboarding again once it's done. | :320 |
| 9 | Remove the hard-coded "Saved $142 / 18 fills / 6 months / 24 nearby / 62% gauge / seeded activity", and "starter tank is ready" when the tank is empty. Show empty states instead. | :324, :565, :739 |
| 10 | Hide the buttons that do nothing: Share, bell, Filter, Manage payment, and the menu rows. Or make them work. | various |
| 11 | Add the protection charge line to the lock screen (see the pricing rules below). | LockView |
| 12 | Redeem with 0 gal: show an empty state, not a QR code. | TankView / redeem modal |

---

## Phase 2: the redesign (follow the prototype)

### Navigation
- **4 bottom tabs:** Home · Protect · Pay · Activity. Account/Settings sits
  behind an avatar button in the header.
- **One verb everywhere: "Protect".** Remove Lock price / Add fuel /
  Choose fuel protection / Confirm lock.
- Wallet stops being its own destination. Its balance shows on Home, and money
  is added inside the Protect flow.
- The header shows the logo, a `DEMO · US $` pill and the avatar.

### Screens

**Home: first use (nothing protected yet)**
- Title: "Cap your fuel price. Never overpay."
- Dark card: pump price now at the nearest station, and the line "Protect today
  and you'll never pay more than $3.68/gal for 7 days. If the price falls, you
  just pay the lower price." Button: **Protect my fuel**.
- "How it works" in 3 steps, and the wallet balance.

**Home: with an active protection**
- "Your fuel is capped". Card: YOUR MAX PRICE $3.68/gal · "25 gal at Shell
  Downtown" · "7 days left" pill.
- Pump price now, plus a status that changes with the pump price:
  - below the cap: "Pump is below your cap · You pay $3.40"
  - between the cap and the limit: "FuelCap covers $0.22/gal"
  - above the limit: "Above your limit · Covered to $4.03"
- Buttons: **Pay at pump** (primary) and Protect more.
- Two tiles: protected fuel (gallons + $ held for it) and wallet (free to use).
- A "Saved with FuelCap so far" card with a Share button. It **only appears
  once there are real savings.**

**Protect** (one screen, with the button fixed at the bottom so it never scrolls away)
1. Station list, **nearest first**, with tags ("Nearest", "Cheapest") and a
   clear selected state. If a protection is already active, the station stays
   fixed ("Adding to your Shell Downtown protection").
2. How much fuel: chips 10 / 15 / 25 / 40 gal. Helper text: "A typical full
   tank is about 15 gal."
3. Summary:
   - Your max price: $3.68/gal ("5% above today's $3.50")
   - Held for your fuel: 25 gal × $3.68 = $91.88 ("Unused money stays yours")
   - Protection charge: $0.08/gal, one-off = $2.01
   - **Total from wallet: $93.89**
   - If the wallet is short: "Your wallet has $0.00. We'll add $100.00 from
     your card ending 4242 in the same step."
4. Three plain lines: price rises → we pay the difference up to $4.03/gal ·
   price falls → you pay the lower pump price · your money never expires.
- Button: "Add $100.00 & protect 25 gal", or "Protect 25 gal · $93.89".

**Done:** a check mark, "25 gal protected", "You'll never pay more than
$3.68/gal at Shell Downtown until Sun 4 Oct." Buttons: Pay at pump now /
Back to home.

**Pay**
- Empty state if nothing is protected (no QR code).
- Otherwise: station + pump number, a QR code, and the fallback code
  `FC-4821`. Fill chips: 10 / 20 / All N gal. Pump price now. Fixed button:
  "Start fill · 20 gal (simulated)".

**Receipt:** this is the viral moment and needs the most attention.
- **Rise** (pump $3.90): dark card, "PRICE ROSE · HEADS YOU WIN",
  **"FuelCap covered $4.50"**.
- **Spike past the limit** (pump $4.20): "FuelCap covered $7.00". Say plainly
  that the $0.17/gal above $4.03 came from the wallet.
- **Fall** (pump $3.40): **Drop Coral `#FF5C48` card** (the only place coral
  is used), "PRICE DROPPED · TAILS YOU WIN", **"$5.50 back in your wallet"**.
- Breakdown rows: pump total · paid from protected fuel · paid by FuelCap ·
  above your limit (from wallet) · returned to your wallet. Hide rows that
  are zero.
- Buttons: **Share my win** (it must work, at least with the Web Share API or
  copy-link) and Done.

**Activity:** real transactions only, newest first. Empty state: "No activity yet."

**Account:** plan (Standard · 7-day cap · Free), country, card, auto-rollover
(On · 48h notice). Changing country opens a **separate wallet** in that
currency.

### Demo / presenter mode (replaces switching to the control room)
- Add a presenter panel, shown only with `?demo=1` or a keyboard toggle, never
  to real users. On desktop it sits beside the phone view. It has:
  - 4 pump-price buttons: $3.40 (falls, Case C) · $3.50 (today) · $3.90
    (rises, Case A) · $4.20 (spike, Case B)
  - A run-of-show checklist that ticks itself off: protect → move price → pay
    → show a fall → share
  - A **Reset demo** button
- It can still publish to the control room, but the demo must **work without
  the second service** being awake.

---

## Pricing and settlement rules (these must match the Cost of Protection doc §5.3)

All amounts are kept to 4 decimal places internally and shown in cents,
rounding half up. Be careful with floating point: `toFixed(2)` on 3.675
returns 3.67. Use integer minor units or a rounding helper.

| Term | Formula | Demo value (ref $3.50) |
|---|---|---|
| Reference price (today's pump price) | station price | $3.50 |
| **Max price / cap (strike)** | ref × 1.05 | $3.675 → **$3.68** |
| **Protection limit (boundary)** | ref × 1.15 | $4.025 → **$4.03** |
| **Protection charge / gal** | ref × 0.023 | $0.0805 → **$0.08** |
| Held for fuel | gal × strike | 25 × 3.675 = $91.875 → $91.88 |
| Charge (one-off, not refundable) | gal × charge/gal | $2.0125 → $2.01 |
| Total from wallet | held + charge | $93.89 |
| Top-up if short | max($100, round the shortfall up to the next $50) | $100 |

**At the pump** (fill g gal at pump price P, strike S, limit B):
- **P < S (fall):** the member pays P × g from the held money, and
  **(S − P) × g goes back to the wallet**. FuelCap pays $0.
- **S ≤ P ≤ B (rise):** the member pays S × g, and FuelCap pays (P − S) × g.
- **P > B (spike):** the member pays S × g plus (P − B) × g from the wallet,
  and FuelCap pays (B − S) × g, which is the most it will pay.
- After every fill: held money −= S × g, protected gallons −= g. When the
  gallons reach 0, the protection closes.

**Acceptance numbers (20 gal fill after protecting 25 gal):**
| Case | Pump | Station total | Member pays | FuelCap pays | Back to wallet |
|---|---|---|---|---|---|
| A: rise | $3.90 | $78.00 | $73.50 | **$4.50** | — |
| B: spike | $4.20 | $84.00 | $77.00 ($73.50 + $3.50) | **$7.00** | — |
| C: fall | $3.40 | $68.00 | $68.00 | $0.00 | **$5.50** |

Starting from a $0 wallet: after protecting, the wallet is $6.11 and $91.88 is
held. After Case C, the wallet is $11.61, 5 gal stay protected and $18.38 is
held.

---

## Brand and accessibility

- Colours: Emerald `#0BA75E`, Deep Pine `#0B7A4B` (use it for primary buttons
  with white text, because Emerald with white text fails contrast), Midnight
  `#0B1B2B`, Signal Amber `#FFC24B` (wins and share), **Drop Coral `#FF5C48`
  only for the price-drop moment**, Mint `#DFF5E9`.
- Type: Space Grotesk (headings and numbers) + Inter (body).
- Touch targets ≥ 44 px, text contrast ≥ 4.5:1, real `<button>` elements, and
  `aria-label` on icon-only buttons.
- Don't show operator wording to customers. Remove "Current open price basis",
  "PRICE PROTECTION SERVICE · LIVE STATUS", and "Source: FuelCap fallback
  dataset" on the US screens.

## Performance (before the demo)
- The Render free plan sleeps after inactivity. Upgrade to a paid instance, or
  add a keep-alive ping.
- Load the UK prices in the background and don't block the UI on them. Cut
  the fixed 10-second ID-check wait to about 3 s in demo mode.

## Definition of done
- Phase 1: all 12 fixes are in and tested, and the "happy route" in
  `REVIEW_FINDINGS.md` runs twice in a row on the deployed site with no errors.
- Phase 2: a click-through matches the prototype, and all three acceptance
  cases give exactly the figures above.
- Send Francis a short change log and the deployed commit hash.
