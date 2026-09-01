# FuelCap investor demonstration runbook

## Purpose

This runbook supports a repeatable 13-minute product demonstration using synthetic, deterministic data. It does not authorise production credentials, partner traffic, live financial execution or money movement.

## Five-minute preflight

1. Open the admin demonstrator at 100% browser zoom on a 1440 × 900 or larger display.
2. Confirm the page identifies itself as `Investor demonstrator` and says `No live money movement`.
3. Select **Start investor demo**. This restores the presenter, organisation, scenario and first workspace required by the guided story.
4. Confirm the guide reads `Act 1 of 6` and the page has no horizontal scrollbar.
5. Keep this runbook available separately. Do not expose credentials, environment variables or provider consoles during the presentation.

## The 13-minute story

The in-product guide supplies the current cue and evidence target. Use **Next act** to switch the correct scenario, role, organisation and workspace.

1. **The operating picture — 2 minutes.** Explain the customer promise and trace the market signal through pricing, protection, ledger, settlement and risk. Open one evidence drawer to show lineage.
2. **Trusted pricing inputs — 2 minutes.** Show that stale, unlicensed or conflicting data fails closed rather than becoming a quote.
3. **Governed spread decision — 3 minutes.** Run the complete spread lifecycle rehearsal. Emphasise different-checker approval, portfolio impact and accepted-quote preservation after withdrawal.
4. **Customer-to-ledger outcome — 2 minutes.** Reconcile the protected purchase, double-entry journals and safeguarding proof.
5. **Risk without autonomous execution — 2 minutes.** Show stress evidence and the paper hedge while pointing out the explicit zero-execution boundary.
6. **Release confidence and honest boundaries — 2 minutes.** Close on automated quality, cross-browser and rollback evidence. State that live providers, independent assurance and financial activation remain gated.

## Show the admin controlling the customer app

Use two browser windows side by side: the admin **Control Room** on the left and the customer demonstrator on the right. The control channel is deliberately limited to synthetic demo state; it cannot activate a live provider or move money.

1. In the admin Control Room, find **Customer app demo control** and select **Reset baseline**. Confirm both screens show the baseline market price of `$3.42` and that new quotes are available.
2. On the customer screen, point out the existing accepted quote at `$3.42`. This is the control observation for the rest of the sequence.
3. In admin, select **Publish price rise**. Within about two seconds, the customer screen changes its displayed market price to `$3.67` and identifies the admin control update.
4. In admin, select **Stop new quotes**. The customer screen disables **Confirm lock** and explains that new quotes have been withdrawn, while the accepted `$3.42` quote remains preserved.
5. Point to the admin audit line: it records the sequence, correlation ID, acting role and command. Explain that only the allowlisted demo commands can cross this bridge.
6. Select **Reset baseline** before moving to the next act or ending the presentation.

If the customer banner says **Safe baseline**, check that the admin demonstrator is reachable, then reset the baseline. The bridge state is intentionally held in memory and resets when the admin service redeploys or restarts.

## Recovery during a presentation

- If the story loses context, select **Restart demo**; it returns to the deterministic first act.
- If a workspace action is denied, explain the role boundary, then use **Restart demo** or **Next act** to restore the required principal.
- If the guide is obscuring a detail, select **Exit guide**. Restarting it restores the first act without changing external systems.
- If the hosted site is unavailable, do not improvise with production tooling. Use a previously verified recording or reschedule the live product segment.

## Claims boundary

Safe phrasing: “implemented,” “simulated,” “deterministic,” “browser-verified,” and “provider-neutral.” Do not describe the demonstrator as live, certified, pilot-approved, independently assured or authorised for real transactions.
