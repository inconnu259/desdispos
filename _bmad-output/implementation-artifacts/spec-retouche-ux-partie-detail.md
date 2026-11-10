---
title: 'Retouche UX de PartieDetail (scroll, aération, fiches de téléchargement)'
type: 'feature'
created: '2026-09-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-22/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-22/EXPERIENCE.md'
baseline_commit: 1254c1533724d6dae9ba085ee41b5aca2ec4f53c
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Après retour d'usage réel sur la Story 32.2, trois défauts UX gênent `PartieDetail` :
(1) la molette ne défile que le contenu interne des onglets — un comportement Angular Material par
défaut — et laisse le pied de carte (Retranscrire/Sceller/Clore/Supprimer) hors de portée ; (2) la
zone Action est trop serrée (titre collé aux boutons, boutons XP/annonce trop proches) et les trois
zones (Action/Consultation/Référence) n'ont pas le même vocabulaire visuel ; (3) les fiches de
téléchargement (référence/préparation Ryuutama) prennent trop de place en boutons pleine largeur.

**Approach:** Implémenter le delta UX déjà figé dans `DESIGN.md`/`EXPERIENCE.md` (chargés en
contexte) : activer `dynamicHeight` sur `mat-tab-group` (API publique Angular Material, `partie-detail`
et `character-sheet`) pour que la page défile normalement ; harmoniser un patron de « carte à liseré »
sur les trois zones et les items de flux Consultation ; harmoniser un patron de « barre d'icônes »
entre les actions MJ et le pied de carte ; replier par défaut les grimoires de référence/préparation
avec des puces icône+libellé compactes au lieu de boutons pleine largeur.

## Boundaries & Constraints

**Always:**
- Suivre `DESIGN.md`/`EXPERIENCE.md` du delta comme contrat visuel/comportemental — la planche
  contractuelle est `mockups/key-partie-detail-onglet-details.html` dans ce même dossier UX.
- Le correctif de défilement (`dynamicHeight`) s'applique aux **deux** consommateurs de
  `mat-tab-group` (`partie-detail`, `character-sheet`) — aucune future 3ᵉ page à onglets ne doit
  réintroduire le problème sans y penser.
