# FuelCap live app: usability review findings

Deployed build d33bf11 (https://fuel-cap-1.onrender.com). It is the same as the
local `fuel-cap-app`. Line numbers refer to `src/components/fuelcap-app.tsx`.

## Demo-breakers
| # | What happens | Where |
|---|---|---|
| 1 | Finishing "Create your profile" switches the app to the UK. The US price-rise demo and its banner disappear. UK prices take about 35 s to load, and meanwhile Austin, TX stations are shown in £/L. | :496 |
| 2 | The first lock fails: £250 in the wallet, the default 160 L × about £1.72 is about £275. The app says "Add £28.24" and sends the user back to Wallet. | :375 |
| 3 | UK pump payment uses the US demo price: "20 L filled at £3.77/L. FuelCap covered £41.42" against a £1.70 lock. Every market's pump price is the US control price + 0.35. | :427 |
| 4 | Changing market doesn't separate the data. The tank shows 140 gal from the UK lock, the wallet shows the £ number as $, and $3.42 appears next to a UK station. | :154, :323 |
| 5 | Search doesn't select the station. "SW6" shows Fulham, but the quote is still for another station, so Confirm locks the wrong one. | :248, :662 |
| 6 | The UK "Anywhere" price is £3.00/L (the single highest price). The headline and "best price" don't match the list. | :113, :572 |
| 7 | "Your advantage +$0.00/gal" is the headline figure on US Home. | :542 |
| 8 | Refreshing the page resets the wallet to $0 but keeps the locks, and onboarding shows again. | :320 |

## Ease of use
- Hard-coded stats contradict a new user's own data: "Saved $142 · 18 fills",
  "not paid full price in 6 months", "24 nearby", a 62% gauge at 0 gal, seeded
  activity, and "starter tank is ready" when the tank is empty (:324, :565, :739).
- Buttons that do nothing: Share scorecard, the bell, Filter, Manage payment
  method, and Statements / Protection details / Notifications.
- The price-drop refund can't be shown, because redemption is always priced
  above the lock.
- The protection charge isn't shown (no strike + charge = "Your FuelCap price").
- Five names for one action: Lock price / Protect fuel / Add fuel / Choose fuel
  protection / Confirm lock.
- Operator jargon: "Current open price basis", the "PRICE PROTECTION SERVICE ·
  LIVE STATUS" banner, "Source: FuelCap fallback dataset".
- Plan prices are always in £. The 7/14/30-day difference isn't on the plan
  cards, and plan station limits aren't enforced.
- The UK station list is sorted A–Z, not by nearest or cheapest. Names are in
  ALL CAPS, Tesco sites aren't labelled, and "live" prices are a month old.
- Onboarding has no Back or Cancel, and no navigation item is highlighted.
- Redeem at 0 gal still shows a QR code, and redemption is a fixed 10 gal / 20 L.

## Mobile
- The 6 bottom-nav labels overlap. "Confirm lock" is about 3 screens down the
  page.

## Performance
- A warm page load takes about 6.5 s. The Render free plan's cold start takes
  30–60 s. UK prices take about 35 s, and the ID check waits a fixed 10 s.

## Safe demo route (use it if the fixes don't land)
1. Open the site and the admin site 5 minutes beforehand.
2. Stay on US. Skip "Create your profile" and don't switch market.
3. Wallet → add $250 → Lock price → keep the preselected station → Confirm.
4. Control room → publish the price rise → back to the app, where the banner
   updates.
5. My tank → Redeem → "Retailer confirms 10 gal" → "FuelCap covered $3.50".
6. Don't tap Share, the bell or Settings.
