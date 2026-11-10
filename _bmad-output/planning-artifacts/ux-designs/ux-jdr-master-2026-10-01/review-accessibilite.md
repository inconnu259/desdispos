---
title: Revue d'accessibilité adversariale — Delta Réserve de souffles (Story 33.6)
status: draft
updated: 2026-10-02
cible: "EXPERIENCE.md, DESIGN.md, mockups/key-reserve-final.html (ux-jdr-master-2026-10-01)"
référentiel: "WCAG 2.2 AA, Angular Material 22, 3 thèmes du projet"
---

# Revue d'accessibilité — Réserve de souffles (33.6)

## Verdict global

**Non conforme en l'état — à corriger dans les spines avant `bmad-build` 33-6.** Le squelette est bon (boutons nommés, catégories `h5 > button[aria-expanded][aria-controls]` avec raison dans le nom accessible, `hidden` réel sur les panneaux repliés, raisons de grisage écrites, rien n'est porté par la seule couleur). Mais le cœur du flux (choisir un souffle) est **inopérable au clavier tel que spécifié**, le **focus se perd après chaque geste réussi**, **rien n'est annoncé** (ni retrait, ni placement, ni enregistrement), et le thème **atelier-cuivre** casse plusieurs contrastes. Aucun de ces défauts n'est cosmétique : ils se corrigent en quelques phrases dans les spines, bien moins cher qu'après implémentation.

**Comptage : 22 constats — 1 critical, 5 high, 9 medium, 7 low.**

## Méthode et limites