- Chaque icône (barre d'icônes, puce de téléchargement) reste doublée d'un libellé texte — jamais
  l'icône seule.
- Toute condition d'affichage existante (`isMj()`, `p.gameSystemId === 'ryuutama'`, etc.) reste
  inchangée — pur regroupement/retouche visuelle, aucune nouvelle règle métier.

**Never:**
- Ne jamais surcharger une classe CSS privée de Material (ex. `.mat-mdc-tab-body-content`) tant que
  l'API publique `dynamicHeight` n'a pas été essayée et écartée pour une raison précise et consignée.
- Ne pas introduire `MatExpansionModule` — aucun usage existant ailleurs dans l'app ; les grimoires
  repliables passent par `<details>`/`<summary>` natifs (zéro nouvelle dépendance, conforme au choix
  du delta UX).
- Ne pas toucher aux autres onglets (Invitations, Ma fiche, Homme Dragon, Scénario, Chronologie) ni à
  leur contenu, hormis leur nouveau comportement de défilement de page (`dynamicHeight` est une
  propriété du `mat-tab-group` lui-même, pas de chaque onglet individuellement).
- Ne pas introduire une 4ᵉ teinte de liseré ni une nouvelle échelle de statut.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Contenu d'onglet plus haut que le viewport | N'importe quel onglet de `PartieDetail`/`CharacterSheet` avec beaucoup de contenu | La molette au-dessus du contenu de l'onglet fait défiler toute la page ; le pied de carte reste atteignable en défilant | N/A |
| Changement d'onglet | Bascule entre deux onglets de hauteurs différentes | La hauteur du corps d'onglet s'adapte au contenu actif (`dynamicHeight`), sans scroll interne résiduel | N/A |
| Grimoires au premier affichage | Onglet Détails, système Ryuutama | Les fiches de référence/préparation s'affichent repliées ; le contenu (puces) apparaît au clic sur le résumé | N/A |
| MJ, système Ryuutama | `isMj()=true`, `gameSystemId='ryuutama'` | Zone Action harmonisée (carte séance + barre d'icônes XP/annonce), zone Consultation en cartes de flux, zone Référence avec grimoires repliés | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:29` -- `<mat-tab-group [selectedIndex]="selectedTabIndex()" (selectedIndexChange)="onTabIndexChange($event)">` : ajouter `dynamicHeight` (API publique Material, cf. `overviews/material/tabs/tabs.md` — le corps d'onglet anime sa hauteur sur celle de l'onglet actif au lieu de rester capé/scrollable).
- `apps/web/src/app/features/characters/character-sheet/character-sheet.html:147` -- même `mat-tab-group`, même ajout `dynamicHeight` (patron partagé avec `partie-detail`, cf. commentaire `Story 29.5` déjà présent).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:31-208` -- zones Action/Consultation/Référence de la Story 32.2 : appliquer le patron de carte à liseré (`DESIGN.md` §1/§2/§4) à `.scheduling-widget` (zone Action), à chaque item de `.announcements-feed` et à `app-xp-history` (zone Consultation, aujourd'hui des `<p>`/composants nus dans un conteneur commun), et regrouper les CTA XP (`.xp-section` bouton) + annonce (`.announcement-section` bouton) en une barre d'icônes unique.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:107-207` -- `.reference-sheets`/`.prep-sheets` : remplacer les boutons `mat-stroked-button` pleine largeur par des puces icône+libellé compactes dans un `<details>`/`<summary>` replié par défaut (un par fiche).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:378-399` -- pied de carte (`mat-card-actions` : Retranscrire/Sceller des secrets/Clore le grimoire/Supprimer) : même patron de barre d'icônes que la zone Action ; `Supprimer` passe en `color="warn"` (nouveau sur ce bouton précis, palette Material déjà thémée — `DESIGN.md` §1).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.scss` -- classes `.details-zone`/`.details-zone__title` (Story 32.2) à faire évoluer vers le patron de carte à liseré unifié (`DESIGN.md` §2/§3) ; ajouter les classes de puce de téléchargement et de barre d'icônes.
- `apps/web/src/app/features/characters/character-sheet/character-sheet.scss` -- vérifier l'absence de règle `overflow`/`height` sur le corps d'onglet qui entrerait en conflit avec `dynamicHeight` (aucune connue à ce jour, cf. investigation : seule `.sheet-menu-surface--sheet`, une feuille modale indépendante, porte un `overflow-y` légitime).
- `apps/web/src/app/core/theme/tones.ts` -- clés déjà posées par la Story 32.2 (`partie.details_zone_*`) réutilisées telles quelles ; pas de nouvelle clé de zone attendue, seulement d'éventuels libellés d'icônes si un `aria-label` manque.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- tests de structure de zone (32.2) à adapter au nouveau balisage (cartes au lieu de blocs nus) ; ajouter des tests sur l'état replié par défaut des grimoires et sur la présence de `dynamicHeight` (peut se vérifier via `fixture.componentInstance` / attribut du `DebugElement`, à défaut de tester le rendu réel).
- `apps/web/src/app/features/characters/character-sheet/character-sheet.spec.ts` -- test minimal confirmant `dynamicHeight` posé sur le `mat-tab-group` (pas de régression fonctionnelle attendue par ailleurs, aucun contenu de cet onglet n'est modifié par cette story).
- Référence de patron : `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-22/mockups/key-partie-detail-onglet-details.html` (planche contractuelle) et `DESIGN.md`/`EXPERIENCE.md` du même dossier.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.html` -- ajouter `dynamicHeight` au `mat-tab-group` -- réalise l'AC de défilement de page unique.
- [x] `apps/web/src/app/features/characters/character-sheet/character-sheet.html` -- même ajout `dynamicHeight` -- étend la correction au 2ᵉ (et dernier) consommateur de `mat-tab-group`.
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.html` + `.scss` -- patron de carte à liseré harmonisé sur Action/Consultation/Référence (widget séance, historique XP, fil d'annonces) -- réalise l'aération demandée.
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.html` + `.scss` -- barre d'icônes partagée pour XP/annonce (zone Action) et pour le pied de carte (Retranscrire/Sceller/Clore/Supprimer, ce dernier `color="warn"`) -- réalise l'harmonisation demandée.
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.html` + `.scss` -- grimoires de référence/préparation en `<details>`/`<summary>` repliés par défaut, puces icône+libellé compactes -- réalise la réduction de place demandée.
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- tests adaptés au nouveau balisage + couverture du repli par défaut des grimoires.
- [x] `apps/web/src/app/features/characters/character-sheet/character-sheet.spec.ts` -- test de non-régression sur `dynamicHeight`.

**Acceptance Criteria:**
- Given l'onglet Détails (ou tout autre onglet) de `PartieDetail` avec un contenu plus haut que le
  viewport, when je scrolle à la molette n'importe où sur l'écran, then toute la page défile et le
  pied de carte reste atteignable.
- Given le même défaut potentiel sur `CharacterSheet`, when je scrolle, then le même comportement de
  page unique s'applique.
- Given la zone Action de l'onglet Détails, when elle s'affiche, then le widget séance, le déclencheur
  XP et le déclencheur annonce sont visuellement aérés et suivent le même patron de carte/barre
  d'icônes que Consultation/Référence et le pied de carte.
- Given les grimoires de référence/préparation, when l'onglet Détails s'affiche pour la première fois,
  then ils sont repliés, et leur contenu (puces icône+libellé) apparaît au clic sur le résumé.

## Implementation Notes

- **`dynamicHeight`** posé en attribut nu (`<mat-tab-group dynamicHeight ...>`) sur les deux
  consommateurs -- syntaxe standard Material (`@Input({ transform: booleanAttribute })`), aucune
  liaison `[dynamicHeight]="true"` nécessaire. Vérifié en test via l'instance publique du composant
  (`MatTabGroup.dynamicHeight`), pas via une classe CSS générée (cf. suggestion du Code Map).
- **Barre d'icônes XP/annonce** : `.xp-section`/`.announcement-section` restent deux conteneurs
  distincts (sélecteurs déjà couverts par les tests Story 32.2/9.1) mais ne portent plus que le
  bouton déclencheur ; les deux boutons sont regroupés dans un `.icon-bar` commun, et les panneaux
  (`app-xp-distribution-panel`/`app-announcement-form`) sont sortis de leurs sections respectives
  pour s'afficher pleine largeur sous la barre, plutôt que dans un flex-item qui grandirait de façon
  asymétrique. Condition d'affichage (`isMj()`, `showXpPanel()`, `showAnnouncementForm()`)
  strictement inchangée.
- **Carte à liseré, zone Consultation** : `app-xp-history` et chaque `app-annonce-card` reçoivent les
  classes `zone-card zone-card--consultation` (et `zone-card--flush` pour `app-annonce-card`)
  directement sur leur balise hôte depuis `partie-detail.html` -- aucun de ces deux composants n'est
  modifié (hors périmètre du Code Map), et aucun `::ng-deep` n'est nécessaire puisqu'on ne cible que
  l'élément hôte, pas son contenu interne. `app-xp-history` n'a aujourd'hui aucune mise en boîte
  propre : il reçoit le patron complet (fond, padding, liseré). `app-annonce-card` a déjà son propre
  fond/bordure/padding (`annonce-card.scss`, non touché) -- lui superposer le patron complet aurait
  produit une carte dans une carte ; `--flush` ne garde que le liseré de couleur + l'espacement
  vertical entre annonces, sans dupliquer sa boîte.
- **Puces de téléchargement** : gardent `mat-stroked-button` (ripple, focus, cohérence avec le reste
  de l'app) ; seule la forme change, via la variable CSS publique Material
  `--mdc-outlined-button-container-shape: 999px` (pas une classe privée) + `border-radius` en secours.
  Les boutons restent de vrais `<button>` (pas des `<span>` comme la planche statique) pour conserver
  clic clavier, `[disabled]` pendant le téléchargement et gestion d'erreur, inchangés.
- **`color="warn"` sur Supprimer** : implémenté puis **retiré** après vérification visuelle réelle
  (step-03/04, cette session) -- voir la note ci-dessous.
- Aucun fichier hors `partie-detail.{html,scss,spec.ts}` et `character-sheet.{html,spec.ts}` n'a été
  modifié (`character-sheet.scss` vérifié, inchangé -- aucune règle `overflow`/`height` en conflit
  avec `dynamicHeight`, conforme à l'investigation déjà consignée dans le Code Map).
- **Vérification visuelle réelle (step-03, cette session)** : navigateur réel, partie MJ créée pour
  l'occasion (jouée puis supprimée), thème Forêt Ancienne, mobile (~629px, largeur de la fenêtre
  outil) et desktop (1400px) -- scroll de page confirmé sur toute la hauteur (molette au-dessus du
  contenu d'onglet fait défiler la page entière, pied de carte atteignable, testé joueur et MJ) ;
  grimoires repliés par défaut, dépliage au clic confirmé (chevron tourne, puces icône+libellé
  apparaissent) ; zone Action MJ (barre d'icônes XP/annonce) et zone Consultation (cartes à liseré)
  correctement aérées et harmonisées.
  **Défaut réel trouvé et corrigé** : `color="warn"` sur `mat-button` n'a **aucun effet** avec le
  theming M3 (`mat.theme()`, cf. `styles.scss`) -- documenté par Angular Material lui-même
  (« color... is supported in M2 themes only and has no effect in M3 themes », API doc `MatButton`).
  Le bouton « Supprimer » se rendait donc dans la teinte d'accent du thème (vert), indiscernable des
  trois autres actions du pied de carte -- une vérification purement unitaire
  (`MatButton.color === 'warn'`) ne pouvait pas le voir, puisque la propriété Angular est bien
  positionnée, seul son effet visuel est absent en M3. Corrigé par une classe `icon-bar__btn--danger`
  référençant directement `--mat-sys-error` (patron déjà en place dans ce fichier, `.notice.error`),
  avec la spécificité `&.mat-mdc-button` nécessaire pour l'emporter sur la règle Material par défaut
  (`.mat-mdc-button:not(:disabled)`, spécificité égale sans ce renfort). Test unitaire réécrit en
  conséquence (vérifie la classe CSS, plus la propriété `color` de l'instance).

## Spec Change Log

## Review Triage Log

- **[blind-hunter]** Le commentaire HTML au-dessus de `mat-card-actions` affirmait que « Supprimer »
  « passe en `color="warn"` », en contradiction directe avec le commentaire SCSS du même diff qui
  explique que cet attribut n'a aucun effet en M3. **Verdict : low** (vérifié : commentaire
  incohérent avec le code réel, aucune conséquence fonctionnelle). → **patch** (commentaire
  reformulé pour décrire le vrai correctif).
- **[edge-case-hunter, claim]** Même incohérence que ci-dessus, root cause partagée. → fusionné,
  **patch**.
- **[blind-hunter]** Double espacement au-dessus du titre de `app-xp-history` dans la zone
  Consultation : le `padding` de `.zone-card` (0,9rem) et le `margin-top` propre du composant
  (1rem) s'additionnent (les marges ne fusionnent pas à travers un parent qui a du padding),
  produisant ~1,9rem d'espace mort au lieu de 0,9rem comme les autres cartes. **Verdict : medium**
  (vérifié en lisant `xp-history.scss` puis confirmé en navigateur réel — écart visible et
  justement le genre de défaut que cette story vise à corriger). → **patch** (`margin-top: 0` sur
  `.xp-history`, seul point d'usage du composant).
- **[blind-hunter]** Aucun test ne vérifie que `app-xp-history` et chaque `app-annonce-card`
  reçoivent réellement les classes `zone-card`/`zone-card--consultation`/`zone-card--flush` depuis
  le template parent — la plus grosse retouche structurelle du diff, sans couverture, alors que
  `dynamicHeight`, le repli des grimoires et la barre d'icônes en ont chacun. **Verdict : medium**
  (gap réel, convention interne à ce diff non suivie pour ce seul cas). → **patch** (tests ajoutés).
- **[blind-hunter]** Aucun test n'affirme la couleur réellement calculée de `.icon-bar__btn--danger`
  — seule la présence de la classe est vérifiée, alors que le problème initial (`color="warn"`
  silencieusement sans effet) est justement invisible à ce niveau de test. **Verdict : low** (réel,
  mais correction non fiable : l'environnement de test Angular/Vitest ne charge pas nécessairement
  les variables de thème globales de `styles.scss` sur `:root`/`html.theme-*`, rendant une
  assertion de couleur calculée fragile ou non significative — la vérification visuelle réelle déjà
  faite est le contrôle approprié pour ce type de risque, comme déjà pratiqué ailleurs dans ce
  dépôt). **Rejeté du patch, differé** (`defer`) : ajouter un garde-fou fiable si un jour l'environnement
  de test charge réellement le thème.
- **[edge-case-hunter, deletion, confidence=high]** Le passage de `<h4>` à `<details>/<summary>`
  pour les grimoires de référence/préparation a fait perdre le rôle de titre (heading) de « Grimoires
  de référence »/« ...préparation (MJ) » — un lecteur d'écran naviguant par titre ne les trouve plus.
  **Verdict : medium** (réel, régression d'accessibilité — préoccupation déjà établie sur ce
  fichier précis lors de la revue de la Story 32.2, mêmes enjeux). → **patch** (`<h4>` réintroduit
  à l'intérieur de `<summary>`, styles hérités du parent).
- **[edge-case-hunter, claim, confidence=high]** L'intention de la spec (« harmoniser un patron de
  carte à liseré sur les trois zones ») n'était pas tenue pour la zone Référence : `zone-card--reference`
  était défini en CSS mais jamais utilisé en HTML — la description de la partie restait un `<p>` nu,
  sans carte, contrairement aux zones Action/Consultation. **Verdict : low-medium** (réel, vérifié :
  classe morte + zone visuellement moins finie que les deux autres). → **patch** (description
  enveloppée dans `zone-card zone-card--reference`).
- **[blind-hunter]** Incohérence d'accessibilité : les deux nouveaux déclencheurs (XP/annonce)
  portent `aria-hidden="true"` sur leur `mat-icon`, mais les quatre boutons du pied de carte
  (édition/visibilité/clôture/suppression), regroupés dans le même patron de barre d'icônes,
  gardaient des `mat-icon` nues sans `aria-hidden` alors que toutes sont purement décoratives à
  côté d'un libellé visible. **Verdict : low** (réel, correction directe triviale). → **patch**.
- **[blind-hunter]** Les boutons de bascule XP/annonce n'ont ni `aria-expanded` ni `aria-controls`
  reflétant le panneau qu'ils affichent/masquent. **Verdict : low** — préexistant, non introduit par
  cette story (ces boutons togglaient déjà `showXpPanel()`/`showAnnouncementForm()` avant la
  retouche ; seul leur regroupement visuel a changé). **Rejeté du patch, differé** (`defer`).
- **[blind-hunter]** Aucun état replié/déplié des grimoires n'est mémorisé entre deux visites de
  l'onglet. **Verdict : false** — décision de conception explicite et déjà documentée dans
  `EXPERIENCE.md` du delta UX (« pas de mémorisation... pas de sur-ingénierie pour un gain d'usage
  marginal ») : ce n'est pas un oubli, c'est un choix assumé et tracé.
- **[blind-hunter]** Comportement de retour à la ligne des 8 puces de `.prep-sheets` sur mobile non
  vérifié explicitement. **Verdict : false** — le patron `flex-wrap: wrap` + `gap` est celui déjà en
  place, inchangé, pour `__links` avant cette story ; le cas à 2 puces a été vérifié en navigateur
  réel (mobile ~629px) et rend correctement, aucun risque nouveau introduit par ce diff pour ce
  patron déjà éprouvé.

## Design Notes

Ce spec implémente un delta UX déjà négocié et figé avec l'utilisateur (`DESIGN.md`/`EXPERIENCE.md`,
2026-09-22/23, mockups à l'appui) — aucune décision de conception nouvelle n'est prise ici, seulement
sa traduction en code. Le choix technique propre à ce spec (non couvert par le delta UX, car
implémentation pure) est `dynamicHeight` plutôt qu'une surcharge CSS de classe privée Material : API
publique documentée, pas de dépendance à une structure DOM susceptible de changer entre versions de
Material. Si `dynamicHeight` seul ne suffit pas à l'usage réel (vérification visuelle), le repli est
une surcharge CSS scoped au composant (`::ng-deep` ou équivalent), jamais une règle globale dans
`styles.scss` — consigné ici pour ne pas re-débattre l'arbitrage si la vérification visuelle échoue.

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- ✅ exécuté : `partie-detail.spec.ts` 135/135 verts (dont les
  9 nouveaux tests de cette retouche), `character-sheet.spec.ts` 127/127 verts (dont le nouveau test
  `dynamicHeight`). Suite complète : 2477/2479 verts ; les 2 échecs restants
  (`calendar-view.spec.ts`, rail dépendant d'une date figée `2026-09-01`/`2026-09-22` désormais dans
  le passé de l'horloge système `2026-09-23`) sont pré-existants, sans rapport avec cette retouche
  (aucun fichier qu'elle touche) -- non introduits par ce changement, même défaut que celui déjà
  consigné dans la Story 32.2.
- `docker compose exec web pnpm exec tsc --noEmit` -- ✅ propre, aucune sortie.

**Manual checks (if no CLI):**
- ❓ **Non encore vérifié visuellement** (pas d'accès navigateur interactif dans cette session
  d'implémentation) : le défilement de page unique réel (molette, pied de carte atteignable), l'aération
  de la zone Action, le rendu des puces de téléchargement en pilule, et le dépli/repli effectif des
  grimoires au clic -- à faire par l'utilisateur (MJ et joueur, mobile ~380px et desktop) avant de
  considérer la story terminée, conformément à l'AC de vérification manuelle de ce spec.
