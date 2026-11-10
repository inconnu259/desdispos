---
title: '32.3 — États de scénario et de séance'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '17d0baba2c7708d47647aa1a623fcc86c8e2505c'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'état d'un scénario n'est porté que par `ScenarioStatusBadge` — libellés en dur, SCSS
hors palette de statut — et une séance n'a aucun badge : son état se devine en recomposant
l'arborescence de conditions de `seance-list` (vote, inscriptions, date retenue, compte-rendu).

**Approach:** Un badge d'état **unique et partagé**, alimenté par une dérivation **pure** des dix
états depuis la charge utile déjà servie (AD-20, aucun endpoint nouveau), aligné sur les quatre
teintes `--jdr-status-*` (29.0) et sur les primitives d'imminence déjà livrées par l'Agenda, câblé
sur toutes les surfaces de scénario et de séance de la vue de partie.

**Décisions arrêtées (2026-09-23) :**
1. **Périmètre complet** : badge de scénario (composant partagé par chronologie / éditeur / dialogue
   de lecture), brouillons et one-shot, badge de séance dans `seance-list`, et widget « Prochaine
   séance » de l'onglet Détails.
2. **Correctif serveur additif** : `dateValidee` (et son créneau) remonte à la racine de `SeanceDto`,
   sans quoi une séance datée sans vote ni inscription n'a aucune date exploitable. Aucune migration.
3. **Bande d'état (`StateRail`, 4 px) hors périmètre** : elle viendra avec la story 32.4, quand les
   cartes seront refaites — on évite deux liserés concurrents avec les liserés de zone de 32.2.

## Boundaries & Constraints

**Always:**
- Quatre teintes seulement (`todo` / `live` / `soon` / `done`) issues des `--jdr-status-*` ; **tout
  badge porte un libellé**, jamais la teinte seule.
- L'imminence est une **intensité**, pas un état : contour seul > 7 j · fond teinté de 7 à 2 j · badge
  plein la veille et le jour même (libellé humain « demain soir » / « ce soir »). Teinte `soon`
  inchangée. Seuils et libellés viennent d'**une seule source** partagée avec l'Agenda.
- Vote répondu vs non répondu = **deux libellés distincts** (« Vote en cours » / « Réponds au vote »).
- Brouillon = **traitement de forme** (contour tireté, fond transparent, texte atténué), pas une teinte.
- Contraste : badge plein → texte en `--jdr-bg`, **jamais blanc** ; variante `done` → texte en
  `--jdr-text-muted`, jamais `--jdr-status-done` ; opacités de fond 16 / 15 / 15 / 12 %.
- Les dix libellés passent par `theme.tone()`, présents dans les **trois** thèmes (test de parité).
- `prefers-reduced-motion: reduce` coupe toute animation sans perte d'information au repos.
- L'anti-spoil reste un rendu **frontend** : aucun badge, nœud ou compteur de brouillon côté joueur.

**Never:**
- Pas de **troisième vocabulaire d'état** : rester cohérent avec les `PartySignalCode` (29.7) et les
  `kind` de l'Agenda — un état déjà nommé ailleurs n'est pas renommé ici.
- Ne pas changer le **comportement** de la vue Agenda ni des pastilles du tableau de bord : leurs
  utilitaires se déplacent, leur sémantique non.
- Ne pas confondre le badge avec les **liserés de zone** de 32.2 (nature du contenu, pas statut) :
  aucune teinte de liseré ajoutée, aucune bande d'état ici.
- Ne pas refondre la mise en page de la chronologie (32.4), ne pas filtrer les `BROUILLON` côté
  serveur, aucune migration Prisma, aucune dépendance nouvelle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Scénario, 4 états | `status` servi tel quel | Brouillon *(MJ seul, contour tireté)* · À venir (`soon`) · Courant (`live`) · Passé (`done`) | N/A |
