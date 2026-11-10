---
title: '42.4 — Filter and hide cancelled parties'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: 'c7da9e9e97a618d972765e4abbffca04bfaea86a'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-42-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Cancelled parties (status ANNULEE, story 42.2) cannot be filtered on, and the "hide finished" checkbox leaves them cluttering the home list (FR16, UX-DR14).

**Approach:** ⚠️ On the validated home list (web only): the "Phase" filter gains "Annulée"; the existing checkbox (`dashboard.hide_finished_label`, per-theme wording) also hides cancelled parties and its label says so in the three themes; the reveal button and its "any hidden?" test count them too. The user's saved preference keeps its current meaning (no server or schema change). Filters apply to quests and ralliements alike; a JDR party is never ANNULEE.

</frozen-after-approval>

## Implementation Notes

- Implemented directly in the session (one-shot route; no implementation or review subagents: this run only allows them on an explicit user request).
- Web only. `Dashboard.isFinishedOrCancelled` (terminée ou annulée) now drives the hide checkbox and `hasHiddenFinished` (the reveal button), both still honouring the role and genre filters. The "Phase" select gains the `ANNULEE` option (label = the neutral `dashboard.status_cancelled_badge`). The checkbox and reveal-button labels now say « … et annulés/annulées » in the 3 themes. The saved `hideFinishedParties` preference is untouched (same name, same value); its scope widens. A JDR party is never ANNULEE, so nothing changes for quests beyond the checkbox wording.
- ⚠️ Intended change to a validated screen: two labels per theme (`dashboard.hide_finished_label`, `dashboard.show_finished_btn`) and one added filter option.
- Results: web suite green apart from the 2 known date failures (`calendar-view.spec`); `ng build` compiles; API untouched.
- Not done: visual check in Chrome; `/code-review` to run.

## Review Triage Log

Inline review (no reviewer subagents in this run).

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind | The preference is still named `hideFinishedParties`, so users who ticked it before now also hide cancelled parties | low | Intended by the story (« préférence enregistrée garde son comportement actuel ») and by UX-DR14; the label states it | reject |
| 2 | blind | The « Phase » filter does not reflect that a filter on « Terminées » excludes cancelled ones | false | The filter compares the exact status; two separate options, as the UX asks | reject |
| 3 | edge | With the status filter on « Annulée », the hide checkbox could hide everything | false | The hiding applies only when the status filter is « all » (existing rule, unchanged) | reject |

