# Validation Report — jdr-master, delta écrans d'authentification et identité de marque (story 34.3)

- **DESIGN.md :** `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/DESIGN.md`
- **EXPERIENCE.md :** `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/EXPERIENCE.md`
- **Run at :** 2026-10-05
- **Lentilles lancées :** accessibilité (`review-accessibilite.md`) uniquement. **Pas de revue de rubrique** (`review-rubric.md` n'existe pas).

## Overall verdict
Une seule lentille a été lancée : la **revue d'accessibilité adversariale** (`review-accessibilite.md`). **Il n'y a pas eu de revue de rubrique** (`review-rubric.md` n'existe pas) : ce rapport ne porte donc aucun verdict par catégorie (couverture des flux, jetons, composants, états, références visuelles, surcharge, héritage, forme) et ne dit rien de ces huit contrôles. Le verdict de la revue, avant amendement : **non conforme WCAG 2.2 AA en l'état**, sans que la direction visuelle soit en cause, tous les contrastes de texte mesurés passant. Les écarts venaient du code existant (`lang="en"`, aucun titre ni repère, validation muette, messages non annoncés), d'omissions du delta (aucune pause de la bande, bord de champ à ~2:1, libellés longs sous le bouton œil, hauteurs fixes) et d'affirmations du delta que la mesure contredisait (« aucun texte tronqué à 320 px »).

Sort des 19 constats (0 critique, 8 hauts, 5 moyens, 6 bas) : **13 intégrés** aux spines, **1 écart accepté** (H1, animation en boucle avec pause au clic qui fige l'animation sur place : WCAG 2.2.2 partiellement non satisfait **et** 2.1.1 non satisfait pour cette commande, décisions de l'utilisateur) et **5 reports** (M2, B1, B2, B4, B5). Deux autres décisions de l'utilisateur élargissent le périmètre de la spec 34.3 sans laisser de non-conformité : les **textes de validation** (H5) et le **jeton de bordure corrigé dans toute l'application** (H7). Les huit constats hauts sont tous traités (sept intégrés, un écart accepté) ; aucun report ne porte sur une gravité haute. Depuis la rédaction de ce rapport, deux décisions de l'utilisateur ont tranché le mécanisme de la pause (gel sur place, une comète ou une luciole figée pouvant rester sous l'accroche, écart 2.1.1 ajouté) et le `role="alert"` de « Lien expiré. » (retiré), et les deux planches de référence ont été amendées pour refléter les spines. Reste ouvert, hors constats : plusieurs recettes (contraste forcé, capture de contraste, remplissage automatique, 320 px) ne sont pas faites.

## Category verdicts
Non applicable : la grille de validation (rubrique) n'a pas été lancée. Aucun verdict par catégorie (flux, jetons, composants, états, références visuelles, surcharge, héritage, forme).

## Comptage par gravité

| Gravité | Constats | Intégrés | Écart accepté | Reports |
| --- | --- | --- | --- | --- |
| Critique | 0 | 0 | 0 | 0 |
| Haute | 8 | 7 | 1 | 0 |
| Moyenne | 5 | 4 | 0 | 1 |
| Basse | 6 | 2 | 0 | 4 |
| **Total** | **19** | **13** | **1** | **5** |

« Intégré » = écrit dans les spines ; le code et la spec 34.3 restent à amender à la reprise du build.

## Décisions de l'utilisateur qui s'écartent de la revue ou de la spec

- **Animation en boucle avec pause au clic** (H1). WCAG 2.2.2 (A) **partiellement non satisfait**, écart accepté. Remplace l'arrêt automatique à 5 s proposé par la revue. À revoir si l'application devient publique. `EXPERIENCE.md` § 7, § 11 (j) ; `DESIGN.md` § 1 ; `.memlog.md`.
- **La pause fige l'animation sur place** (H1, M3). `animation-play-state: paused`, état non mémorisé ; ce n'est pas un retour à la composition de repos (alternative recommandée par la revue, écartée). Conséquence assumée : une comète ou une luciole figée peut rester sous l'accroche (contraste 1,0 à 3,3:1 mesuré). **Écart accepté en plus de 2.2.2** : **2.1.1** (clavier, A), la pause étant réservée au clic / toucher. `EXPERIENCE.md` § 4, § 5, § 11 (j) ; `DESIGN.md` § 1.
- **`role="alert"` retiré du message « Lien expiré. » de Rejoindre** (H6). Message présent au chargement, non produit par une action : texte simple sous le `h1`. `EXPERIENCE.md` § 5, § 11 (i).
- **Textes de validation ajoutés dans la 34.3** (H5). Écart de **périmètre** par rapport à la spec 34.3 (« aucun texte nouveau », « aucun changement fonctionnel ») : levée consignée, aucune non-conformité résiduelle. `EXPERIENCE.md` § 3, § 11 (a)(h).
- **Jeton de bordure `--mat-sys-outline` corrigé pour toute l'application** (H7). Écart de **périmètre** (la revue proposait une variable locale) : même contraste, mais effet sur tous les formulaires et composants ; non-régression visuelle à planifier. `DESIGN.md` § 2 ; `EXPERIENCE.md` § 11 (a)(k).

## Lentille accessibilité (voix adverse conservée)

**Verdict de la revue :** non conforme WCAG 2.2 AA en l'état ; la direction visuelle n'est pas en cause, tous les contrastes de texte mesurés passent. Écarts issus (1) du code existant (défauts de niveau A), (2) d'omissions du delta, (3) d'affirmations du delta que la mesure contredit (« aucun texte tronqué à 320 px », « composition au repos complète »). Comptage : 19 constats, 0 critique, 8 hauts, 5 moyens, 6 bas.

**Limites déclarées :** texte sur la bande modélisé, non photographié (à confirmer par capture) ; lecteur d'écran réel, contraste forcé Windows et remplissage automatique non testés (❓ : M4, B5).

## Findings by severity

### Critique (0)
Aucun constat critique.

### Haute (8)

**[Accessibilité]** — H1 : Animation en boucle infinie, sans pause, arrêt ni masquage (2.2.2, A) (§ review-accessibilite.md § H1 ; EXPERIENCE.md § 4, 7 ; DESIGN.md § 1)
Le mouvement démarre seul, dure plus de 5 s, accompagne un contenu (le formulaire) et n'est pas essentiel : les trois conditions de 2.2.2 sont réunies. `prefers-reduced-motion` est un réglage système que la plupart des personnes concernées n'ont pas activé et n'est pas une technique suffisante. Mesuré : 19 animations infinies en Émeraude, 14 en Forêt, 7 en Atelier.
Fix (revue) : Arrêt automatique à 5 s vers un état de repos sain (classe `is-still`, `animation: none`, immédiat sous reduced-motion) ; variante : bouton pause de 44 px.
**Sort : écart accepté.** **Écart d'accessibilité accepté, décisions de l'utilisateur (2026-10-05).** Boucle conservée ; pause / reprise au clic ou au toucher sur le fond animé, sans bouton visible ; arrêt à 5 s non retenu. **La pause fige l'animation sur place** (`animation-play-state: paused`, état non mémorisé), sans retour à la composition de repos ; une comète ou une luciole figée peut rester sous l'accroche (contraste 1,0 à 3,3:1 mesuré). Raison donnée : peu d'effort d'accessibilité à ce stade, à revoir si l'application devient publique. **WCAG 2.2.2** reste partiellement non satisfait (commande non découvrable, décor `aria-hidden` ; seul `prefers-reduced-motion` coupe l'animation sans geste) et **WCAG 2.1.1** (clavier, niveau A) n'est pas satisfait pour cette commande (clic seulement) : les deux écarts sont acceptés (2.1.1 relevé par ce rapport, puis accepté par l'utilisateur). Consigné dans `EXPERIENCE.md` § 7 « Mouvement » et § 11 (j), et dans `DESIGN.md` § 1. Les bannières de partie et le compte à rebours relèvent de la même règle (hors périmètre ; réglage global « Animations » au backlog).

