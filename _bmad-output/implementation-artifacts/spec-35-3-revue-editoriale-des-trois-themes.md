---
title: 'Editorial review of the three themes'
type: 'feature'
created: '2026-10-06'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'c9ba72730a5c097b35758b9fbabf955447fd57e6'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-35-context.md'
  - '{project-root}/docs/textes-classement.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Each theme file (886 keys) is ordered by story chronology, not by feature, so a theme cannot be read as a whole. 524 keys migrated by story 35.2 are identical in all three themes (generic default wording), the address form (tu/vous) is mixed inside each theme, and several pure functions still default to the reference theme's `tone`, which turns wrong once voices diverge.

**Approach:** Regroup each theme file by feature (same order in all three), give each theme one consistent voice and address form across the whole app, and make the code safe for diverging voices (explicit `tone`, no hard-wired grammar).

## Boundaries & Constraints

**Always:**
- Voices come from `ux-jdr-master-20260626/EXPERIENCE.md` §3: Grimoire Émeraude = magic/library, **vouvoiement**; Forêt Ancienne = nature/druids, **tutoiement**; Atelier Cuivré = gears/steam/registers, **vouvoiement**. Use one address form per theme everywhere, including the auth screens' hard-coded titles and `Lien invalide.`.
- Keys stay identical across themes; only values change. Add a key to `grimoire-emeraude` first. `{name}` holes stay identical across themes (existing parity test).
- Contractual texts stay neutral and identical: `status.*`, `character.nature_dragon`, `auth.password_*`, `auth.field_*` rule words, agenda badges. An error names its cause and never lies; login never distinguishes unknown account from wrong password; state labels are words, not codes.
- Game-system text (Ryuutama) stays out of the registry. « Dés Dispos » is constant. Do not degrade Atelier Cuivré error contrast (4.51:1).
- Comments and messages in French; no dependency added; everything runs via Docker.
- **Authorship (human decision):** the agent writes all three voices; the human skims the produced theme files. The agent must make sure every themed text really differs between the three themes and carries that theme's atmosphere.
- **Scope (human decision):** every key diverges except the contractual neutral list. Where divergence is impossible or harms UX for a functional text, the agent asks instead of forcing it.
- **Escalation rule (human decision):** the agent flags borderline cases for the human instead of deciding alone — a text it fears is not atmospheric enough, or a themed text that would hurt UX (too long for a button, ambiguous action, e.g. a « Retour » button turned into a long in-universe sentence). Short action labels (buttons, links, tabs) stay short and unambiguous; the theme shows through vocabulary, not length. The human reviews only these flagged cases in detail; the final report lists them.

- **Party kind labels (human decision):** merge on the themed `partie.kind_*` set; dashboard, party detail and sort use it and `core.parties_kind_*` is deleted from the three themes. The « Type » sort order stays exactly as locked by `party-sort.spec.ts` (L89-98), whatever the new key spelling.

**Never:**
- No change of behaviour, layout or component logic beyond text and the explicit `tone` threading.
- No key renaming or deletion of dynamic keys (`partie.signal_*`, `dashboard.sort_*`, …).
- Do not move the front parity check into CI (separate deferred item).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Read a theme | open one theme file | all its texts grouped by feature, same section order in the three files | N/A |
| Key missing in one theme | key added to one file | `pnpm build` fails (type error) and parity test fails | type error |
| Caller omits `tone` | pure helper called without it | does not compile | type error |
| Voice divergence | `common.*` or any rewritten key | tests no longer require identical text, except the contractual list | N/A |
| Grammar in sentences | conflict dialog with a reworded state word | sentence stays correct (agreement and word order live in the registry) | N/A |

</frozen-after-approval>

## Code Map

- `core/parties/parties.util.ts:12-19` (`partieKindLabelKey`), `core/parties/party-sort.ts:54`, `features/dashboard/dashboard.ts:120`, `features/parties/partie-detail/partie-detail.ts:661` -- the only users of `core.parties_kind_*`; they switch to `partie.kind_*`. The sort currently compares key strings, so sort by an explicit kind order instead.