| Brouillon côté joueur | `status='BROUILLON'`, `isMj=false` | Rien : ni badge, ni nœud, ni compteur | N/A |
| Séance sans date ni vote | aucun `poll`, aucune date | « À planifier » (`todo`) | N/A |
| Vote ouvert, lecteur non votant | `poll.status='OPEN'`, lecteur absent des votes | « Réponds au vote » (`todo`) | N/A |
| Vote ouvert, lecteur ayant répondu | lecteur présent dans toutes les options | « Vote en cours » (`live`) | N/A |
| Inscriptions ouvertes | date future + `inscription` non close | « Inscriptions ouvertes » (`live`) — prime sur « Programmée » | N/A |
| Séance future | date > 7 j / 7–2 j / ≤ 1 j | « Programmée » (`soon`) en intensité *lointain* / *proche* / *plein* avec libellé humain | N/A |
| Séance passée, sans compte-rendu | date passée, `compteRendu` vide | « À débriefer » (`todo`) | N/A |
| Séance passée, avec compte-rendu | date passée, `compteRendu` rempli | « Jouée » (`done`) | N/A |
| Aucune date exploitable | date absente du DTO | Retombe sur « À planifier » — jamais un état inventé | Dégradation honnête |

</frozen-after-approval>

## Code Map

- `apps/web/src/styles.scss:54-66,83-86,148-151,210-213` -- les quatre `--jdr-status-*` par thème **et**
  l'invariant de contraste écrit d'avance pour « la future StatusBadge ». À appliquer, pas à redéfinir.
- `apps/web/src/app/features/calendar/agenda-badge.utils.ts:22-31,49-54,82-96` -- `BadgeTone`,
  `BadgeIntensity`, `SLOT_WHEN`, `imminenceIntensity()`, `imminenceLabel()` : **fonctions pures, seuils
  déjà arbitrés**, à déplacer dans un module partagé et réimporter ici sans changer une virgule.
  `badgeFor()` / `sectionIdFor()` raisonnent sur `AgendaEntry` : spécifiques, **ne pas** généraliser.
- `.../scenarios/scenario-status-badge/scenario-status-badge.ts:12-17` -- badge actuel (libellés en
  dur, « En cours » pour `COURANT`), partagé par la chronologie, l'éditeur et le dialogue de lecture :
  le réaligner couvre ces trois surfaces d'un coup.
