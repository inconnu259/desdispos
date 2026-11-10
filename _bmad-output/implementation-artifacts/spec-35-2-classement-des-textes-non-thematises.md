---
title: 'Classement des textes : thématisés ou non'
type: 'refactor'
created: '2026-10-05'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd40094f037124076e9b828ec8f2b4b8c0872ec91'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-35-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les textes de l'application sont répartis entre le registre de thème (379 clés par thème) et environ 840 occurrences codées en dur dans les composants, sans règle écrite pour dire lesquels relèvent d'un thème ; le registre contient en outre des clés que rien n'utilise. La revue éditoriale (35.3) n'a donc pas de périmètre net.

**Approach:** Écrire la règle de classement et statuer chaque texte (thème ou non) ; supprimer les libellés orphelins ; faire entrer au registre **tous** les textes en dur qui relèvent d'un thème.

## Boundaries & Constraints

**Always:**
- Relève d'un thème : le ton de l'application (boutons, titres d'écran, états vides et de chargement, confirmations, messages d'erreur et de succès, liens de navigation, textes d'aide à l'utilisation). Hors thème : contenu et vocabulaire d'un système de jeu (Ryuutama : fiche, races, règles, aides à la création de personnage, catalogues), noms propres et marque (« Dés Dispos »), vocabulaire de domaine (créneaux « Après-midi », « Journée »…), unités, dates.
- Les textes d'un système de jeu restent **où ils sont** : ni migrés au registre, ni déplacés. Leur sortie vers un fichier lié au système est une autre story (`deferred-work.md`).
- Un texte migré prend sa formulation actuelle, **identique dans les trois thèmes** (la 35.2 déplace, la 35.3 réécrit les voix). Une formulation qui se répète (« Annuler », « Retour à la connexion »…) devient **une** clé commune, pas une par écran.
- Une clé s'ajoute d'abord à `grimoire-emeraude` (type de référence), puis aux deux autres thèmes ; préfixe par fonctionnalité, comme l'existant. Les clés construites dynamiquement ne sont jamais supprimées.
- Un `aria-label`/`title` suit son texte visible ; un libellé purement technique est hors thème.
- Commentaires et messages en français ; aucune dépendance ajoutée.

**Never:**
- Ne pas réécrire la voix ni corriger le tutoiement/vouvoiement (35.3).
- Ne pas modifier le contenu des textes migrés, ni leur comportement.

## I/O & Edge-Case Matrix

| Scénario | Entrée / État | Comportement attendu | Erreur |
|----------|--------------|---------------------|--------|
| Texte migré | « Annuler » d'un formulaire | Même texte à l'écran dans les trois thèmes, lu depuis le registre | N/A |
| Texte de jeu | « Saison d'affinité » | Reste en dur, classé hors thème | N/A |
| Clé orpheline | clé du registre utilisée nulle part | Supprimée des trois thèmes | N/A |
| Clé dynamique | `partie.signal_*`, `dashboard.sort_*`… | Conservée | N/A |
| Clé absente d'un thème | clé ajoutée à un seul thème | Échec de `pnpm build` et du test de parité | erreur de type |

</frozen-after-approval>

## Code Map

