---
title: 'Story 32.2 : Réorganisation de la vue de partie'
type: 'feature'
created: '2026-09-22'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: 8c6ee70e31282978ceb95efa7176c20019f93811
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'onglet « Détails » de `PartieDetail` juxtapose aujourd'hui, sans hiérarchie, la
prochaine séance, la distribution d'XP, les fiches de référence/préparation et les annonces — rien
ne distingue ce qui appelle une action immédiate de ce qui relève de la simple consultation ou de la
référence, et sur mobile rien ne garantit que l'essentiel soit visible sans défilement.

**Approach:** Regrouper le contenu existant de l'onglet « Détails » (aucun autre onglet n'est
concerné) en trois zones étiquetées **Action**, **Consultation** et **Référence**, dans cet ordre,
sans redessiner l'intérieur d'aucun bloc existant ni changer sa condition d'affichage (MJ/joueur,
système de jeu) — un pur regroupement/réordonnancement, documenté bloc par bloc.

## Boundaries & Constraints

**Always:**
- Chaque bloc actuel de l'onglet « Détails » garde exactement sa condition d'affichage actuelle
  (`isMj()`, `p.gameSystemId === 'ryuutama'`, etc.) et son comportement interne — seule sa position
  et son regroupement visuel changent.
- Chaque bloc est explicitement affecté à une zone (Action/Consultation/Référence) par un commentaire
  au-dessus de sa balise, sur le modèle de la Story 36.11 (encadré « ce qui va où et pourquoi »).
- La zone Action apparaît en premier dans le flux de l'onglet, pour être visible sans défilement sur
  mobile (seuil unique du projet, `1024px`, déjà utilisé ailleurs dans ce même composant).
- Aucun texte/libellé de zone n'est codé en dur : les trois titres de zone passent par
  `theme.tone()`, comme tout le reste du composant.

**Never:**
- Ne pas toucher aux autres onglets (`Ma fiche`, `Invitations`, `Homme Dragon`, `Scénario`,
  `Chronologie`) : ils sont déjà focalisés sur un seul usage, hors du problème nommé par l'épic.
- Ne pas toucher au bandeau clôturé, à l'avertissement d'homonymie, au roster (rail/strip) ni aux
  `mat-card-actions` (éditer/visibilité/clôturer-réouvrir/supprimer) : tous vivent hors du
  `mat-tab-group`, à un endroit déjà stable et sans rapport avec le problème nommé par l'épic.
- Ne pas créer de nouveau composant partagé de mise en page à trois zones — un simple regroupement
  dans le template existant suffit ; `detail-surface` (Story 31.2) n'est pas conçu pour ce besoin et
  n'est pas réutilisé ici.