- `apps/web/src/app/core/theme/tones/{grimoire-emeraude (reference),foret-ancienne,atelier-cuivre}.ts` -- 886 keys each; lines 1-439 = 362 older keys by story, 440+ = 524 keys from 35.2; 216 keys differ today (all among the 362 older). `index.ts` composes `TONE_MAP`.
- `apps/web/src/app/core/theme/theme-tone.service.spec.ts` -- identical-text assertions: L459 (`STATUS_KEYS`), L379, L533, L668 (contractual, keep); **L698 (`common.*` identical) must be replaced**; keep parity L65, holes L708, orphans L725.
- `features/calendar/poll-track.utils.ts:85`, `group-availability.utils.ts:10` -- duplicated `DEFAULT_TONE`; `answerLabel`, `participationAriaLabel`, `groupAriaLabel`, `memberStatusWord` default to it. `calendar-week-view/calendar-week-view.ts:180` -- `buildWeek` default. `core/homme-dragon/homme-dragon.util.ts:9,18` -- `SANS_AVENTURE_LABEL` default. All production callers already pass `tone`; ~27 spec call sites rely on the default.
- `features/calendar/**/conflict-dialog*`, `roster-row.util.ts` -- `kindLabel + 's'`, « Tu déclares <b>…</b> », reuse of `calendar.week_status_*`: move agreement and word order into the registry.
- `poll-track.utils.ts:140` `counterLabel` -- hard-coded text; `poll-response.html` -- raw YES/NO/MAYBE on vote buttons; `partie.signal_vote_en_cours_sans_reponse` still « Vote en attente » vs the spine's « Réponds au vote » / « Vote en cours » pair.
- `docs/textes-classement.md` §5 -- editorial agenda (relative dates, « sans nom », « (+1 autre) », durations, « Occupations/Actions », ` ou `); update it as points are settled.

## Tasks & Acceptance

**Execution:**
- [x] `core/theme/tones/*.ts` -- regroup keys by feature prefix, same order and section comments in all three, via a script that proves the key set and values are unchanged -- AC 1
- [x] `core/theme/tones/*.ts` -- write each theme's voice per the decisions above, one address form per theme, including the auth hard-coded texts -- AC 2, 3
- [x] `poll-track.utils.ts`, `group-availability.utils.ts`, `calendar-week-view.ts`, `homme-dragon.util.ts` + their specs -- make `tone` required, remove the defaults, and pass the theme in specs; add a spec run with a non-reference theme -- AC 3
- [x] conflict dialog, `roster-row.util.ts`, `counterLabel`, `poll-response.html` -- move grammar and stray texts into the registry
- [x] `theme-tone.service.spec.ts` -- replace L698; add per-theme tests (address form markers, contractual keys neutral, no key left identical on the high-visibility list)
- [x] `docs/textes-classement.md` -- record each §5 decision; add a short voice guide per theme (address form, vocabulary, examples)

**Acceptance Criteria:**
- Given one theme file, when I read it, then its texts are grouped by feature and none requires opening another file.
- Given the three themes, when I read each end to end, then it keeps its universe and its address form from the first screen to the last.
- Given a screen new or reworked by epics 29-35, when I list its labels, then they exist in the three themes and none stays in generic default wording (within the scope decided above).

## Implementation Notes

## Spec Change Log

## Review Triage Log

Review pass 1 (focused diff: application code, docs and logic-bearing specs; the three theme files and ~55 mechanical spec rewrites were excluded from the reviewers' input and are covered by the registry parity/neutrality/address-form tests plus the orchestrator's own grep of address markers).