- Registre : `apps/web/src/app/core/theme/tones/{grimoire-emeraude (référence),foret-ancienne,atelier-cuivre}.ts` ; test de parité dans `core/theme/theme-tone.service.spec.ts`.
- Orphelines à supprimer des trois thèmes : `dashboard.controls_toggle_aria`, `dashboard.sort_label`, `partie.show_troupe`, `partie.hide_troupe`, `cta.launch_vote`, `cta.send_reminder`, `section.constraints`, `empty.no_constraints`, `alert.expiring_soon`, `status.unavailable_label`, `status.unknown_label`, `empty.no_poll`, `success.date_chosen`, `character.tab_label`, `character.portrait_missing`, `account.save_btn`, `account.email_change_title` (ces deux-là : fixture de `account.spec.ts` L47/L58 à nettoyer). Revérifier chaque clé par recherche avant suppression.
- Clés dynamiques à conserver : `account.calendar_intent.*`, `account.calendar_layer.*`, `character.equipment_group_*`, `character.equipment_qty_*`, `dashboard.sort_*`, `my_characters.sort_*`, `list_control_bar.view_mode_*_aria`, `partie.signal_*`, `partie.kind_*`.
- Textes en dur à migrer (comptes approximatifs, ±15 %) : `features/characters` ~200 (hors libellés de fiche Ryuutama), `calendar` ~190, `homme-dragon` ~155 (chrome seulement : « Annuler », « Chargement… », erreurs, export), `scenarios` ~130, `auth` ~43 (dont titres de routes `app.routes.ts:24-61`), `parties` ~40 (`visibility-locks`, `confirm-dialog`), `poll` ~28, `join` ~10, `shared/*` ~8, `core/*` ~15 (`status-badge.model.ts`, `page-title.strategy.ts`, `realtime.service.ts`, `availability.service.ts`, `parties.util.ts`). Récurrences : « Annuler » ×20, ~85 « Impossible de … Réessayez. ». Les fonctions pures sans injection : renvoyer une clé et laisser l'appelant résoudre, sans changer le comportement.
- Document de classement : `docs/textes-classement.md` (à créer) : la règle ci-dessus et, par fonctionnalité, les familles de textes hors thème.
- Tests des composants touchés : leurs specs assertent les textes littéraux, qui ne changent pas ; ajouter `ThemeToneService` aux providers si besoin.

## Tasks & Acceptance

**Execution:**
- [x] `docs/textes-classement.md` -- règle de classement + statut par fonctionnalité
- [x] `core/theme/tones/*` + `account.spec.ts` -- suppression des 17 orphelines, jamais d'une clé dynamique
- [x] `features/auth`, `features/join`, `app.routes.ts` -- textes en dur vers le registre
- [x] `features/characters`, `features/homme-dragon` (chrome seulement) -- idem
- [x] `features/calendar`, `features/poll`, `features/scenarios` -- idem
- [x] `features/parties`, `shared/*`, `core/*` -- idem
- [x] `theme-tone.service.spec.ts` -- parité des clés inchangée et verte ; test des clés communes

**Acceptance Criteria:**
- Given chaque texte affiché, when le classement est terminé, then il est statué thème ou hors thème dans `docs/textes-classement.md`.
- Given un texte de jeu, when on lit le registre, then il n'y figure pas.
- Given un texte thématisable codé en dur, when la story est livrée, then il est lu depuis le registre, identique dans les trois thèmes.
- Given une clé orpheline, when la story est livrée, then elle a disparu des trois thèmes.

## Implementation Notes