**[Accessibilité]** — H2 : `<html lang="en">` en réel alors que la spec affirme `fr` (3.1.1, A) (§ review-accessibilite.md § H2 ; EXPERIENCE.md § 7)
`index.html` ligne 2 porte `lang="en"` (confirmé en direct) ; les maquettes en `fr` masquaient l'écart. Un lecteur d'écran lit le français avec une voix anglaise.
Fix (revue) : `<html lang="fr">` dans `index.html` ; critère de recette `document.documentElement.lang === 'fr'`.
**Sort : intégré.** Écrit au contrat : `<html lang="fr">` et critère de recette `document.documentElement.lang === 'fr'` (`EXPERIENCE.md` § 7 « Langue »). Reste à faire à la reprise du build : amender la spec 34.3 (`index.html` y figure déjà).

**[Accessibilité]** — H3 : Titre de page identique partout, aucun signal au changement d'écran (2.4.2 A ; 4.1.3 ; 2.4.3) (§ review-accessibilite.md § H3 ; EXPERIENCE.md § 2, 7, 11 (b))
Sept écrans partagent le même titre (« Web » aujourd'hui) ; aucune propriété `title` sur les routes ; aucune annonce au changement d'écran. Le « compromis » du titre fixe ne tenait pas : le titre par route ne coûte rien.
Fix (revue) : Propriété `title` par route + `TitleStrategy` à suffixe, `LiveAnnouncer` à chaque `NavigationEnd`, titre dynamique pour `join/:token`.
**Sort : intégré.** Intégré avec deux écarts par rapport au correctif proposé : format **préfixe** « Dés Dispos – <page> » (décision de l'utilisateur, `.memlog.md`) au lieu du suffixe ; titre de `join` fixe « Dés Dispos – Rejoindre », le titre dynamique avec le nom de la partie n'est pas retenu (`EXPERIENCE.md` § 11 (k)). `TitleStrategy` + `LiveAnnouncer` spécifiés (§ 7). Le titre fixe de § 11 (b) est abandonné. Six des noms de page restent `[ASSUMPTION]`.

**[Accessibilité]** — H4 : Aucun titre ni repère dans le code ; les maquettes contredisent la spec (1.3.1, 2.4.1, A) (§ review-accessibilite.md § H4 ; EXPERIENCE.md § 4, 7 ; DESIGN.md § 7)
`<mat-card-title>` rend un `<div>` (aucun titre en direct), aucun `main` / `header`. Les maquettes rendent le titre de carte en `h2` et posent `<main>` sur la carte elle-même : copier les maquettes produit un `h2` sans `h1`.
Fix (revue) : `<h1 matCardTitle>` ; `<header>` frère de `<main>` ; `<main>` = conteneur de la carte avec `aria-labelledby` ; corriger les deux planches ; `overflow-wrap: anywhere` sur le `h1`.
**Sort : intégré.** Écrit au contrat : un seul `h1` par écran (`<h1 matCardTitle>`), `<header>` frère de `<main>`, `<main>` conteneur de la carte, `overflow-wrap: anywhere`. Les planches de `mockups/` ont été amendées depuis (titre de carte en `h1`, `<main aria-labelledby>` distinct de la carte ; incohérence 2).

**[Accessibilité]** — H5 : Validation muette : aucune erreur de champ, nommée ni annoncée (3.3.1, 3.3.3, 1.4.1, 3.3.2) (§ review-accessibilite.md § H5 ; EXPERIENCE.md § 3, 4, 5, 7)
Envoi invalide = `return` sans message ; aucun `<mat-error>` dans les six gabarits ; seule la couleur des contours change, focus laissé sur `<body>`. La règle « pseudo de 3 caractères » n'est donnée nulle part. Ne rien faire aurait été un choix de non-conformité de niveau A.
Fix (revue) : `markAllAsTouched()`, focus sur le premier champ invalide, un `<mat-error>` court par règle ; arbitrer la levée de « aucun texte nouveau » ou reporter à l'épic 35.
**Sort : intégré.** Intégré par **décision de l'utilisateur : textes de validation ajoutés, dans la 34.3** (`.memlog.md`, décision VALIDATION DES FORMULAIRES). Quatre clés de ton × trois thèmes qui nomment toujours la règle (`auth.field_required`, `auth.field_email_invalid`, `auth.field_pseudo_min`, `auth.field_password_min`), `aria-invalid` + `aria-describedby`, focus sur le premier champ invalide. **Écart de périmètre assumé** : la spec 34.3 interdisait tout texte nouveau et un changement fonctionnel ; l'interdiction est levée (`EXPERIENCE.md` § 11 (a), (h)). Reste : rédiger les textes thématiques finaux, test de parité, source unique des seuils 3 et 8.

**[Accessibilité]** — H6 : Messages d'état sans rôle, réussites non annoncées, focus perdu (4.1.3 AA ; 2.4.3) (§ review-accessibilite.md § H6 ; EXPERIENCE.md § 5, 7, 11 (k))
Cinq écrans sans `role="alert"` ; trois états de réussite muets alors que le bouton activé disparaît et que le focus tombe sur `<body>` ; « Chargement… » de `join` hors région de statut.
Fix (revue) : `role="alert"` sur les erreurs après action ; texte simple sous le `h1` pour les messages présents au chargement ; conteneur `role="status"` persistant + focus déplacé après réussite.
**Sort : intégré.** Intégré tel que dans la revue : `role="alert"` (erreurs après action, tous écrans), `role="status"` persistant (réussites, « Chargement… »), focus déplacé, messages présents au chargement en texte simple. `EXPERIENCE.md` § 11 (k) signale que la décision de l'utilisateur ne disait que « alert pour erreurs, status pour succès » : le détail vient de la revue, et il **retire** le `role="alert"` prévu pour la raison d'un lien expiré sur « rejoindre ». **Décision de l'utilisateur ensuite : `role="alert"` retiré de « Lien expiré. »** (message présent au chargement, non produit par une action) ; `mockups/key-rejoindre.html` amendée en conséquence.

**[Accessibilité]** — H7 : Bord de champ sous 3:1 dans les trois thèmes (1.4.11, AA) (§ review-accessibilite.md § H7 ; DESIGN.md § 2 ; EXPERIENCE.md § 7, 11 (a))
Contour 1 px seul signe de la zone de saisie : 2,40 / 1,96 / 2,34:1, surtout critique en Forêt. Zone d'action principale de l'écran.
Fix (revue) : Variable **locale** `--mat-form-field-outlined-outline-color` sur la carte d'authentification : `#6e6383` / `#54735c` / `#8b6541` (3,21 / 3,26 / 3,12:1).
**Sort : intégré.** Intégré par **décision de l'utilisateur : jeton de bordure corrigé dans toute l'application** (`styles.scss`) au lieu de la variable locale proposée (« je vois pas trop la diff, donc on fait ça dans toute l'appli », `.memlog.md`). Mêmes valeurs que la revue. Recalcul indépendant par le présent rapport sur la surface de carte : 3,21 / 3,25 / 3,12:1 (conforme aux 3,2 / 3,3 / 3,1 du `DESIGN.md`). **Écart de périmètre assumé** : le jeton sert à tous les formulaires et à d'autres composants ; le **contrôle visuel de non-régression sur l'application entière** reste à planifier (`DESIGN.md` § 2 ; `EXPERIENCE.md` § 11 (a) et (k)). Les planches portent désormais les valeurs corrigées.

**[Accessibilité]** — H8 : Libellés longs en collision avec le bouton œil, à 320 et 375 px (1.4.10, 1.4.4, AA) (§ review-accessibilite.md § H8 ; EXPERIENCE.md § 2, 4, 9 ; DESIGN.md § 4)
Contredit « aucun texte tronqué » : mesuré en direct, « caractères) » passe sous l'icône œil à 320 px (`/register`) et à 375 px (`/reset-password`).
Fix (revue) : Consigne sortie du libellé : `<mat-label>Mot de passe</mat-label>` + `<mat-hint>8+ caractères</mat-hint>` ; hint « 3+ caractères » au pseudo.
**Sort : intégré.** Intégré : « 8+ caractères » en `mat-hint` sous les deux champs de mot de passe, libellés raccourcis ; le message de validation remplace l'aide tant que la règle n'est pas respectée. Le hint « 3+ caractères » du pseudo n'est pas retenu (le message de validation nomme déjà la règle, `EXPERIENCE.md` § 11 (k)). Recette 320 px à faire.

### Moyenne (5)

**[Accessibilité]** — M1 : Hauteurs fixes : bande de 196 px à `overflow: hidden`, bouton de 48 px, tailles en `px` (1.4.4, 1.4.12, 1.4.10) (§ review-accessibilite.md § M1 ; DESIGN.md § 3, 4, 7 ; EXPERIENCE.md § 4, 7)
Zoom navigateur OK, mais la taille de texte système ne grossit que le texte : accroche et bloc-marque rognés dans une bande fixe, libellé de bouton sur trois lignes qui déborde. Georgia absente sur Android : repli plus large.
Fix (revue) : `min-height` jamais `height` ; `overflow: hidden` sur le seul calque de décor ; bouton `height: auto` ; tailles en `rem`.
**Sort : intégré.** Intégré en partie : `min-height` sur la bande (196 px) et sur le bouton principal (48 px, `padding-block` 12 px, libellé à la ligne), `overflow` limité au calque de décor, recette 320 px avec « Continuer vers la réinitialisation du mot de passe » puis espacement de texte 1.4.12. **Non contraint** : les tailles en `rem` restent une `[ASSUMPTION]` (`DESIGN.md` § 3 ; `EXPERIENCE.md` § 11).

**[Accessibilité]** — M2 : Bouton œil : `aria-pressed` et libellé changeant cumulés (4.1.2) (§ review-accessibilite.md § M2 ; EXPERIENCE.md § 4, 7, 11 (k))
Le motif WAI-ARIA des boutons à bascule demande un libellé constant : « Masquer le mot de passe, bouton à bascule, enfoncé » se lit comme une double négation.
Fix (revue) : Retirer `aria-pressed` ou fixer le libellé ; mettre à jour la spec 34.2 et ses tests.
**Sort : report.** **Report** : le bouton est livré en 34.2 (spec et tests) ; l'arbitrage (retirer `aria-pressed` ou fixer le libellé) n'est pas pris. `EXPERIENCE.md` § 4 le marque « arbitrage en report » et § 7 décrit « forme + libellé (+ `aria-pressed` tant que M2 est en report) ».

**[Accessibilité]** — M3 : État « repos » non sain en Émeraude (comète figée) ; objets lumineux sous le texte (§ review-accessibilite.md § M3 ; DESIGN.md § 1, frontmatter ; EXPERIENCE.md § 5, 11 (f)(k))
`.fly` sans opacité de base : animations annulées, la comète reste opacité 1, tête allumée, sur le sommet du logo et le « D » (x 10-80, y 33-67 à 375 px). Transitoire : contraste de l'accroche 1,0 à 3,3:1 sous une comète ou une luciole. En Atelier la jauge effleure la zone de protection du logo.
Fix (revue) : `.fly { opacity: 0 }` au repos ; vérifier sur capture sous reduced-motion et après arrêt ; décaler la jauge de 8 px ou accepter.
**Sort : intégré.** Intégré pour l'état **sous `prefers-reduced-motion`** : `.fly` à `opacity: 0`, composition au repos sans comète, rien ne chevauche le logo ni le texte (vérifié à la lecture du CSS seulement, § 11 (f)). **Résiduel** : (a) la **pause au clic** fige l'animation sur place et peut laisser une comète ou une luciole sous l'accroche (contraste 1,0 à 3,3:1) : **écart accepté par l'utilisateur** (incohérence 1, § 11 (j)) ; (b) la jauge d'Atelier qui effleure le logo reste un choix visuel non tranché (§ 11 (k)).

**[Accessibilité]** — M4 : Mode contraste forcé (Windows) non spécifié (1.4.3, 1.4.11)  ❓ (§ review-accessibilite.md § M4 ; DESIGN.md § 7 ; EXPERIENCE.md § 5, 7)
Aucune mention de `forced-colors` : remplissages SVG possiblement convertis en aplats sous le texte, bouton pilule sans frontière. Non testé faute d'outil.
Fix (revue) : `@media (forced-colors: active)` : scène et voile masqués, bord `1px solid ButtonText` ; recette manuelle Windows 11.
**Sort : intégré.** Spécifié (scène et voile masqués, action principale bordée `ButtonText`). **Recette manuelle** Windows 11 « Aquatique » et « Crépuscule » à faire ; ❓ non testé.

**[Accessibilité]** — M5 : Focus visible non spécifié pour liens, bouton principal et liens-boutons (2.4.7, 1.4.11) (§ review-accessibilite.md § M5 ; DESIGN.md § 7 ; EXPERIENCE.md § 6, 7)
Le focus Material du bouton plein (anneau `accent-2`, 3,34:1 en Atelier) et le contour par défaut des liens étaient supposés conformes ; un `outline: none` pour obtenir la pilule le ferait disparaître.
Fix (revue) : `:focus-visible` = contour 2 px `accent-1`, décalage 2 px, jamais `outline: none`.
**Sort : intégré.** Intégré tel que proposé (≥ 5,2:1 sur carte dans les trois thèmes) ; le bouton œil garde son focus livré en 34.2 (`[ASSUMPTION]`). Vérifier à la recette que la pilule affiche le contour.

### Basse (6)

**[Accessibilité]** — B1 : Marge de contraste de l'accroche en Émeraude à 320 px, voile inopérant à droite (§ review-accessibilite.md § B1 ; DESIGN.md § 2 ; EXPERIENCE.md § 7, 11)
5,23:1 au pic d'animation (marge 0,7) : passe, mais le voile tombe à ~1 % à l'extrémité droite de l'accroche, là où commence le filigrane. Aucun garde-fou : un halo ou une accroche plus long le feraient chuter.
Fix (revue) : Critère de recette ≥ 4,5:1 mesuré sur capture à 320 px dans les trois thèmes ; ne pas toucher au filigrane sans remesure ; option : plafonner l'accroche à 200 px.
**Sort : report.** **Report** : aucun changement de design. Critère de recette repris (mesure sur capture à 320 et 375 px, trois thèmes, au pic) et consigne « ne pas modifier le filigrane sans refaire la mesure » ; plafonnement à 200 px non retenu.

**[Accessibilité]** — B2 : Erreur en Atelier Cuivré à 4,513:1, marge nulle (1.4.3) (§ review-accessibilite.md § B2 ; EXPERIENCE.md § 7, 11)
Hérité. Toute transparence (`opacity`, fondu d'apparition, fond de carte plus clair) le fait tomber sous 4,5:1.
Fix (revue) : Interdire l'opacité sur `auth-error` ou éclaircir l'erreur (`#d66f82`, 5,0:1).
**Sort : report.** **Report** : marge nulle connue et consignée ; garde-fou ou éclaircissement à décider.

**[Accessibilité]** — B3 : « Rejoindre » : états non annoncés, nom de partie sans espaces, erreur sans rôle (§ review-accessibilite.md § B3 ; EXPERIENCE.md § 5, 7)
« Chargement… » sans région de statut ; un nom long sans espaces déborde la carte à 320 px.
Fix (revue) : Cf. H3, H4, H6 : « Chargement… » dans le conteneur `role="status"`, `overflow-wrap: anywhere` sur le `h1`.
**Sort : intégré.** Intégré par H4 et H6 (conteneur `role="status"` persistant, `overflow-wrap: anywhere`).

**[Accessibilité]** — B4 : Erreur de connexion non reliée aux champs ; pas de suggestion de correction (§ review-accessibilite.md § B4 ; EXPERIENCE.md § 7)
Le message `role="alert"` n'est relié à aucun champ ; l'absence de suggestion sur `auth.login_invalid` est admissible (garde-fou d'énumération).
Fix (revue) : Optionnel : `aria-describedby` du message sur le champ de mot de passe.
**Sort : report.** **Report** : le `aria-describedby` optionnel n'est pas décidé ; l'exception de sécurité sur `auth.login_invalid` est intégrée (§ 7).

**[Accessibilité]** — B5 : Remplissage automatique sur thème sombre  ❓ (§ review-accessibilite.md § B5 ; EXPERIENCE.md § 11 (i))
Chrome et Edge appliquent un fond et une couleur propres aux champs remplis, de contraste variable ; non testé.
Fix (revue) : Essai en recette dans les trois thèmes (≥ 4,5:1) ; `:-webkit-autofill` seulement si l'essai échoue.
**Sort : report.** **Report** : à tester à la recette ; correctif conditionnel à l'échec de l'essai.

**[Accessibilité]** — B6 : Logo : nom accessible redondant, `id` SVG globaux (§ review-accessibilite.md § B6 ; EXPERIENCE.md § 7 « Décor »)
`logo-bloc-marque.svg` porte `role="img" aria-label` : inliné à côté du texte « Dés Dispos », le nom serait lu deux fois ; le masque `g-cut` est global.
Fix (revue) : Pictogramme `aria-hidden` + texte HTML ; `id` uniques ou `<defs>` partagé une fois.
**Sort : intégré.** Intégré : bloc-marque de la bande = pictogramme + texte HTML (pas `logo-bloc-marque.svg`), `id` du masque uniques ou `<defs>` partagé. Le doublon du point « Décor » en § 7 a été supprimé (incohérence 5).

## Incohérences entre la revue et les documents amendés

Six incohérences relevées à la rédaction du rapport ; **cinq sont résolues** et la n° 4 est **sans objet** (aucun écart à résoudre).

1. **Pause au clic : le memlog et `EXPERIENCE.md` se contredisaient, et la revue déconseillait le mécanisme du memlog.** Le memlog fixait le gel à l'instant du clic (`animation-play-state: paused`) ; `EXPERIENCE.md` § 11 (k) le disait non tranché et proposait un retour à l'état de repos sain ; la revue (H1, M3, B1) avait mesuré 1,0 à 3,3:1 sous une comète ou une luciole et recommandé `none`. **Résolue par décision de l'utilisateur (2026-10-05)** : la pause **fige l'animation sur place** (`animation-play-state: paused`), état non mémorisé, pas de retour au repos. Conséquence assumée : une comète ou une luciole figée peut rester sous l'accroche (contraste 1,0 à 3,3:1 mesuré) ; écarts acceptés WCAG 2.2.2 (partiel) et 2.1.1 (pause au clic seulement). Aligné dans `EXPERIENCE.md` § 4, § 5, § 7, § 11 (j) et dans `DESIGN.md` § 1 ; le point a quitté les questions ouvertes (§ 11 (k)). M3 reste « intégré » pour l'état sous `prefers-reduced-motion` ; l'état en pause relève de l'écart accepté.
2. **Les planches de référence promues dans `mockups/` n'avaient pas été amendées.** **Résolue** par l'amendement de `mockups/key-connexion.html` et `key-rejoindre.html` (sans refonte ni nouveau fichier) : titre de carte en `h1` et `<main aria-labelledby>` distinct de la carte, `.fly` à `opacity: 0` de base, jetons de bordure `#6e6383` / `#54735c` / `#8b6541`, `role="alert"` retiré de « Lien expiré. », pause au clic en `animation-play-state: paused` (petit script), variante « envoi invalide » avec messages de validation (connexion). **Non reflété sur les planches** : l'aide « 8+ caractères » (`mat-hint`), faute d'écran qui la porte (inscription et réinitialisation ne sont pas maquettées, `EXPERIENCE.md` § 11 (e)). La phrase de `DESIGN.md` § 1 sur la composition de repos a été remplacée par une définition vérifiable (rendu avec `animation: none`) ; la règle « les spines l'emportent sur les planches » reste valable.
3. **La revue n'avait pas été mise à jour avec le sort des constats.** **Résolue** : `review-accessibilite.md` est en `status: final` et renvoie à ce rapport pour le sort de chaque constat. Les comptages (19 ; 0 / 8 / 5 / 6 ; 13 intégrés, 1 écart, 5 reports) restent cohérents entre la revue, `EXPERIENCE.md` § 11 (i) et ce rapport.
4. **Les intégrations H3, H5, H7 divergent du correctif proposé.** H3 : préfixe au lieu du suffixe, pas de titre dynamique pour `join`. H5 : textes ajoutés (la revue demandait d'arbitrer). H7 : jeton global au lieu d'une variable locale. Documenté dans `EXPERIENCE.md` § 11 (i)(k) ; aucune contradiction entre les documents, **pas d'écart à résoudre**.
5. **`EXPERIENCE.md` § 7 contenait deux fois le point « Décor ».** **Résolue** : doublon supprimé, version enrichie conservée en tête de § 7. La mention de `aria-pressed` dans « Information jamais par la couleur seule » précise désormais que M2 est en report.
6. **Le périmètre de l'écart accepté sur 2.2.2 était sous-déclaré.** **Résolue** : l'utilisateur accepte aussi l'écart **WCAG 2.1.1** (clavier, niveau A : pause au clic seulement) ; consigné dans `EXPERIENCE.md` § 7 et § 11 (j), `DESIGN.md` § 1 et § 8.

## Reste à faire (à décider)

- Arbitrer M2 (`aria-pressed` ou libellé fixe, impact spec 34.2), B2 (erreur Atelier), B4 (`aria-describedby`), B1 (plafond de l'accroche), jauge d'Atelier.
- Recettes : contraste forcé Windows (M4), capture de contraste nom + accroche à 320 et 375 px au pic (B1), remplissage automatique (B5), 320 px avec libellé long et espacement de texte 1.4.12 (M1, H8), composition de repos sous `prefers-reduced-motion` (M3 : lucioles et volutes visibles à leur position de départ, rien ne doit chevaucher le logo ni le texte).
- Contrôle visuel de non-régression de `--mat-sys-outline` sur toute l'application (H7).
- Rédiger les textes thématiques des 4 clés de validation, de l'accroche et de la ligne d'orientation, avec test de parité (H5).
- Amender la spec 34.3 (conflits listés en `EXPERIENCE.md` § 11 (a)).
## Reviewer files
- `review-accessibilite.md`
- (`review-rubric.md` : non produit, rubrique non lancée)

Voir aussi : `validation-report.html` (même contenu, mise en forme repliable).
