---
title: 'Story 45.7 — Comprendre ce qu’on crée'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: '8c0132fa01d975c1101a8c81c1bfda8ed1689606'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-45-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The creation form names its two modes (Quête / Sentier / Mission, Ralliement / Veillée / Rassemblement) and its natures (Quête unique, Chronique, La conjonction des Esprits…) only with the words of the active theme; someone who has not learned that vocabulary cannot tell what each choice creates.

**Approach:** Keep the theme names and add a plain-language line under each, identical in the three themes: the mode switch shows « Jeu de rôle » / « Soirée entre amis » under the theme name, and every nature shows its explanation line — in the creation form and wherever the nature is shown for editing (`partie-form` in edit mode).

## Boundaries & Constraints

**Always:**
- `partie-form` only (`partie-form.{ts,html,scss}`): creation and edition share this form. The mode switch exists at creation only (the mode is final); the nature list exists in both.
- Mode switch: each option on two lines — the theme name (14 px / 500) then the plain line (12 px, muted: `var(--mat-sys-on-surface-variant)`) — option height 56 px, still two full-width options, 44 px touch targets, same order. Lines: `Jeu de rôle` (quest mode), `Soirée entre amis` (ralliement mode).
- Nature: under each option's theme name, its explanation line, inside the same toggle button (two lines, wrapping, left aligned); the chosen option keeps its line visible; a disabled option keeps its line and its refusal reason below stays as is. Texts (EXPERIENCE §2.7): ONE_SHOT « Une seule séance : l'histoire commence et se termine le même soir. » · CAMPAGNE_LINEAIRE « Une histoire suivie sur plusieurs séances, avec la même troupe. » · CAMPAGNE_EPISODIQUE « Plusieurs séances complètes chacune ; les joueurs peuvent changer d'une séance à l'autre. » · soirée isolée (ralliement ONE_SHOT) « Un rendez-vous unique : on invite, on trouve une date, et c'est fini. » · groupe (ralliement CAMPAGNE_EPISODIQUE) « Une bande d'amis durable : chaque membre peut proposer des rencontres, chez lui, quand il veut. »
- Tone keys: `partie.mode_plain_quete`, `partie.mode_plain_ralliement`, `partie.kind_plain_{ONE_SHOT,CAMPAGNE_LINEAIRE,CAMPAGNE_EPISODIQUE}`, `partie.ralliement_kind_plain_{ONE_SHOT,CAMPAGNE_EPISODIQUE}`; the same text in the three themes, listed in `NEUTRAL_KEYS` with the reason « explication en clair, volontairement hors thème »; the three ralliement-mode keys (`mode_plain_ralliement`, `ralliement_kind_plain_*`) contain no JDR word (MJ, campagne, scénario, séance, joueur, quête, troupe) and no « partie » — a test enforces it.
- Theme names, labels, refusal reasons, the order of fields, validation, the conversion matrix and every other form behaviour are unchanged; existing specs that read toggle labels read the name line.
- Accessibility: the plain line is part of each option's accessible name; the two-line option is never truncated at 375 px; `prefers-reduced-motion` and contrast follow the existing toggles (muted colour passes AA on the three themes' surfaces).
- French comments; no dependency; Docker only (PowerShell if Bash is down); no API, shared or route change.

**Never:**
- No change to what `kind` / `gameSystemId` mean or to the registry; no new field; no text outside the form (dashboard, party page) — only the form and its edit mode.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Creation, quest mode | form opened | switch shows « Quête » over « Jeu de rôle » and « Ralliement » over « Soirée entre amis » (names per theme); three natures each with its line | N/A |
| Creation, ralliement mode | switch to ralliement | two natures, soirée and groupe lines, no JDR word | N/A |
| Chosen nature | pick a nature | its line stays visible, the others too | N/A |
| Edition of a JDR party | edit | no mode switch; natures with their lines; disabled ones keep line + reason | refusal reasons unchanged |
| Edition of a ralliement | edit | natures disabled (final) but with their lines | N/A |
| Three themes | switch theme | plain lines identical, names differ | N/A |
| Phone 375 px | any | options two lines, wrapped, never truncated, 56 px / 44 px targets | N/A |

</frozen-after-approval>

## Code Map

- `features/parties/partie-form/partie-form.html` -- mode toggle (`mode-toggle`) and kind toggle (`kind-toggle`) buttons: wrap each label in `.option-name` and add `.option-plain`; mode label keys `partie.mode_quete` / `partie.mode_ralliement` stay.
- `features/parties/partie-form/partie-form.ts` -- a `kindPlain(kind)` method next to `kindLabel(kind)` (ralliement vs quest key); nothing else.
- `features/parties/partie-form/partie-form.scss` -- `.mode-toggle` height 56 px, `.option-name` 14 px / 500, `.option-plain` 12 px muted, wrapping for the kind toggle.
- `core/theme/tones/*.ts` (3 files, same text) + `core/theme/theme-tone.service.spec.ts` -- the 7 keys, `NEUTRAL_KEYS` entries, the no-JDR-word test for the three ralliement keys.
- `features/parties/partie-form/partie-form.spec.ts` -- label helper reads `.option-name` (l.804-860); new tests for the lines.
- Do not touch: other screens, `partie-detail`, the dashboard, API, shared.