- Lu : EXPERIENCE.md, DESIGN.md, `key-reserve-final.html` (balisage, CSS, aria-*), puis le code réel de la surface réutilisée : `apps/web/src/app/shared/detail-surface/{detail-surface.ts,.html,.scss,detail-surface-host.ts}` et l'usage dans `homme-dragon-sheet`.
- Valeurs de contraste calculées (formule WCAG 2.x, script dans le scratchpad de session) avec les hex **du code** (`apps/web/src/styles.scss`, `--jdr-*` / `--mat-sys-*`) pour les trois thèmes. Le troisième thème s'appelle encore **`medieval-steampunk`** dans le code (renommage `atelier-cuivre` = FR-43, non livré) : mesures faites sur ses valeurs actuelles, qui seront reprises telles quelles par le renommage.
- **Invérifiable** : les hex des teintes de race (`--h` : vert `#5fa578`, bleu `#6a93c2`, rouge `#c06552`, noir `#524d5e`) ne viennent que de la planche et du DESIGN 2026-09-23 — je les ai supposés identiques dans les 3 thèmes (la planche ne les rend qu'en grimoire-émeraude). Les couleurs des `stat-pill`/étiquettes réelles du code n'ont pas été lues composant par composant. Aucun test lecteur d'écran réel n'a été exécuté : les constats SR sont déduits du balisage et des spécifications ARIA.

## Ce que `DetailSurface` fait DÉJÀ (code lu)

| Point | État réel |
| --- | --- |
| Rôle / nom | `role="dialog"`, `aria-modal="true"`, `aria-label = title` ; titre `h2` interne |
| Piège de focus | `cdkTrapFocus` (sans auto-capture) ; le focus est posé sur le bouton ✕ à **chaque** `openToken` (effect) |
| Échap | `keydown` sur le panneau → `stopPropagation` + `closed` ; clic sur le voile ferme aussi |
| Retour du focus | `createDetailSurfaceHost().close()` : `trigger.focus()` **synchrone** si le déclencheur est encore connecté, sinon focus sur l'élément hôte (`tabindex=-1`) |
| Arrière-plan | pas d'`inert` : `aria-modal` + piège CDK seulement ; le voile est `aria-hidden` |
| Mobile / desktop | un seul panneau `fixed` : feuille basse (`max-height: 85vh`, panneau entier `overflow-y: auto`) ; ≥ 1024 px fenêtre centrée 560 px, `max-height: 80vh` |
| Fermer | `aria-label="Fermer"`, **min 32 × 32 px** |
| Mouvement | `detailSurfaceSlideUp` 0,25 s / `detailSurfaceFadeIn` 0,2 s, **aucun** `prefers-reduced-motion` |
| Contenu | `title`/`body`/`rows`/`narrative` ou contenu projeté (`custom`). **Pas** d'en-tête personnalisé, **pas** de zone épinglée, **pas** de compteur |

Les spines promettent « Aucune fourche du composant » (DESIGN §7) *et* un en-tête avec compteur, un « Fermer la fenêtre / Fermer la feuille », une zone de détail épinglée, une largeur 620 px, une feuille à 90 % : **ces promesses ne tiennent pas avec le composant actuel** (voir H3, M3).

## Tableau de contrastes mesurés (ratios WCAG, valeurs du code)

Fonds : *surface* = `--jdr-surface`, *high* = `--mat-sys-surface-container-high` (c'est le fond réel du panneau `DetailSurface`, ET des lignes `.srow` : la planche dessine le panneau en *surface*, le code en *high*).

| Paire | grimoire-émeraude | forêt-ancienne | atelier-cuivre (steampunk) | Seuil |
| --- | --- | --- | --- | --- |
| `text-muted` / surface | 5,92 | 6,34 | 5,74 | 4,5 OK |
| `text-muted` / high | 5,41 | 5,22 | 4,87 | 4,5 OK (marge faible) |
| `text` / high | 12,72 | 11,63 | 11,11 | OK |
| Nom grisé (`opacity .5`) / high | **4,20** | **4,08** | **3,97** | 4,5 KO |
| Nom grisé (`opacity .5`) / surface | 4,34 | 4,46 | 4,30 | 4,5 KO (de peu) |
| `stat-pill` grisée (`opacity .5`) | **2,82** | **2,54** | **2,01** | 4,5 KO |
| `stat-pill` pleine (accent-1 sur son voile 10 %) | 6,87 | 5,54 | **3,79** | 4,5 (atelier KO, hérité) |
| Libellé « + Choisir un souffle » (`accent-2`) / surface | 5,13 | 10,06 | **3,34** | 4,5 (13 px/600) |
| idem / high | 4,69 | 8,28 | **2,83** | 4,5 |
| Pointillé `accent-2 @ 50 %` / surface (`reserve-slot-empty`) | **2,22** | 3,46 | **1,77** | 3,0 (1.4.11) |
| Bordure `.btn` (`accent-2 @ 50 %`) / high | **2,17** | 3,18 | **1,66** | 3,0 |
| Ligne sélectionnée : bordure `accent-2` / son fond | 3,76 | 5,80 | **2,44** | 3,0 |
| Ligne sélectionnée : fond (`accent-2 @ 16 %`) / high | 1,25 | 1,43 | 1,16 | (indicateur secondaire) |
| Anneau de focus `accent-1` / high | 8,31 | 6,72 | 4,38 | 3,0 OK |
| Texte de race **Dragon Noir** `#524d5e` / surface | **2,20** | **2,11** | **2,00** | 4,5 |
| Texte de race **Dragon Rouge** `#c06552` / high | 4,06 | **3,51** | **3,43** | 4,5 (11-12 px) |
| Texte de race Vert / Bleu / high | 5,55 / 5,11 | 4,80 / 4,41 | 4,68 / 4,31 | 4,5 (Bleu limite) |
| Erreur `#e05252` / surface | 4,68 | 4,49 | 4,26 | icône ⚠ décorative ; message écrit en `text` : OK |
| Texte du bouton primaire `#0d0a14` sur dégradé `accent-1→accent-2` | 9,98 → 5,63 | 9,33 → 11,51 | 6,24 → **4,03** | 4,5 (l'extrémité droite du dégradé en atelier KO) |

Opacité de remplacement testée pour le nom grisé : **≥ 0,6 donne ≥ 5,0 dans les 3 thèmes** ; la `stat-pill` ne doit pas être atténuée (aucune opacité ne la rend conforme à 12 px).

---

## CRITICAL

### C1 — Les lignes de souffle ne sont pas opérables au clavier ni au lecteur d'écran (blocage de tâche)
- **Où** : EXPERIENCE §4 (« Consulter un souffle (clic/tap sur sa ligne) »), §6 (clavier : « Entrée/Espace sur les **boutons et en-têtes de catégorie** » — les lignes n'y sont pas), planche l.322 et suivantes : `<li role="option" aria-selected>` **sans `tabindex`**, sans gestion de flèches, ~9 `ul[role=listbox]` distincts dans la fenêtre.
- **Conséquence** : un utilisateur clavier atteint les en-têtes de catégorie, puis le bouton « Mettre dans l'emplacement N »… sans jamais pouvoir désigner un souffle. Il ne peut ni consulter, ni choisir, ni même afficher la description d'un souffle (la zone de détail ne se met à jour que sur sélection). Idem pour un utilisateur de commutateur. Au lecteur d'écran, des `option` non focalisables ne sont atteignables qu'en mode navigation, et `aria-selected` n'y est pas modifiable : la fonction centrale de la story n'est pas réalisable sans pointeur (WCAG 2.1.1, 4.1.2).
- **Correction** : spécifier explicitement le motif de clavier — soit chaque ligne devient un `<button aria-pressed>`/`radio` natif (Entrée/Espace = consulter), soit un seul `listbox` par catégorie avec tabulation roulante (`aria-activedescendant` ou `tabindex` itinérant, flèches ↑↓, Début/Fin, Entrée/Espace = consulter) — et l'ajouter à EXPERIENCE §6 et §7.

## HIGH

### H1 — Le focus est perdu après « Mettre dans l'emplacement N » et après « Retirer » (l'hypothèse §6 est fausse avec la plomberie réelle)
- **Où** : EXPERIENCE §6 (`[ASSUMPTION]` « le focus revient à l'emplacement »), §8 (« le focus revient sur l'emplacement »), §5 (rollback sur erreur) ; code `detail-surface-host.ts` `close()`.
- **Conséquence** : `close()` appelle `trigger.focus()` **synchroniquement**, avant que Angular re-rende la section. Or le déclencheur d'un emplacement vide (« Choisir un souffle ») est **remplacé** par une autre branche de template (« Changer » / « Retirer ») une fois le souffle placé → le bouton focalisé est détruit au rendu suivant et le focus retombe sur `<body>` (le repli « hôte » ne se déclenche même pas : le nœud était encore connecté au moment de l'appel). Même sort pour « Retirer » (le bouton disparaît quand l'emplacement redevient vide) et pour l'annulation après échec d'enregistrement (la ligne se reconstruit). Le clavier / le lecteur d'écran repart du haut du document après **chaque** geste réussi (3 fois dans le Key Flow) ; WCAG 2.4.3, 3.2.2.
- **Correction** : spécifier une cible de focus par geste, appliquée **après rendu** (`afterNextRender`) : placement/changement → bouton « Changer » de cet emplacement ; retrait → bouton « Choisir un souffle » du même emplacement ; Échap/Annuler → le déclencheur d'origine ; et exiger des tests clavier pour les trois cas.

### H2 — Aucun retour d'état annoncé : retrait, placement, enregistrement, compteur, chargement
- **Où** : EXPERIENCE §5 (« Enregistrement automatique »), §7 (seule l'erreur est `role="alert"`), planche l.237/243 (compteur `<b>` statique ; mention `✓ Enregistrée automatiquement` statique, `aria-hidden` sur le ✓), P5.
- **Conséquence** : « Retirer » est immédiat et silencieux : le bouton focalisé disparaît, rien n'est dit (WCAG 4.1.3). Le compteur « 2 / 3 emplacements » change sans annonce. Aucun état de chargement n'est défini : l'interface est optimiste (fenêtre fermée, ligne remplie), puis **revient en arrière** à l'échec — un utilisateur non voyant n'a aucun moyen de savoir que la ligne a été re-vidée, hormis l'alerte sous la liste (potentiellement hors écran à 400 %). La mention « Enregistrée automatiquement » affirme un succès même pendant l'attente ou l'échec.
- **Correction** : ajouter une région `role="status"` persistante (présente dès le chargement) annonçant « Courage placé dans l'emplacement 1 », « Emplacement 2 vidé », « Réserve enregistrée » / l'état « Enregistrement… » (`aria-busy` sur la liste), et rendre la mention statique conditionnelle à l'état réel.

### H3 — La fenêtre de choix déborde à 400 % / en paysage ; `DetailSurface` ne sait pas faire ce que la planche montre
- **Où** : DESIGN §4 (« feuille ~90 % », « fenêtre 620 px »), §7 (« zone de détail … **épinglée** »), EXPERIENCE §9 ; planche CSS l.186-193 (`.sheet` flex colonne, `.detail` `flex:0 0 auto`), P6b ; code `detail-surface.scss` (panneau `overflow-y:auto` entier, 85 vh/80 vh, 560 px).
- **Conséquence** : à 400 % de zoom (viewport ≈ 320 × 256 CSS px) ou téléphone en paysage (~320-360 px de haut), en-tête + règle + zone de détail épinglée (description + note + deux boutons ≈ 180-220 px) consomment tout l'espace : la liste n'a plus de place visible (WCAG 1.4.10 reflow, 1.4.4). À l'inverse, avec le composant actuel rien n'est épinglé : « Mettre dans l'emplacement N » défile hors champ. Épingler et personnaliser l'en-tête **est une fourche** de `DetailSurface`, contraire à « Aucune fourche » (DESIGN §7).
- **Correction** : trancher dans le spine — soit étendre `DetailSurface` (slots `header`/`footer`, `max-height` en `dvh`) et le dire, soit déplacer le détail en ligne (accordéon dans la ligne sélectionnée) ; dans les deux cas imposer un `max-height` de la zone de détail avec défilement propre et un critère d'acceptation « utilisable à 320 × 256 CSS px ».

### H4 — atelier-cuivre : le libellé « + Choisir un souffle » (accent-2) est illisible
- **Où** : DESIGN §7 (« libellé « Choisir un souffle » en `accent-2` »), planche CSS l.117 (`.btn.pick{color:var(--accent-2)}`), 13 px/600.
- **Conséquence** : `#4a7c59` sur le fond de la section donne **3,34:1** (2,83:1 si le fond est *high*) — sous 4,5:1 pour un texte de 13 px. Dans ce thème, l'invite à agir qui définit l'état « vide » est faiblement lisible ; WCAG 1.4.3.
- **Correction** : mettre le libellé en `--text` (ou `accent-1`, ≥ 4,38:1 mais à vérifier sur *high*) et réserver `accent-2` au pointillé décoratif.

### H5 — Les noms de race sont rendus en teinte de race : Dragon Noir à ≈ 2:1, Rouge sous 4,5:1 hors grimoire
- **Où** : DESIGN §2 (« teinte de race … doublée du nom »), planche l.67-68 (`.tag` : `color:var(--h)` 11 px, majuscules), l.137 (`.sub.noir/.sub.vert/.sub.bleu`), l.150 (`.cat.rouge .cat-name`).
- **Conséquence** : la « double lecture » (teinte + nom écrit) n'a de valeur que si le texte du nom est lisible. « DRAGON NOIR » (étiquette 11 px et titre de sous-groupe) mesure **2,0-2,2:1** dans les trois thèmes ; « Dragon Rouge » **3,4-3,5:1** en forêt/atelier sur *high* ; le Bleu est à la limite (4,31 en atelier/high). Le DESIGN 2026-09-23 affirme que le charbon est « sans perdre en lisibilité » : les mesures le contredisent (WCAG 1.4.3 ; l'exception « logotype » ne s'applique pas à un libellé fonctionnel).
- **Correction** : le texte du nom de race reste en `--text` ou `--text-muted`, seuls la gemme et le liseré portent la teinte.

## MEDIUM

### M1 — Le nom accessible des boutons d'emplacement n'identifie pas le souffle
- **Où** : EXPERIENCE §7 (noms : « Retirer le souffle de l'emplacement 2 »), planche l.239-241 (`aria-label` sans nom de souffle).
- **Conséquence** : au Tab, le lecteur d'écran dit « Changer le souffle de l'emplacement 2, bouton » sans dire *quel* souffle ; le nom du souffle est dans un frère non associé (l'`<li>` n'a pas de nom). Pour « Retirer » (destructif, sans confirmation) c'est un risque d'erreur. Le libellé « + Choisir un souffle » porte un « + » non lu mais reste compatible 2.5.3.
- **Correction** : `aria-label="Changer le souffle de l'emplacement 2 : Chance"` / `"Retirer Chance de l'emplacement 2"` (ou `aria-describedby` pointant sur le nom du souffle), et un nom d'`<li>` via `aria-labelledby`.

### M2 — « Retirer » supprime sans confirmation ni annulation réelle
- **Où** : EXPERIENCE §4/§11 (a) (« se corrige en re-choisissant »).
- **Conséquence** : « Retirer » est adjacent (8 px) à « Changer » ; un geste imprécis (tactile, tremblement, commutateur) efface un choix dont l'utilisateur doit se souvenir pour le refaire — ce n'est pas une annulation. WCAG 3.3.4 (données modifiées/supprimées : réversible, vérifié ou confirmé).
- **Correction** : ajouter une annulation de quelques secondes dans la région `status` (« Chance retiré de l'emplacement 2. Annuler »), sans dialogue de confirmation.

### M3 — Nom du dialogue, bouton fermer et compteur : les spines ne correspondent ni au code ni à la planche
- **Où** : EXPERIENCE §4/§7 (« Fermer la fenêtre » / « Fermer la feuille », 44 px, compteur « k / N emplacements » en tête), planche l.313-314 (« Emplacement 3 sur 3 », pas de compteur k / N), code (`aria-label="Fermer"`, 32 px, `aria-label = title`).
- **Conséquence** : le dialogue est nommé « Choisir un souffle » ; le numéro d'emplacement visé (« Emplacement 3 sur 3 », ambigu : emplacement 3 ou 3 sur 3 ?) est dans un sous-titre hors du nom. Le ✕ réel est à 32 px (passe 2.5.8 AA à 24 px, mais rompt la promesse 44 px du spine). Le compteur « k / N » exigé par §3/§8 n'existe pas dans la fenêtre de la planche.
- **Correction** : nommer le dialogue « Choisir un souffle pour l'emplacement 3 » (+ `aria-describedby` pour le compteur), imposer un ✕ de 44 px et trancher « Fermer » vs « Fermer la fenêtre/feuille » (le code ne distingue pas aujourd'hui desktop et mobile).

### M4 — Ligne grisée : bouton principal indéfini, description absente, contraste du nom à 50 %
- **Où** : EXPERIENCE §4 (« se consulte mais ne se place pas »), §7 ; DESIGN §2 (nom à 50 %) ; planche l.164-165, l.339 (`aria-disabled` sur `option`).
- **Conséquence** : (a) `aria-disabled` plutôt que `disabled` est le bon choix (reste focalisable, la raison est dans le nom accessible de l'option, donc lue) — mais le spine ne dit pas ce que devient « Mettre dans l'emplacement N » quand la ligne consultée est interdite : un bouton `disabled` n'est plus focalisable et sa raison disparaît. (b) Une ligne grisée n'affiche que la raison, pas la description : le contenu des souffles du temps/rituels/autres races n'est lisible que via la consultation (donc via C1). (c) Nom à `opacity .5` : 3,97-4,46:1 selon thème/fond, `stat-pill` 2,0-2,8:1. L'exemption « composant inactif » (1.4.3) est discutable : la ligne reste **interactive** (consultable), donc pas inactive.
- **Correction** : garder le bouton visible en `aria-disabled="true"` avec la raison liée par `aria-describedby`, afficher la description dans le détail d'une ligne grisée, passer l'atténuation à `opacity ≥ .6` sur le nom seul (≥ 5,0:1 dans les 3 thèmes) et ne pas atténuer la pastille de coût.

### M5 — Descriptions tronquées par ellipse : la version complète dépend de la sélection
- **Où** : planche CSS l.160 (`.l2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`), EXPERIENCE §4 (description complète dans la zone de détail).
- **Conséquence** : à 200 %/400 % la description visible tient en quelques mots ; son intégralité exige la sélection (impossible au clavier, cf. C1) et aucun `title`/équivalent n'existe. Le lecteur d'écran, lui, lit tout (texte complet dans le DOM) — ce qui rend chaque option très longue (jusqu'à ~250 caractères). WCAG 1.4.4/1.4.10 respectés seulement si une alternative accessible existe.
- **Correction** : autoriser deux lignes (`-webkit-line-clamp: 2`) ou retour à la ligne complet hors mobile, et garantir l'accès clavier à la zone de détail ; limiter le nom accessible de l'option au nom + coût + raison (`aria-describedby` pour la description).

### M6 — Contraste des composants (1.4.11) : pointillé, bordures de boutons, sélection de ligne
- **Où** : DESIGN §2 (`reserve-slot-empty` pointillé `accent-2 @ 50 %`), planche l.74/112/156.
- **Conséquence** : pointillé **2,22:1** en grimoire, **1,77:1** en atelier (3,46 en forêt) ; bordure de `.btn` **2,17 / 3,18 / 1,66** ; ligne sélectionnée en atelier **2,44:1** (fond +16 % à 1,16-1,43:1 vs panneau). Le libellé de l'emplacement vide et `aria-selected` sauvent le sens, mais la frontière visuelle des boutons et de l'état « sélectionné » est sous le seuil dans 2 thèmes sur 3.
- **Correction** : définir ces bordures avec un token d'outline ≥ 3:1 sur le fond (`--mat-sys-outline` n'est lui-même pas garanti — à mesurer) plutôt qu'un `accent-2 @ 50 %` ; ne pas faire reposer la sélection sur l'accent seul.

### M7 — Gestes rapides, annulation et alerte répétée
- **Où** : EXPERIENCE §5 (« revient à son état précédent »), P5 (« s'efface au prochain geste réussi »), Key Flow (« 3 gestes de Retirer »).
- **Conséquence** : trois « Retirer » successifs lancent trois écritures ; l'annulation de la première échouée peut rétablir un état périmé par la deuxième réussie (le spine ne définit ni sérialisation ni état « en cours »). Pour l'alerte : si la même erreur se reproduit alors que le nœud `role="alert"` est encore dans le DOM avec le même texte, **rien n'est annoncé** (une alerte ne parle que quand son contenu change).
- **Correction** : spécifier un seul enregistrement en vol (boutons `aria-disabled` + `aria-busy` pendant l'attente, ou file d'attente) et recréer le nœud d'alerte (ou vider puis remplir) à chaque échec.

### M8 — Reflow de la ligne d'emplacement : point de bascule non spécifié
- **Où** : DESIGN §4 (« boutons d'action à droite ») vs planche P6a (deux lignes, via une classe `.m`, `.m .slot{flex-wrap:wrap}`), EXPERIENCE §9 (seuil 768 px de la fiche seulement).
- **Conséquence** : entre 320 et ~500 px, la ligne desktop (pastille 32 px + corps + « Changer » + « Retirer » à 44 px) peut déborder ou écraser le nom ; seule la planche porte le comportement mobile, sans critère de bascule. Texte à 200 %/espacement de texte (1.4.12) : `min-height` OK, mais `.tag`/`.stat-pill` en `nowrap` peuvent forcer un défilement horizontal.
- **Correction** : écrire le critère (container query sur la section, bascule en deux lignes sous ~480 px de largeur de section) et un test visuel à 320 px/200 %.

### M9 — Mise à jour temps réel pendant que la fenêtre est ouverte
- **Où** : EXPERIENCE §6 (câblage `changed`/`notifyChanged()` « à évaluer »).
- **Conséquence** : un `changed` reçu pendant la consultation reconstruit la liste : le focus peut sauter, les badges « Déjà dans l'emplacement N » peuvent être périmés, « Mettre dans l'emplacement 4 » peut viser un emplacement qui n'existe plus (niveau modifié depuis un autre appareil). Non annoncé.
- **Correction** : ajouter une règle (ne pas réordonner/re-créer les nœuds ouverts — `track` stable —, désactiver l'action invalide avec raison annoncée via `status`).

## LOW

### L1 — Mouvement : fenêtre et chevrons sans `prefers-reduced-motion`
`detail-surface.scss` anime la feuille (translation 100 %, 0,25 s) et la fenêtre (fondu + échelle) sans bloc `@media (prefers-reduced-motion: reduce)` (le projet en a ailleurs : `party-banner`, `status-badge`…). EXPERIENCE/DESIGN ne disent rien des chevrons ▸/▾ ni d'une éventuelle animation de hauteur. **Correction** : ajouter le bloc `reduce` à `DetailSurface` et spécifier « pas d'animation de hauteur, rotation instantanée du chevron ».

### L2 — Sémantique des groupes et des titres
`p.cap-grp` (« Souffles communs », « Votre race », « Autres races et rituels ») n'est qu'un paragraphe ; la planche enchaîne `h4 > h5 > h6` alors que `DetailSurface` impose un `h2` ; `ol.slots` en `list-style:none` perd sa sémantique de liste sous VoiceOver. **Correction** : `role="group"` + `aria-labelledby` (ou titres `h3`), niveaux de titres cohérents avec l'`h2` du composant, `role="list"` explicite.

### L3 — Arrière-plan non inerte (hérité)
Pas d'`inert` sur l'app derrière la fenêtre : `aria-modal` + piège CDK, voile `aria-hidden` (décision 31.4). Le curseur virtuel de certains lecteurs d'écran peut sortir du dialogue. **Correction** : poser `inert` sur le conteneur applicatif tant que la surface est ouverte, ou accepter explicitement le risque dans le spine.

### L4 — Feuille mobile : zones sûres et unités de hauteur
Ni `env(safe-area-inset-bottom)` ni `dvh` (le code utilise `85vh`, la planche 90 %) : le bouton principal peut passer sous l'indicateur d'accueil ou sous la barre d'URL. Pas de champ de saisie dans la fenêtre : le clavier virtuel n'est **pas** un sujet ici. La poignée `.grab` (aria-hidden) suggère un glissement pour fermer : si un geste de balayage est ajouté, garder « Fermer » comme équivalent (2.5.1). **Correction** : `dvh` + `padding-bottom: max(20px, env(safe-area-inset-bottom))`.

### L5 — Tailles de police en px, très petites (11-12 px)
`.tag`, `.count`, `.inres`, `.cap-grp` = 11 px ; `text-sm` = 12 px en `px` (le code existant utilise `rem`). Le zoom fonctionne, mais le réglage de taille de texte du navigateur est ignoré. **Correction** : exprimer les tokens en `rem` dans l'implémentation et ne pas descendre sous 12 px (0,75 rem).

### L6 — Noms de thèmes et de tokens qui divergent du code
Spines : `atelier-cuivre`, `{colors.status-unavailable}` (`#e05252`) ; code : `medieval-steampunk` (renommage FR-43 à venir), `--color-unavailable: #e74c3c` global et `--mat-sys-error: #cf6679` par thème. Aucun token `status-unavailable` n'existe. **Correction** : nommer le token réellement utilisé pour l'erreur (les trois valeurs passent 4,26-4,96:1 sur *surface*, donc OK pour un texte, pas pour une icône seule).

### L7 — Libellés de raison hétérogènes entre en-tête et lignes
En-tête : « (dès le niveau 5) », « (non réservables) », « — quota atteint » sans ⊘ ; lignes : « ⊘ Admis dès le niveau 5 », « Non réservable : souffle du temps ». EXPERIENCE §3 exige « précédées de ⊘ ». Le nom accessible de l'en-tête (« Rituels (dès le niveau 5) 6 souffles ») reste intelligible, mais l'écart brouille le repérage. **Correction** : aligner le vocabulaire (même phrase, ⊘ décoratif en `aria-hidden`).

---

## Réponses point par point à la demande

1. **Fenêtre modale** : rôle `dialog`, `aria-modal`, nom (`aria-label=title`), piège CDK, Échap, retour au déclencheur existent déjà. Manques : nom incomplet (M3), `inert` (L3), et surtout **focus après « Mettre dans l'emplacement N » = `<body>`** (H1) ; le clavier ne peut pas choisir de souffle (C1).
2. **Catégories** : `h5 > button[aria-expanded][aria-controls]` + `hidden` réel = correct (retiré de la tabulation et de l'arbre d'accessibilité). Le nom accessible contient le titre, la raison (« (non réservables) », « quota atteint ») et le nombre (« 2 souffles » via `.sr`). **Un utilisateur de lecteur d'écran peut donc découvrir et lire les souffles repliés et la raison** — en dépliant ; réserve : à l'intérieur de « Autres races » l'ordre « 0 / 1 souffle autorisé 9 souffles » est ambigu ; le repli est recalculé à chaque ouverture (acceptable).
3. **Lignes grisées** : `aria-disabled` est le bon choix ; la raison est lue car elle est dans le contenu de l'option (nom accessible), pas besoin d'`aria-describedby` pour la ligne — mais il en faut pour le bouton principal (M4). Contraste : exemption « inactif » non fiable ici ; nom à 50 % = 3,97-4,46:1 (M4).
4. **Emplacements** : noms sans le souffle (M1), emplacement vide nommé « Choisir un souffle pour l'emplacement 3 » OK, annonces absentes (H2), `role="alert"` bien placé mais fragile à la répétition (M7), pas d'état de chargement (H2).
5. **Cibles / mobile** : 44 px respectés dans la planche (boutons, en-têtes, lignes 56 px) ; le ✕ réel fait 32 px (M3) ; clavier virtuel sans objet ; zone épinglée non supportée par `DetailSurface` et dangereuse en paysage/400 % (H3) ; zones sûres (L4).
6. **Couleur seule** : bien traité (icône ⊘ + texte, pointillé + libellé, ⚠ + texte, nom de race écrit). Réserve : le texte de race est lui-même peu contrasté (H5), la sélection de ligne repose partiellement sur l'accent (M6).
7. **Zoom / reflow** : H3 (400 %), M5 (ellipse), M8 (ligne d'emplacement).
8. **Mouvement** : L1.
9. **Trois thèmes** : voir le tableau ; échecs : H4, H5, M4, M6, `stat-pill` en atelier (hérité, 3,79:1) et dégradé du bouton primaire en atelier (4,03:1 sur l'extrémité accent-2). `text-muted` sur *surface-high* tient 4,87-5,41:1 dans les 3 thèmes (marge mince en atelier).

## Rappels réglementaires (hors périmètre d'accessibilité)

Aucune contrainte IEC 62304 / gestion des risques n'est concernée : fonctionnalité de jeu, pas de dispositif médical.