- Implémenté par un sous-agent qui a réparti le travail en neuf zones parallèles (auth/join/routes, fiche, assistant, Homme Dragon, calendrier ×2, scénarios, parties/votes, shared/core) ; chaque zone livrait ses clés dans un fragment, fusionnées ensuite dans les trois thèmes par un script d'une passe (contrôle des collisions, des textes divergents et des doublons). Écart au « séquentiel » du workflow, assumé : l'arbre est resté cassé jusqu'à la fusion.
- Résultat : 524 clés ajoutées à chacun des trois thèmes (111 `common.*`, 413 par fonctionnalité), 17 orphelines supprimées, `tone-format.ts` (`fillTone`) pour les trous `{nom}`, `docs/textes-classement.md`. Le texte migré est identique à l'ancien et identique dans les trois thèmes.
- Doublons consolidés à la fusion (7 paires, mêmes mots sous deux clés) ; gardées séparées exprès : `parties.detail_tab_scenarios`/`scenarios.list_title`, `parties.detail_tab_timeline`/`scenarios.timeline_title` (onglet vs titre d'écran), et les clés `_2` dont le texte diffère d'un glyphe (`common.precedent_2`, `suivant_2`, `chargement_2`, `date_a_definir_2`).
- Signatures changées : `buildRosterRows` (reçoit les textes du thème), `partieKindLabelKey` remplace `partieKindLabel`, `buildWeek` et les libellés de piste de vote reçoivent `tone` (défaut : thème de référence, à câbler avant que la 35.3 ne réécrive les voix).
- Corrigé à la relecture : maquettes de thème incomplètes dans `account.spec.ts` et `reserve-picker.spec.ts` (clés `characters_sheet.field_edit_aria`, `shared.detail_close_*`) ; formatage Prettier des fichiers conformes avant la story.
- Vérifié : tests web complets (seuls les 2 échecs préexistants de `calendar-view.spec.ts`), `pnpm build` web propre, 4 tests ajoutés (clés communes identiques, trous identiques, valeurs non vides, orphelines absentes), contrôle indépendant des textes restants (0 thématisable ; 5 cas limites classés hors thème dans le document).
- Non vérifié : parcours manuel dans le navigateur des trois thèmes ; les `aria-label` de `mat-button-toggle`/`mat-radio-group` passés en liaison (lus par Material) ne sont vus que par les tests de composant.

## Review Triage Log

- **[blind] Textes encore en dur dans des fichiers touchés (« Pouvoir d'éveil à choisir », « Voyageurs protégés », « Emplacement libre », créneaux Matin/AM/Soir/Journée, liste XP, `SLOT_LABELS` dupliqué, étape « Avatar »)** — `low`, rejeté : tous classés hors thème par la règle (vocabulaire de jeu ou de domaine) ; le contrôle indépendant de complétude ne trouve aucun texte thématisable restant. Une garde automatisée contre les littéraux français est hors périmètre.
- **[blind/verif-gap] « Clés typées » incomplet : `TONE_MAP` large, clés dynamiques en `string` (`toneTitle`, `STATUS_LABEL_KEYS`, `ANSWER_*_KEYS`, `*_one/_many`), aucun test des clés référencées** — `medium`, defer : aucune clé manquante aujourd'hui (531 clés littérales vérifiées par script) ; le type large est un choix de la 35.1 ; l'accesseur typé est plus large que cette story.
- **[blind] `fillTone` silencieux, noms de trous mêlant français et anglais** — `low`, rejeté : la parité des trous entre thèmes est testée (ajouté), les 92 appels ont été vérifiés par script ; les noms de trous sont cosmétiques.
- **[blind/edge/verif-gap] Défaut `TONE_MAP['grimoire-emeraude']` / `DEFAULT_TONE` des fonctions pures (`answerLabel`, `participationAriaLabel`, `groupAriaLabel`, `buildWeek`, `hommeDragonAventuresLabel`) : un appelant qui oublie `tone` reste silencieusement sur le thème de référence ; threading jamais testé avec un dictionnaire différent** — `medium`, defer : sans effet tant que les textes sont identiques dans les trois thèmes (tous les appelants de composants passent `tone`, vérifié) ; à rendre obligatoire et à tester avant que la 35.3 ne diverge les voix.
- **[blind/edge] Titres de route résolus une seule fois, commentaire « suit le thème actif » faux, clé absente → titre `undefined`** — `low`, patch : commentaire corrigé ; les écrans d'authentification n'ont pas de sélecteur de thème et les sept titres sont testés avec la vraie configuration (`app.config.spec.ts`).
- **[blind] Noms de clés incohérents (slugs de phrases sous `common.`, suffixes `_2`, `common.8_caracteres`, trois mots d'état « inconnu » différents)** — `low`, rejeté : la règle de la spec est le slug du texte actuel ; les trois « inconnu » portent trois textes d'origine différents, conservés tels quels.
- **[blind/edge] Phrases assemblées en fragments, accords `s` en dur, ordre des mots dans le code (`conflict-dialog` `kindLabel + 's'`, « Tu déclares <b>…</b> », `roster-row.util`), `kindLabel` de la boîte de conflit réutilisant les mots d'état `week_status_*`** — `medium`, defer : comportement conservé à l'identique (la spec interdit d'en changer) ; deviendra faux quand la 35.3 réécrira les voix. Couplage `week_status_*` consigné dans `docs/textes-classement.md`.
- **[blind/edge] Tri « Type » dépendant de l'orthographe des clés `core.parties_kind_*`** — `low`, rejeté : l'ordre est verrouillé par `party-sort.spec.ts` (L89-98) et le commentaire du code l'explique.
- **[blind] Chaînes calculées une fois (erreurs, `statusMessage`, `kindLabel`) qui ne suivent pas un changement de thème en cours d'affichage** — `low`, rejeté : un changement de thème pendant l'affichage d'un message d'erreur est improbable ; comportement identique à l'existant pour les chaînes déjà thématisées.
- **[blind] Valeurs chiffrées dans le texte du registre (« maximum (12) », « Quarante créneaux », « quelques secondes ») qui dériveraient du code** — `low`, rejeté : texte migré à l'identique, la dérive existait déjà avec les textes en dur.
- **[blind] Textes venant de l'extérieur (`placement.reason` de game-rules, message serveur, formats `fr-FR`) hors registre** — `false` : déjà hors thème par la règle du document (contenu serveur, jeu, dates).
- **[blind] Trois idiomes de remplissage (`fillTone`, `.replace`, champ `fillTone` du panneau d'XP), `slot.seanceLabel ?? ''`, signature de `buildRosterRows`** — `low`, rejeté : `.replace` est l'idiome existant ; `?? ''` remplace un « undefined » affiché par un vide ; les deux seuls appelants de `buildRosterRows` sont à jour.
- **[edge] `String.replace('{names}', …)` avec un pseudo contenant `$&`** — `low`, rejeté : idiome préexistant (même `replace` au HEAD), cas improbable.
- **[edge] `docs/textes-classement.md` §5 affirme des clés séparées qui n'existent plus (doublons consolidés)** — `medium`, patch : section corrigée.
- **[edge] Vocabulaire de jeu entré au registre (`characters_wizard.attributes_banner_*`, « Créer une arme libre », `hd.reserve_pick_btn`, `hd.picker_*`, `hd.sheet_cadeau_*`) alors que le document classe attributs, arme libre et réserve hors thème** — `low`, rejeté : seul l'habillage d'interaction (boutons, bannières, invites) est migré, les noms et règles restent en dur ; la frontière est au cas par cas et déjà listée parmi les points à réexaminer en 35.3.
- **[verif-gap] Textes de `ComposeConfirmDialog` sans test (avertissement AC6 au singulier/pluriel)** — `medium`, patch : `compose-confirm-dialog.spec.ts` ajouté (5 tests).
- **[verif-gap] Accords et trous de `ConflictDialog` non assertés** — `medium`, patch : 4 tests ajoutés (têtes, compteur, ligne d'exception, annonce du défilé).
- **[verif-gap] `kindLabel` / `intentLabel` de `CalendarView` non assertés** — `medium`, patch : assertions ajoutées au test AC2 du lot.
- **[verif-gap] `aria-label` des cases du mois non testé** — `medium`, patch : test ajouté (aujourd'hui, autre jour, hors du mois).
- **[verif-gap] Textes paramétrés sans assertion (`invité par`, « Montant suggéré », heure illisible, « et 1 autre », `bannerCloseLabel`)** — `low`, defer : risque cosmétique, regroupé avec les reports.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test web --watch=false` -- expected: tout passe (hors 2 échecs `calendar-view.spec.ts` connus)
- `docker compose exec web pnpm build` -- expected: compilation sans erreur