- **[blind] Tone files absent from the reviewed diff** — `false`: a scoping choice of the review input, not a defect; voice content is guarded by the parity, neutral-list and address-form tests and surfaced to the human.
- **[blind] `party-sort.spec.ts` title still says « ordre alphabétique des libellés »; rank fallback untested** — `low`, patch (title only); fallback test rejected (unreachable for the three known kinds).
- **[blind/edge] `overwriteLead` builds `calendar.conflict_overwrite_${kind}_${n}` with no guard; `unavailable_one` untested** — `medium`, patch: verified all 4 keys exist in the 3 themes, add a test that the 4 keys exist and render in every theme.
- **[blind] `ConflictDialogData.kind` redeclares the union type** — `low`, rejected: direct duplicate of a two-value literal, no named harm.
- **[blind] `buildWeek` `tone` inserted as 4th positional argument / `answerLabel` density default removed** — `low`, rejected: the compiler flags every misuse, production callers verified.
- **[blind] Helper specs hard-code Grimoire wording; `.replace('{n}')` re-implements `fillTone`** — `low`, rejected: pre-existing style, reference theme.
- **[blind/edge] Vouvoiement guard: curly `t’` only, closed imperative list** — `medium`, patch for the straight-apostrophe gap (direct regex fix); the closed imperative list is `low`, rejected — the orchestrator grepped the two vouvoiement themes and found no tutoiement marker.
- **[blind] « Own vocabulary » test weak (35 % threshold, broad regexes)** — `low`, rejected: heuristic backstop; the human skims the files.
- **[blind] `app.config.spec.ts` title test tautological (missing key gives « undefined » on both sides)** — `medium`, patch: assert a non-empty title without « undefined ».
- **[blind/verif-gap] No test on the vote buttons (`poll-response`)** — `medium`, patch: render test of the three buttons.
- **[blind] `expect(contractuelles.length).toBe(24)` is a magic number** — `low`, rejected: guards against silent drift of the contractual list.
- **[blind] `docs/textes-classement.md` inaccuracies** — `low`, patch for the false claim that « Occupations/Actions » are in `NEUTRAL_KEYS`; the claim that `_bmad-output` is gitignored is `false` (the folder is tracked); other points rejected.
- **[blind] `partieKindLabelKey` lost its compile-time `Record<PartieKind,…>` guard** — `low`, defer: a new kind would show its raw enum until its key exists; callers keep the `?? kind` fallback.
- **[blind] Dead/orphan keys depend on a hand-kept list** — `low`, rejected: pre-existing mechanism.
- **[edge] About 112 non-contractual keys stay identical across themes (`NEUTRAL_KEYS`: calendar contract texts, state words, Ryuutama, `partie.asset_*`…), so AC 3 is not met for them** — `medium`, not a code patch: the spec says to ask the human in such cases; carried to the hand-off for a decision.
- **[edge] `status.seance_answer_poll` and `calendar.agenda.badge_answer_poll` stay « Réponds au vote » (tu) in the two vouvoiement themes** — `low`: the spec makes `status.*` contractual and identical (the two rules conflict); carried to the hand-off for a decision.
- **[verif-gap] `parties.roster_aria_character` (character without class) not exercised** — `medium`, patch: add a class-less roster case.
- **[verif-gap] Dashboard tile kind label (`partie.kind_*`) not asserted** — `low`, patch (one assertion; the reviewer proposed defer, the fix is trivial).
- **[verif-gap] The new required `tone` parameters are enforced by `pnpm build` only (CI does not build the front)** — `low`, already in `deferred-work.md` (35.1 item, L205-208): not logged again.

## Design Notes

Implementer rules: never run any git write command (commit, push, stash, reset…) — the human commits. You cannot ask the human questions: collect every borderline case (text that may lack atmosphere, themed text that may hurt UX) in your final report as a list « key — theme — proposed text — doubt », and apply the safest short wording meanwhile.

Per-theme voice writing is independent across themes: three parallel workers, each owning exactly one theme file, are safe once the regroup step has landed (the regroup must come first and alone — it rewrites all three files). The reference theme is written last or first by convention, since it defines `ToneKey`.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test web --watch=false` -- expected: all green (except the 2 known `calendar-view.spec.ts` failures)
- `docker compose exec web pnpm build` -- expected: compiles without error

**Manual checks (if no CLI):**
- Switch the three themes on a seeded account and read the dashboard, a party, the calendar and the auth screens; check address form and universe on each.