- `packages/shared/src/index.ts:345-386,746-785` -- `ScenarioStatus` (4 états servis tels quels),
  `SeanceDto` (**aucun** champ `status` : l'état est dérivé), `SeanceInscriptionDto`, `SessionPollDto`,
  `PollOptionDto.votes[].userId` (source de « j'ai répondu ») ; `:270-282` les `PartySignalCode`, à ne
  pas contredire — « Inscriptions ouvertes » n'y a aucun jumeau (asymétrie assumée).
- `apps/web/src/app/core/poll/poll.util.ts:4,18` -- `getMissingVoters()` : définition existante de
  « a répondu ». Réutiliser, ne pas redéfinir. `core/parties/party-signal-priority.ts:30,56` -- ordre
  de priorité déjà arbitré côté liste des parties.
- `.../scenarios/seance-list/seance-list.ts:271` + `seance-list.html:70-77,117,310-332` -- patron de
  résolution de date (`poll.chosenDate ?? inscription.dateValidee`) et emplacements du badge ;
  indicateur de remplissage, statut de vote et compte-rendu restent en place.
- `.../scenarios/scenario-timeline/scenario-timeline.ts:42-48` -- `buildNodes(scenarios,
  includeBrouillon)` : **le** point de masquage anti-spoil, à ne pas dupliquer.
- `.../parties/partie-detail/partie-detail.ts:591-636` -- `nextSessionLabel()` / `pollStatusLabel()`
  du widget « Prochaine séance » (zone Action) : à faire porter par le badge.
- `apps/web/src/app/core/theme/tones.ts` (3 blocs) + `theme-tone.service.spec.ts:38+` -- clés de
  libellé et test de parité (patron 32.2 / 36.11).
- `apps/api/src/scenarios/scenarios.service.ts:1026-1053` -- `toSeanceDto()` : `dateValidee` n'est
  peuplé que dans le bloc `inscription` (si `inscriptionMax != null`). Seul endroit à corriger.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` + `apps/api/src/scenarios/scenarios.service.ts` -- remonter
  `dateValidee` (+ créneau) à la racine de `SeanceDto`, additif -- décision 2, rend « Programmée » et
  « À débriefer » dérivables partout.
- [x] `apps/web/src/app/core/status/status-badge.model.ts` (nouveau) -- y déplacer `BadgeTone`,
  `BadgeIntensity`, `SLOT_WHEN`, `imminenceIntensity()`, `imminenceLabel()` ; `agenda-badge.utils.ts`
  les réimporte -- source unique des teintes et des seuils.
- [x] `apps/web/src/app/core/status/status-derivation.ts` (+ `.spec.ts`) -- fonctions pures
  `scenarioState()` / `seanceState(seance, viewerId, now)` renvoyant `{ tone, intensity, labelKey,
  draft }` ; le spec couvre **chaque ligne** de la matrice I/O.
- [x] `apps/web/src/app/shared/status-badge/` (nouveau) -- rendu : teinte, intensité, variante
  brouillon, libellé thématisé, `prefers-reduced-motion`.
- [x] `apps/web/src/app/core/theme/tones.ts` + `theme-tone.service.spec.ts` -- les dix clés dans les
  trois thèmes + parité ; aucun libellé en dur. *(onze clés livrées, cf. Implementation Notes.)*
- [x] `scenario-status-badge` (réaligné sur le badge partagé), `scenario-drafts`,
  `scenario-one-shot-tab`, `seance-list`, widget « Prochaine séance » de `partie-detail` -- câblage
  sans toucher aux conditions d'affichage existantes ni au masquage anti-spoil.
  *(`scenario-one-shot-tab` : câblé par héritage, cf. Implementation Notes.)*
- [x] Specs des surfaces touchées -- badge attendu pour un MJ et pour un joueur ; aucun badge
  « Brouillon » n'atteint un joueur.

**Acceptance Criteria:**
- Given les quatre états de scénario et les six états de séance, when ils s'affichent, then ils se
  partagent quatre teintes seulement et chacun porte un libellé explicite.
- Given une séance en vote à laquelle j'ai répondu et une autre à laquelle je n'ai pas répondu, when
  elles s'affichent, then elles portent deux libellés distincts, lisibles sans la teinte.
- Given un scénario en brouillon vu par son MJ, when il s'affiche, then un contour tireté le signale
  et il reste identifiable sans perception fine des couleurs.
- Given une séance dont la date approche, when elle s'affiche, then son badge se densifie par paliers
  et le libellé devient humain la veille et le jour même, **sans** changer de teinte.
- Given une séance passée dont le compte-rendu n'est pas rédigé, when elle s'affiche, then elle
  bascule dans la teinte de ce qui réclame une action.
- Given je suis joueur et la partie comporte un brouillon, when j'ouvre la chronologie, then rien —
  badge, nœud, compteur ou espace — ne trahit son existence.

## Implementation Notes

**Onze clés de libellé, pas dix.** La spec compte « dix libellés » en traitant le vote comme UN
état. Il en faut onze clés, parce que ce seul état porte **deux** libellés distincts selon que le
lecteur a répondu ou non — une contrainte explicite de la spec elle-même (« deux libellés
distincts, lisibles sans la teinte »). Quatre clés de scénario + sept clés de séance, toutes sous
le préfixe `status.`, identiques dans les trois thèmes et couvertes par un test de parité qui
vérifie en plus *l'identité inter-thèmes* et la distinction de la paire de vote.

**`SeanceDto.dateValidee` à la racine = la date EFFECTIVE, pas la colonne brute.** Le serveur y
résout `poll.chosenDate ?? Seance.dateValidee`, et `slotValidee` ne porte un créneau que si la
date vient d'un vote scellé (la colonne `Seance.dateValidee` n'en a pas — même convention que
`recalculateNextSession()`, qui pose `slot: null` sur cette branche). Le bloc `inscription` et son
propre `dateValidee` restent servis à l'identique : ajout strictement additif, aucun site d'appel
existant modifié, aucune migration. Les deux champs sont **requis** (le serveur les remplit
toujours) ; seuls des fixtures de tests ont dû être complétées.

**`dateKeyOf()` lit les trois sources** (`poll.chosenDate` → racine → `inscription.dateValidee`),
pas par prudence excessive : pendant un déploiement, un client neuf peut interroger une API qui ne
sert pas encore la racine — et inversement. Sans ce repli, l'état d'une séance pourtant datée
disparaîtrait le temps du déploiement.

**Ordre de départage implémenté** (testé explicitement, `status-derivation.spec.ts`) :
date passée → vote ouvert → inscriptions ouvertes → programmée → à planifier. « Inscription
ouverte » y est définie comme *il reste une place* (`inscrits.length < max`), et **pas** comme
« aucune date validée » (la définition de `CalendarView.openInscriptionSeances()` / du serveur) :
c'est la seule lecture qui rende vraie la ligne de la matrice « prime sur Programmée », puisque
« Programmée » suppose justement une date validée. Aucun nouveau nom d'état n'est introduit pour
autant.

**Le libellé humain n'apparaît qu'au dernier palier.** `far`/`near` gardent « Programmée » ;
`imminent` seul remplace le libellé de registre par `imminenceLabel()` (« ce soir », « demain
soir »), conformément à l'AC (« le libellé devient humain la veille et le jour même »). C'est un
écart volontaire avec l'Agenda, qui affiche un décompte aux trois paliers — même fonction, même
seuils, usage différent.

**Le brouillon ne reçoit AUCUNE classe de teinte** (plutôt qu'une teinte surchargée ensuite) :
ne pas émettre la classe est plus sûr qu'espérer un ordre de déclaration CSS. `tone` reste
renseigné dans l'état pour que le type soit total, et le rendu l'ignore.

**`scenario-one-shot-tab` est câblé par héritage, volontairement.** Cet onglet (MJ seul) rend
`<app-scenario-editor>`, qui porte déjà `<app-scenario-status-badge>` — réaligné par cette story.
Y ajouter un second badge aurait affiché deux fois le même état à trois lignes d'écart. Idem pour
`scenario-timeline`, `scenario-editor` et `scenario-read-dialog` : réaligner l'adaptateur
`scenario-status-badge` couvre les quatre surfaces sans toucher à leurs gabarits.

**Anti-spoil : rien n'a bougé.** Le masquage reste entièrement porté par
`ScenarioTimeline.buildNodes(scenarios, includeBrouillon)`. `scenarioState('BROUILLON')` rend un
état comme un autre ; c'est l'amont qui décide qu'un joueur n'en voit rien. Un test de surface
vérifie qu'un joueur voit exactement trois badges là où le MJ en voit quatre — pas de badge vide,
pas d'espace réservé.

**Deux ajustements de mise en page, minimaux.** `.seance-row__header` et
`.scheduling-widget__header` deviennent des conteneurs flex : sans cela le badge tombait sous le
titre (`<h3>`/`<h4>` sont des blocs). La marge basse du `h4` est reprise par l'en-tête pour que
l'espacement de la story 32.2 soit conservé. Aucune bande d'état, aucun liseré : la refonte des
cartes reste à la 32.4.

**« En cours » → « Courant ».** Changement de libellé assumé et couvert par un test
(`scenario-read-dialog.spec.ts` attend désormais « Courant » et interdit « En cours »).

- **Correctifs de revue (2026-09-23, 10 patchs).** Le défaut central, relevé par les trois couches :
  la `dateValidee` racine n'était lue que par le badge — `seance-list` et `scenario-timeline`
  résolvaient encore la date par `poll?.chosenDate ?? inscription?.dateValidee`, si bien qu'une
  séance linéaire datée par héritage (le cas même que le correctif serveur bouche) affichait
  « Programmée » **sans aucune date** à côté, et « Date à définir » sur la carte de chronologie. Les
  deux surfaces lisent désormais la racine (`resolvedDate()` dans `SeanceList`, y compris pour la
  confirmation de suppression). Autres correctifs : pulsation du badge imminent supprimée (elle
  faisait clignoter le même état ici et pas dans l'Agenda, et n'est prescrite nulle part) ; création de
  `status-badge.spec.ts` (le libellé humain et les classes d'intensité n'étaient rendus par aucun
  test, toutes les specs de surface travaillant à ±10 jours) ; assertion du badge dans
  `scenario-drafts.spec.ts` ; quatrième test API (vote `CLOSED` **sans** `chosenDate`, qui prouve que
  la condition porte sur `chosenDate` et non sur le statut) ; `nextSessionBadge()` ne retient plus un
  vote quand la prochaine séance a déjà une date — `activePolls()` étant scopé à la partie, le widget
  pouvait afficher « Réponds au vote » sous la date confirmée d'une autre séance ; `slotEffectif ??
  null` redondant supprimé ; deux commentaires rectifiés (l'en-tête du composant promettait une source
  CSS unique que l'Agenda ne partage pas, et `dateKeyOf()` justifiait son triple repli par un
  déploiement décalé impossible au typage).
- **Vérification après patchs** : web 2547/2549, API 1394/1396, `api pnpm typecheck` propre,
  `web pnpm build` propre. Les 4 échecs restants sont pré-existants et tous de la même famille —
  fixtures à dates figées désormais échues (`calendar-view.spec.ts` ×2, `party-signals.service.spec.ts`,
  `parties.service.spec.ts`) ; consignés dans `deferred-work.md`.
- ⚠️ **`tsc --noEmit` ne vérifie rien côté web** : `apps/web/tsconfig.json` porte `"files": []` +
  `references`, donc la commande sort 0 sans compiler. La vraie vérification de types du front est
  `pnpm build`. Consigné dans `deferred-work.md` — le trou est ancien et dépasse cette story.

## Spec Change Log

## Review Triage Log

- **[blind + edge-case + verification-gap, 3 couches sur 3]** La nouvelle `SeanceDto.dateValidee`
  racine n'est lue que par le badge : `seance-list.html:73,148` conditionne encore la ligne « Date
  retenue » à `poll?.chosenDate || inscription.dateValidee`, `scenario-timeline.ts:216` fait pareil,
  et `seance-list.ts:294` (`hasValidatedDate`) aussi. **Verdict : high** (vérifié par lecture directe :
  une séance linéaire datée par héritage — sans vote ni inscription, exactement le cas que le
  correctif serveur dit boucher — affiche un badge « Programmée » avec AUCUNE date à côté, et « Date à
  définir » sur la carte de chronologie. La story crée cette contradiction). → **patch**.
- **[blind]** `status-badge.scss` ajoute `animation: status-badge-pulse` au palier imminent, absente
  de `.agenda-badge--imminent` : le même état clignote dans la liste des séances et pas dans l'Agenda,
  alors que le diff se présente comme un déplacement sans changement de comportement. Aucune
  pulsation n'est prescrite par `DESIGN.md` (« badge plein, poids 600 »). **Verdict : medium**
  (divergence visible entre deux écrans pour un état identique). → **patch**.
- **[blind + verification-gap]** Aucun test ne rend le composant `StatusBadge` : ni la priorité de
  `text` sur le libellé de registre, ni les classes d'intensité. Les specs de surface travaillent
  toutes à ±10 jours, donc le palier imminent et le libellé humain (« ce soir ») ne sont vérifiés que
  sur l'objet retourné, jamais dans le DOM. **Verdict : medium** (gap réel sur la partie la plus
  visible du badge). → **patch**.
- **[blind + verification-gap]** `scenario-drafts.html` reçoit un badge sans qu'aucune assertion de
  `scenario-drafts.spec.ts` ne l'observe : le supprimer laisse la suite verte. **Verdict : medium**
  (vérifié : le spec n'assertit que les titres). → **patch**.
- **[blind]** L'en-tête de `status-badge.ts` promet « un seul endroit à corriger quand la palette
  bouge », alors que `calendar-agenda-view.scss:180-235` garde sa propre copie des mêmes teintes —
  l'Agenda n'est pas migré vers `<app-status-badge>`. **Verdict : low** (le code est correct, c'est le
  commentaire qui ment et induira en erreur la prochaine retouche de palette). → **patch** (corriger
  l'affirmation ; migrer l'Agenda dépasse cette story).
- **[blind]** Le commentaire de `dateKeyOf()` justifie son troisième repli par « une API pas encore
  redéployée », impossible au typage puisque `SeanceDto.dateValidee` est **requis**. **Verdict : low**
  (le repli est inoffensif, la justification est fausse). → **patch** (reformuler).
- **[blind]** `slotEffectif ?? null` dans `toSeanceDto()` est redondant — `slotEffectif` est déjà
  `DaySlot | null`. **Verdict : low** (bruit, fix = suppression directe). → **patch**.
- **[blind]** Les trois nouveaux tests API ne couvrent pas le vote `CLOSED` **sans** `chosenDate` mais
  avec `chosenSlot` — le cas qui prouve que la condition est bien `chosenDate` et non
  `status === 'CLOSED'`. **Verdict : medium** (gap réel sur la seule logique serveur de la story). →
  **patch**.
- **[blind + edge-case + verification-gap]** `PartieDetail.nextSessionBadge()` prend `pending ??
  polls[0]` parmi TOUS les votes ouverts de la partie, sans lien avec `nextSessionDate` : un widget
  « Prochaine séance » portant une date confirmée peut afficher « Réponds au vote » pour un vote
  d'un autre scénario. **Verdict : medium** (vérifié : `activePolls()` est scopé à la partie, pas à la
  séance). → **patch**.
- **[blind]** `cssClass()` émet `status-badge--far`, sans règle CSS correspondante. **Verdict : low —
  rejeté** : `calendar-agenda-view.badgeClass()` émet exactement de la même façon ses trois
  intensités dont `--far` inerte ; « corriger » ici ferait diverger du patron existant pour un
  attribut invisible.
- **[blind]** Au palier imminent, `text` (« demain soir ») remplace le libellé d'état, sans
  `aria-label` : un lecteur d'écran n'entend aucun mot d'état. **Verdict : low — rejeté** : c'est le
  contrat UX explicite (`EXPERIENCE.md` : libellé humain « jamais J-1 » au dernier palier), « demain
  soir » **est** un libellé — P-1 interdit la teinte seule, pas le décompte — et l'Agenda se comporte
  déjà ainsi. Le fix ajouterait une surface d'accessibilité non prescrite, divergente de l'existant.
- **[blind]** `STATUS_KEYS` du test de parité recopie à la main l'union `StatusLabelKey` : une
  douzième clé ne serait pas réclamée aux trois thèmes. **Verdict : low — rejeté** : le fix (exporter
  une valeur runtime depuis `packages/shared` + `satisfies`) ajoute de la surface publique partagée
  pour un risque qu'un test de parité existant couvre déjà à l'ajout suivant.
- **[edge-case]** `loadRetrospectiveNotes()` (`scenarios.service.ts:1165`) calcule sa fenêtre avec
  `poll?.chosenDate ?? inscription?.dateValidee` et ignore la date héritée : notes de personnage
  manquantes sur un scénario clôturé dont les séances n'étaient datées que par héritage. **Verdict :
  medium — pré-existant** (vérifié : le code est antérieur à la story, qui ne l'aggrave pas). →
  **defer**.
- **[blind + edge-case]** `calendar-view.ts:511` (`allCalendarEntries`) ignore lui aussi la date
  héritée et écarte purement la séance du calendrier. **Verdict : medium — pré-existant**, aucun
  badge de cette story sur cette surface. → **defer**.
- **[blind + edge-case]** `todayKey` est figé à la construction et jamais réévalué (écran laissé
  ouvert au-delà de minuit), et il est dérivé en heure locale alors que les clés viennent d'ISO UTC.
  **Verdict : medium — pré-existant** : patron identique à `CalendarView.todayKey` et à l'Agenda, dette
  UTC/local déjà consignée. → **defer**.
- **[edge-case]** `nextSessionLabel()` n'écarte pas une `nextSessionDate` périmée alors que le badge
  le fait : date passée affichée sous un badge « À planifier ». **Verdict : low — rejeté** : l'affichage
  de la date périmée est pré-existant, l'état n'est atteignable qu'avec un `recalculateNextSession()`
  en retard, et aligner le libellé changerait un comportement hors périmètre.
- **[edge-case]** Une séance épisodique dont les inscriptions sont complètes, sans date, tombe sur
  « À planifier » — aucun état « complet » ne la distingue. **Verdict : false** : sans date, « À
  planifier » décrit exactement la situation, et aucun des dix états prescrits ne nomme « complet » ;
  en inventer un ajouterait une onzième case hors contrat.
- **[edge-case]** `toSeanceDto()` sert `poll.chosenDate` sans vérifier `status === 'CLOSED'` : un vote
  ouvert portant déjà une date fournirait la date effective. **Verdict : maybe-false** : `chosenDate`
  n'est écrit qu'au scellement, qui ferme le vote dans la même transaction — aucun chemin d'écriture
  produisant `OPEN + chosenDate` n'a été trouvé. Ce qui trancherait : une requête sur les données de
  production cherchant un `SessionPoll` `OPEN` avec `chosenDate` non nul. Côté client l'effet serait
  de toute façon masqué (la branche vote précède la branche date). → rejeté, faible enjeu.
- **[verification-gap, Other]** `scenario-read-dialog.spec.ts:153` assertit `not.toContain('En cours')`
  sur tout le `textContent` du dialogue. **Verdict : low — rejeté** : l'assertion vise précisément la
  régression de libellé que la story introduit, et aucun autre texte du dialogue ne contient cette
  chaîne aujourd'hui.

## Design Notes

**Départage de deux états simultanés.** Une séance peut être datée *et* ouvrir ses inscriptions. La
dérivation classe par actionnabilité décroissante — `todo` > `live` > `soon` > `done` — dans l'esprit
de `dominantSignal` (29.7) plutôt qu'avec un ordre inventé : « Inscriptions ouvertes » prime sur
« Programmée », « À débriefer » prime sur tout une fois la date passée. Ordre testé explicitement.

**Libellés identiques dans les trois thèmes** (précédent 32.2) : ce sont des noms d'état fixés par la
conception, pas des intitulés à décliner par univers — la clé existe pour qu'un thème futur puisse
malgré tout les teinter. **Et « Courant », pas « En cours »** : le bouton voisin de `scenario-editor`
dit déjà « Marquer comme Courant » et « en cours » reste réservé au vote.

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- suite de dérivation verte, surfaces touchées vertes, aucun
  nouvel échec vs baseline (2 échecs pré-existants connus dans `calendar-view.spec.ts`).
  ✅ **2541 verts / 2 rouges** — exactement les deux échecs pré-existants attendus.
- `docker compose exec api pnpm test` -- vert, aucune régression sur les DTO de séance.
  ⚠️ **1393 verts / 2 rouges**, mais les deux échecs sont **pré-existants et étrangers à cette
  story** : ce sont des tests à date figée dont l'échéance est passée (« bombes à retardement »).
  `party-signals.service.spec.ts:242` fixe `nextSessionDate: '2026-09-01'` et attend
  `PROCHAINE_SEANCE_CONNUE` ; `parties.service.spec.ts:1527` interroge la disponibilité au
  `2026-09-20`. Les deux dates sont désormais dans le passé (aujourd'hui : 2026-09-23), et aucun
  des deux chemins ne passe par `toSeanceDto()`. Même famille que les deux échecs web connus.
  **À consigner dans `deferred-work.md` — décision utilisateur.**
- `docker compose exec web pnpm exec tsc --noEmit` -- aucune sortie.
  ⚠️ Cette commande **ne vérifie rien** : `apps/web/tsconfig.json` porte `"files": []` et de simples
  `references`, donc `tsc -p` sans `-b` ne compile aucun fichier (exit 0 systématique). La
  vérification de types du front passe en réalité par `docker compose exec web pnpm build`
  (`ng build`, c'est ce que fait la CI) pour le code applicatif, et par `pnpm test` (`ng test`
  type-vérifie aussi les specs). Les deux ont été lancés et sont verts.

**Contrôles supplémentaires lancés :**
- `docker compose exec web pnpm build` -- ✅ succès (seuls les avertissements de budget déjà connus).
- `docker compose exec web pnpm lint` -- aucun fichier de cette story en erreur. 10 fichiers
  restent rouges, tous **pré-existants et non touchés** (`character-sheet`, `character-summary-card`,
  `my-characters`, `partie-form`, `visibility-locks`, et `partie-detail.spec.ts` aux lignes
  1555/2859+, hors des ajouts de cette story).
- `docker compose exec api pnpm lint:check` -- 10 erreurs, toutes pré-existantes
  (`characters/`, `parties/dto/`), aucune dans les fichiers de cette story.
- `docker compose exec api pnpm typecheck` -- ✅ aucune sortie.

**Manual checks:**
- Vérification visuelle réelle, **trois thèmes** : lisibilité des quatre teintes, badge `done` en texte
  atténué, badge plein sans blanc, contour tireté visible en niveaux de gris, aucun badge
  « Brouillon » côté joueur.