- Ne pas introduire un second seuil CSS/JS de rupture mobile.
- Ne pas changer le contrat de données d'aucun service (`PartiesService`, etc.).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| MJ, système Ryuutama | `isMj()=true`, `gameSystemId='ryuutama'` | Les 3 zones affichent tous les blocs MJ existants (XP, annonces, fiches de référence et de préparation) à leur zone assignée | N/A |
| Joueur, système Ryuutama | `isMj()=false` | Zone Action réduite au widget séance (CTA vote), zones Consultation/Référence sans aucun bloc MJ-only | N/A |
| Système non-Ryuutama | `gameSystemId !== 'ryuutama'` | Blocs fiches de référence/préparation absents (comportement actuel inchangé), zones Action/Consultation intactes | N/A |
| Mobile (<1024px) | `isDesktop()=false` | La zone Action est visible sans défilement à l'ouverture de l'onglet « Détails » | N/A |
| Vote de date en cours | `activePolls().length > 0` | Le lien vers le vote reste dans le widget séance (zone Action), inchangé | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:31-208` -- contenu actuel de
  l'onglet « Détails », à regrouper en 3 zones, dans cet ordre choisi (documenté bloc par bloc) :
  - **Action** : widget séance + CTA (`.html:38-57`, garde son unité — CTA et contexte de date
    restent ensemble), section XP MJ (`.html:63-77`), section annonces MJ — bouton + formulaire
    (`.html:79-92`).
  - **Consultation** : bandeau d'annonce transitoire (`.html:59-61`), fil d'annonces de campagne
    (`.html:94-105`), historique XP (`app-xp-history`, aujourd'hui dans `.xp-section`, `.html:75` —
    à extraire de la zone Action vers Consultation : c'est un journal, pas une action).
  - **Référence** : description de la partie (`.html:32-36`), fiches de référence Ryuutama
    (`.html:107-131`), fiches de préparation MJ (`.html:134-207`).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:1-30,209-401` -- tout le reste
  (bandeau clôturé, roster, avertissement d'homonymie, autres onglets, `mat-card-actions`) : hors
  périmètre, aucune modification.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.scss` -- ajouter les classes de zone
  (ex. `.details-zone--action/--consultation/--reference`) ; réutiliser les patrons d'espacement déjà
  en place dans ce fichier, pas de nouvelle dépendance CSS.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` -- aucune logique nouvelle
  attendue (pur regroupement de template) ; vérifier que `isDesktop()` (`.ts:241-244`,
  `BreakpointObserver` + seuil `1024px`) reste la seule source de vérité mobile/desktop déjà utilisée
  par ce composant, sans en ajouter une seconde.
- `packages/shared` ou fichiers de thème (`tones.ts`/équivalent) -- ajouter les 3 clés de titre de zone
  (Action/Consultation/Référence) dans les thèmes existants, comme tout autre libellé du composant.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- tests actuels de
  l'onglet Détails à relire : ceux qui vérifient un ordre DOM précis entre blocs regroupés devront
  être adaptés au nouveau regroupement ; ajouter des tests sur la présence des 3 titres de zone et sur
  l'appartenance de chaque bloc à sa zone (MJ vs joueur, Ryuutama vs non).
- Précédent réutilisable : Story 36.11 (`_bmad-output/implementation-artifacts/36-11-la-vue-agenda-refondue.md`,
  `calendar-agenda-view.ts`) -- patron de regroupement documenté bloc par bloc sans toucher au
  contrat de données sous-jacent ; même discipline ici.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.html` -- regrouper les blocs de
  l'onglet Détails en 3 `<section>` étiquetées (Action/Consultation/Référence) dans l'ordre décrit au
  Code Map, chaque bloc annoté d'un commentaire de décision -- réalise l'AC1/AC2.
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.scss` -- classes de zone,
  vérifier que la zone Action reste au-dessus du pli mobile (1024px) -- réalise l'AC3.
- [x] Clés de thème des 3 titres de zone ajoutées aux thèmes existants (jamais codées en dur) --
  cohérence avec le reste du composant.
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- tests d'appartenance
  aux zones (MJ/joueur, Ryuutama/non) + tests DOM adaptés au nouveau regroupement -- couverture des
  AC1/AC2/AC4.

**Acceptance Criteria:**
- Given la vue d'une partie, when j'ouvre l'onglet Détails, then les blocs actionnables (séance,
  XP MJ, annonces MJ) sont regroupés sous une zone Action distincte des zones Consultation et
  Référence.
- Given les fonctionnalités arrivées au fil des paliers (XP, annonces, fiches, historique), when la
  vue est livrée, then chacune a une place assumée et documentée par un commentaire de décision, et
  aucune n'a disparu.
- Given j'ouvre la vue sur téléphone (<1024px), when l'onglet Détails s'affiche, then la zone Action
  est visible sans défilement.
- Given je suis joueur, when j'ouvre l'onglet Détails, then aucun bloc MJ-only (XP, annonces,
  fiches de préparation) ne m'est proposé — comportement déjà garanti par `isMj()`, inchangé.

## Implementation Notes

