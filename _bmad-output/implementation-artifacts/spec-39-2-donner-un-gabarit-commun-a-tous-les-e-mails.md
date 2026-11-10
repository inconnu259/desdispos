---
title: '39.2 — A common template for every e-mail'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: '3f2ea37cd0a839ba804df3086bd9a9d391924c8a'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-39-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every e-mail ends with the footer « jdr-master » and carries its action as an underlined link inside the body, while the brand is « Dés Dispos » and the UX contract asks for a real button (UX-DR18, exception 7 of FR13).

**Approach:** ⚠️ The single `layout.hbs` draws the action as a full green button and the footer « Dés Dispos », for all nine existing templates and every future one. The button comes from the context: `link` (already passed by every caller) and an `actionLabel` that `EmailService` adds from a per-template label map; the body templates lose their own `<a>` line and keep every other word. Template without a link (or without a label): no button. Existing label words, subjects, bodies and recipients do not change. Button colour: dark green with white text (about 5:1), matching the preview mockup `emails-apercu-3.jpg`; inline styles and a table-based bulletproof button, as e-mail clients require. The unit and integration tests only assert the button and the footer (presence, label, href), not the whole markup. No theme in e-mails.

</frozen-after-approval>

## Implementation Notes

- `layout.hbs` draws the button when the context has `link` AND `actionLabel` (inline-styled bulletproof table button, `#2e7d5a` background, white bold text, pill radius) and the footer « Dés Dispos »; the Handlebars adapter passes `context` + `body` to the layout, so no module change was needed.
- `EmailService` adds `actionLabel` from `ACTION_LABELS: Record<EmailTemplate, string | null>` (closed union: a new template must declare its button, `null` = no action). Labels are the former link texts; `password-changed` and `email-change-notice` have none.
- The seven templates that had a `<p><a>` line lost it; every other word is unchanged, so the button now comes after the body text.
- Tests: service spec (label added to the context, none for an action-less template), real Mailpit integration (footer, no « jdr-master », button href + label for each of the 7 labelled templates through the real layout, no button for `password-changed`). Run: api typecheck OK, unit 2240/2241 (1 known date failure), e2e 115/115.
- Not done: nothing rendered in a real mail client (Outlook, dark mode).

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | Link/label invariant untested beyond `invitation`; silent button loss | medium | Patched: table-driven Mailpit test over the 7 labelled templates; all callers already pass `link` (checked) |
| 2 | Button now below the body: « Ce lien expire… » before the button; rollback e-mail ends a paragraph with « : » then another paragraph | low | Real but dictated by the frozen intent (layout draws the button, text unchanged); reordering would change words; deferred for the visual check |
| 3 | No plain-text part / raw URL fallback | low | The old link was also an anchor with a label, never a raw URL; no regression |
| 4 | `actionLabel` not overridable by caller | low | No caller needs it; YAGNI |
| 5 | Test asserts exact colour/regex; Handlebars escapes `=` in hrefs | false | Entity-escaped attributes decode correctly; real links contain only `.` and `/`; the new test uses such a link |
| 6 | Colour duplicated in layout; Outlook radius/VML, dark mode, preheader, title, fluid width | low | Cosmetic robustness beyond the contract; table-based button already degrades to a rectangle |
| 7 | Footer has no link, contact or reason line; « contactez-nous » without address | low | Pre-existing wording, out of the story |
| 8 | Notices have no call to action | low | Intentional, UX gives them none |
| 9 | Sender display name still « jdr-master » (`MAIL_FROM`) | low | Outside the stated footer scope; deferred |