## Tasks & Acceptance

**Execution:**
- [x] tones (3 themes) + tone spec -- 7 neutral keys and the no-JDR-word guard
- [x] `partie-form.{html,ts,scss}` -- two-line mode switch, nature lines, 56 px / 14-12 px
- [x] `partie-form.spec.ts` -- adapt label reads; every matrix row
- [x] full web suite, typecheck, lint

**Acceptance Criteria:**
- Given I open the creation form in any theme, when I look at the mode switch, then each option shows its theme name over « Jeu de rôle » or « Soirée entre amis ».
- Given I look at the natures, then each shows its explanation line, the chosen one keeps it, and the ralliement ones use no JDR word.
- Given I edit a party, then its natures show the same lines and the mode switch is absent.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the review layers were replaced by one inline self-review of the diff. Work ran through PowerShell (Bash unavailable).
- Tones: 7 keys (`partie.mode_plain_{quete,ralliement}`, `partie.kind_plain_{ONE_SHOT,CAMPAGNE_LINEAIRE,CAMPAGNE_EPISODIQUE}`, `partie.ralliement_kind_plain_{ONE_SHOT,CAMPAGNE_EPISODIQUE}`), the same text in the three theme files, listed in `NEUTRAL_KEYS` with the reason, exempted from the voice (vouvoiement/tutoiement) lint like the other contractual keys (the Forêt lint would otherwise reject « rendez-vous »), and a new tone test: identical in the three themes, no JDR word or « partie » in the three soirée keys (with a guard that the JDR lines do trip the regex).
- `partie-form`: each mode and nature button holds `.option-name` and `.option-plain` (the plain line is part of the accessible name); `kindPlain(kind)` next to `kindLabel`; styles 14 px / 500 name, 12 px muted line, mode options 56 px, natures auto-height and wrapping. `.mat-button-toggle-label-content` and `.mat-button-toggle-button` belong to Material's template, so the rules use `::ng-deep` bounded to `.mode-toggle` / `.kind-toggle` (the existing encapsulated `.mat-button-toggle-button` rule was a no-op). Existing label tests read `.option-name`.
- Specs: 7 form tests (three themes for the mode switch, quest natures and the chosen one, ralliement natures without JDR words, identical lines / different names across themes, JDR edition, ralliement edition, disabled nature with its reason).
- Visual check 2026-10-25 (Chrome, real account, Atelier Cuivré): at desktop width the switch shows « Rassemblement / Soirée entre amis » and « Mission / Jeu de rôle » on two lines, the three natures each carry their line, the ralliement natures show « La réunion d'établi » and « Le grand chantier » with their lines; at the narrowest width the window allows (500 px) the mode options measure 56 px, nothing overflows horizontally and the longest line wraps (natures 56 / 66 px). A first look showed the two lines side by side — Material's inner elements are outside the component's style encapsulation — which led to the `::ng-deep` rules. Not exercised: 375 px (the browser pane's minimum is 500 px), the other two themes, the edition screen in a browser.
- Verification: web typecheck (app and spec) OK; full web suite OK except the 3 known date-dependent failures; eslint: only formatting findings that predate the story. No API, shared or route change.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | The two lines rendered side by side, not stacked | high | seen in Chrome; Material's inner elements ignore component-scoped rules; fixed with bounded `::ng-deep`, re-checked live |
| 2 | Mode options measured 50 px, not 56 | medium | the height token did not reach Material's button; `min-height` on `.mat-button-toggle-button` under `::ng-deep`; measured 56 px |
| 3 | Forêt lint rejects « rendez-vous » in a neutral line | medium | the plain keys join the contractual exemptions of the voice lint, with the reason written |
| 4 | « troupe » may leak into a soirée line | low | the new tone test bans it (and the JDR words) for the three soirée keys |
| 5 | The plain line lengthens the natures on a phone | low | wrapping, auto height; no horizontal overflow measured at 500 px |
| 6 | Two themes and 375 px not checked in a browser | low | the lines are one neutral text and the layout rules are theme-independent; noted, not exercised |

## Design Notes

Decided without the human: the nature line lives inside each toggle button (a second line) rather than between buttons, so the toggle group stays a valid group and the line is part of the accessible name; keys are neutral (one text for three themes, `NEUTRAL_KEYS`) as the UX note asks; « troupe » joins the banned list for ralliement lines (it is JDR vocabulary in the themes); the plain line of a mode is shown only at creation (no switch at edition).

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` and `tsc --noEmit -p tsconfig.app.json` / `tsconfig.spec.json` -- expected: pass (3 known date-dependent failures excepted)

**Manual checks (if no CLI):**
- Creation form in the three themes at 375 px and at desktop width; edit of a JDR party and of a ralliement.