- `partie-detail.html` : les blocs de l'onglet Détails sont désormais regroupés dans trois
  `<section class="details-zone details-zone--{action,consultation,reference}">`, dans cet ordre,
  chacun précédé d'un `<h3 class="details-zone__title">` thématisé et d'un commentaire de décision
  au-dessus de chaque bloc (patron Story 36.11). Aucune condition d'affichage existante
  (`isMj()`, `p.gameSystemId === 'ryuutama'`, `p.status`) n'a changé -- seuls la position et le
  regroupement visuel des blocs ont bougé.
  - Zone Action : `.scheduling-widget` (widget séance, garde son unité CTA+contexte), `.xp-section`
    (bouton + panneau de distribution, MJ), `.announcement-section` (bouton + formulaire de
    publication, MJ).
  - Zone Consultation : bandeau `.notice` transitoire, `app-xp-history` (extrait de `.xp-section`,
    MJ uniquement -- c'est un journal en lecture seule, pas une action), `.announcements-feed`.
  - Zone Référence : description de la partie, `.reference-sheets` (Ryuutama), `.prep-sheets`
    (MJ + Ryuutama).
- `partie-detail.scss` : nouvelle classe `.details-zone` (+ `--action/--consultation/--reference`
  comme sélecteurs de position, `__title` pour le titre) -- espacement vertical réutilisant le même
  patron `margin-top` que `.scheduling-widget`/`.reference-sheets`/`.prep-sheets`, aucune nouvelle
  dépendance CSS, aucun second seuil de rupture (le composant continue de reposer uniquement sur
  `isDesktop()` / 1024px pour tout le reste).
- `tones.ts` : trois nouvelles clés `partie.details_zone_action` / `_consultation` / `_reference`,
  ajoutées identiquement dans les **trois** thèmes (`grimoire-emeraude`, `foret-ancienne`,
  `medieval-steampunk`). Choix délibéré de garder les libellés « Action » / « Consultation » /
  « Référence » identiques dans les trois thèmes (même principe que `cta.destiny_mode`, Story 36.9) :
  ce sont les noms de catégorie que l'épic fixe explicitement, pas un intitulé à décliner par
  univers -- la clé existe pour qu'un thème futur puisse malgré tout les teinter.
- `partie-detail.ts` : **aucune modification** -- pur regroupement de template, `isDesktop()` reste
  l'unique source de vérité mobile/desktop, aucune nouvelle logique ajoutée.
- `partie-detail.spec.ts` : nouveau describe `PartieDetail — zones de l'onglet Détails (Story 32.2)`
  (9 tests) couvrant : présence et libellé des 3 titres de zone ; ordre Action → Consultation →
  Référence dans le DOM (y compris en mobile, `desktop: false`) ; appartenance de chaque bloc à sa
  zone pour MJ+Ryuutama, joueur, et système non-Ryuutama ; extraction de `app-xp-history` de la zone
  Action vers Consultation ; persistance du lien de vote dans le widget séance de la zone Action.
  Les tests DOM existants n'ont pas eu besoin d'être adaptés (aucun ne dépendait de l'ordre relatif
  entre blocs regroupés -- tous ciblent une classe précise, éventuellement scopée à son propre
  conteneur).
- Revue (5 correctifs "patch") appliqués : (1) garde `hasConsultationContent()` (computed) sur la
  zone Consultation -- ne se rend plus si `notice()` est faux, `isMj()` faux et aucune annonce de
  campagne (sinon titre de zone vide, sans contenu) ; (2) les `<h3>` internes déjà existants
  (`.scheduling-widget`, `.reference-sheets`, `.prep-sheets`) démotés en `<h4>` -- le titre de zone
  reste seul `<h3>`, plan de titres cohérent pour la navigation au lecteur d'écran ; (3) parité des 3
  nouvelles clés de thème testée dans `theme-tone.service.spec.ts` (patron 36.11/36.14/31.1) ; (4)
  test "Mobile" fusionné avec le test d'ordre général (`it.each`) -- ne prétend plus vérifier une
  garantie mobile-spécifique inexistante dans le code (l'ordre DOM est statique, l'AC3 relève du CSS) ;
  (5) commentaire SCSS reformulé entièrement en français. Un 6e signalement (placement pré-existant du
  bandeau `notice()`, hors périmètre) différé dans `deferred-work.md`.
- Vérification post-patch (step-04, cette session) : diff relu intégralement (les 5 correctifs
  confirmés corrects par lecture directe), suite complète relancée sur l'arbre patché -- web
  2469/2471 (2 échecs pré-existants non liés, `calendar-view.spec.ts`, dérive de date), `tsc --noEmit`
  propre.

## Spec Change Log

## Review Triage Log

- **[blind-hunter + edge-case-hunter]** La zone Consultation peut s'afficher avec un simple titre et
  aucun contenu (`notice()` faux, `isMj()` faux, `campaignAnnouncements().length === 0`) — contraste
  avec la zone Référence, qui a toujours un contenu grâce à son `@else` (description/fallback).
  **Verdict : medium** (vérifié : combinaison plausible et fréquente pour un joueur sans annonce de
  campagne ; `notice()` n'est de toute façon quasiment jamais vrai pendant la consultation de cet
  onglet, cf. entrée suivante). → **patch**.
- **[blind-hunter]** Le nouveau titre de zone `<h3 class="details-zone__title">` est un frère, au
  niveau d'accessibilité, des `<h3>` déjà imbriqués qu'il regroupe visuellement
  (`.scheduling-widget h3`, `.reference-sheets h3`, `.prep-sheets h3`) — casse le plan de titres pour
  la navigation au lecteur d'écran, alors qu'aucun titre de zone n'existait avant cette story.
  **Verdict : medium** (vérifié en relisant le HTML : aucune hiérarchie h2/h3/h4 cohérente). →
  **patch**.
- **[blind-hunter]** Les 3 nouvelles clés `partie.details_zone_action/consultation/reference` n'ont
  aucun test de parité entre les 3 thèmes, contrairement à la convention établie
  (`theme-tone.service.spec.ts`, patron des stories 36.11/36.14/31.1) — le commentaire du diff cite
  lui-même le piège que cette convention prévient (clé oubliée dans un seul thème → `undefined`).
  **Verdict : medium** (gap réel, convention du dépôt non suivie). → **patch**.
- **[blind-hunter]** Le test "Mobile (<1024px)" affirme exactement le même ordre DOM statique que le
  test général juste au-dessus, sans qu'aucune logique ne branche sur `isDesktop()` pour l'ordre des
  zones — il se lit comme une preuve de l'AC3 mobile mais ne peut détecter aucune régression propre
  au mobile, puisqu'aucune logique mobile-spécifique n'existe à cet endroit. **Verdict : low** (réel,
  clarification/fusion directe). → **patch**.
- **[blind-hunter]** Le commentaire de `partie-detail.scss` mélange une expression anglaise (« cf.
  Boundaries & Constraints de la story ») dans un commentaire sinon en français, contre la règle
  explicite du CLAUDE.md du dépôt (jamais d'anglais introduit dans les commentaires). **Verdict :
  low** (réel, correction directe triviale). → **patch**.
- **[blind-hunter]** Le bandeau transitoire `notice()` (déclenché uniquement par les actions de
  l'onglet Invitations : inviter, inviter par e-mail, copier un lien) s'affiche dans l'onglet Détails,
  pas dans l'onglet Invitations où l'action a lieu — un défaut de placement déjà préexistant à cette
  story (vérifié : `notice.set(...)` n'est jamais appelé par `onXpDistributed()`/
  `onAnnouncementPublished()`, seulement par les 3 actions de l'onglet Invitations, et `notice()` n'a
  jamais qu'une seule occurrence dans le template, déjà dans l'onglet Détails avant cette story). Le
  déplacement introduit par cette story (position dans la zone Consultation plutôt qu'en tête du flux)
  n'aggrave que marginalement un problème de fond déjà présent (bandeau rarement visible au moment où
  il compte, l'onglet Détails n'étant généralement pas affiché quand l'action a lieu sur l'onglet
  Invitations). **Verdict : low** — réel mais préexistant, la correction du fond (bon onglet /
  mécanisme partagé) est hors périmètre de cette story. **Rejeté du patch, differé** (`defer`).

## Design Notes

Le classement retenu suit la **nature** du contenu plutôt qu'un état dynamique (« y a-t-il quelque
chose à faire là maintenant ? ») : Action = contrôles/CTA actionnables depuis cet écran ; Consultation
= flux/journaux en lecture seule ; Référence = documents statiques de support. Ce choix évite un calcul
de pertinence par bloc (plus simple, plus stable) et se documente bloc par bloc comme la Story 36.11.
Le widget séance reste un bloc unique en tête de zone Action : scinder sa date/statut (consultation) de
son CTA (action) romprait le contexte sans bénéfice net.

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- ✅ exécuté : `partie-detail.spec.ts` 128/128 verts (dont les
  9 nouveaux tests de zone). Suite complète : 2466/2468 verts ; les 2 échecs restants
  (`calendar-view.spec.ts`, tests de rail dépendant d'une date figée `2026-09-01` désormais dans le
  passé de l'horloge système `2026-09-22`) sont pré-existants, sans rapport avec cette story (aucun
  fichier touché par elle) -- non introduits par ce changement.
- `docker compose exec web pnpm exec tsc --noEmit` -- ✅ propre, aucune sortie.

**Manual checks:**
- ✅ Vérification visuelle réelle via navigateur (session de test déjà connectée, thème
  `foret-ancienne`) sur « La Route des Lanternes » (Ryuutama · Campagne), rôle **joueur** : les trois
  zones ACTION/CONSULTATION/RÉFÉRENCE s'affichent dans cet ordre, avec le contenu attendu à chaque
  zone (widget séance + vote en zone Action ; annonce de campagne en zone Consultation ; description
  + fiches de référence Ryuutama en zone Référence, sans bloc MJ-only). Vérifié en largeur mobile
  (~610px, zone Action visible sans défilement à l'ouverture de l'onglet) **et** en largeur desktop
  (1400px, roster-rail + les 3 zones tenant entièrement au-dessus du pli).
- ⚠️ **Non vérifié visuellement** : le rendu **MJ** (XP, publication d'annonce, fiches de préparation
  en zone Action/Référence) -- la session de test connectée ne porte que des parties où l'utilisateur
  est joueur, aucune partie MJ disponible pour bascule de rôle en direct. Couvert uniquement par les
  tests automatisés (`PartieDetail — zones de l'onglet Détails`, cas MJ+Ryuutama). À vérifier
  visuellement à l'occasion si une session MJ devient disponible.
