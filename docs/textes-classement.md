# Classement des textes : thématisés ou non

Document produit par la story 35.2. Il dit, pour toute l'application web (`apps/web`), quels textes
relèvent d'un **thème** (lus depuis le registre `apps/web/src/app/core/theme/tones/*.ts`) et lesquels
sont **hors thème** (restent en dur, où ils sont).

**Comment l'utiliser.**
- Tout texte ajouté à l'application doit être classé avec la règle de la section 2 avant d'être écrit.
- Si le classement n'est pas évident, demander plutôt que trancher seul.
- La story 35.2 a déplacé les textes au registre, la story 35.3 en a écrit les **trois voix** (section 7).
  Ce document délimite le périmètre de la revue éditoriale et consigne ses décisions (section 5).

## 1. Pourquoi

Avant la 35.2, les textes étaient répartis entre le registre de thème et plusieurs centaines
d'occurrences codées en dur, sans règle écrite. La revue éditoriale n'avait pas de périmètre net.

## 2. La règle

**Relève d'un thème** : le ton de l'application.
- boutons et actions ;
- titres d'écran (y compris titres de route) ;
- états vides et états de chargement ;
- confirmations ;
- messages d'erreur et de succès ;
- liens de navigation ;
- textes d'aide à l'utilisation (placeholders d'exemple, consignes).

**Hors thème** (reste en dur, jamais au registre) :
- contenu et vocabulaire d'un système de jeu (Ryuutama) : libellés de fiche, races, règles, aides à la
  création de personnage, catalogues ;
- noms propres et marque (« Dés Dispos », noms des thèmes, « Homme Dragon ») ;
- vocabulaire de domaine : créneaux « Matin », « Après-midi », « Soir », « Journée » ;
- unités (« Po », « XP », « h », « o ») et dates (formats `Intl`, `date` pipe) ;
- libellés purement techniques jamais affichés ou non lisibles (ligatures d'icônes Material, glyphes,
  valeurs d'enum et d'API, noms de fichiers d'export, classes CSS) ;
- contenu saisi par l'utilisateur ou fourni par le serveur (noms, descriptions, messages d'API,
  libellés de catalogue).

**`aria-label` et `title`** suivent leur texte visible : thème si le texte visible l'est, hors thème sinon.
Un libellé purement technique est hors thème.

## 3. Conventions du registre

- Une clé est préfixée par sa fonctionnalité (`auth.*`, `calendar.*`, `scenarios.*`, `hd.*`, `parties.*`,
  `pollui.*`, `characters_sheet.*`, `characters_wizard.*`, `portrait.*`, `shell.*`, `route.*`, `core.*`,
  `shared.*`…).
- Une formulation qui se répète à l'identique (« Annuler », « Retour à la connexion »…) partage **une seule**
  clé `common.*`, pas une clé par écran.
- Les clés à `{trous}` sont remplies par `fillTone` (`apps/web/src/app/core/theme/tone-format.ts`). Un
  autre usage d'une clé commune à trous doit reprendre les mêmes noms de trous.
- Les fonctions pures sans injection ne lisent pas le registre elles-mêmes : elles renvoient une clé, ou
  reçoivent le registre en paramètre (`tone`). Depuis la 35.3, ce paramètre est **obligatoire** : plus aucun
  défaut sur le thème de référence (une voix divergente rendrait ce repli faux). Un appel sans `tone` ne
  compile pas.
- Accords et ordre des mots vivent dans le registre, jamais dans le code : une phrase entière par cas
  (`calendar.conflict_overwrite_available_one` / `_many`…), pas un mot de base auquel le code colle un « s ».
  Une clé n'est pas réutilisée comme brique d'une phrase d'un autre écran (la boîte de conflit n'emprunte plus
  `calendar.week_status_*`, elle a ses mots `calendar.conflict_kind_*`).
- **Clés construites dynamiquement : ne jamais les supprimer** (une recherche de la clé complète ne les
  trouve pas) :
  `account.calendar_intent.*`, `account.calendar_layer.*`, `character.equipment_group_*`,
  `character.equipment_qty_*`, `dashboard.sort_*`, `my_characters.sort_*`, `list_control_bar.view_mode_*_aria`,
  `partie.signal_*`, `partie.kind_*`, `calendar.conflict_overwrite_*`.
- Ajout d'une clé : d'abord dans `grimoire-emeraude.ts` (type de référence), puis dans
  `foret-ancienne.ts` et `atelier-cuivre.ts`. Une clé absente d'un thème fait échouer `pnpm build` et le
  test de parité de `theme-tone.service.spec.ts`.

## 4. Statut par fonctionnalité

Dans chaque ligne, « thématisé » signifie : tous les textes relevant de la règle lisent le registre. La
colonne de droite liste les **familles** gardées hors thème, avec la raison.

| Fonctionnalité | Thématisé | Familles hors thème (raison) |
|---|---|---|
| `auth` (login, register, forgot/reset-password, confirm/rollback-email-change), `join`, titres de `app.routes.ts` | Oui. Titres de route via `ResolveFn` (`toneTitle`) ; répétitions en `common.*` | Marque « Dés Dispos » et décor SVG de `auth-band` (nom propre) ; motif `pv.reason` renvoyé par l'API (serveur, seul le repli est thématisé) |
| `account`, `dashboard`, `announcements`, `layout/shell` | Oui (clés `account.*`, `dashboard.*`, `shell.*`, `common.accepter`/`refuser`…) | Noms des thèmes (noms propres) ; créneaux `SLOT_LABELS` (domaine) ; noms de systèmes et types de partie (`gameSystemName`) ; dates ; glyphe `✎`, ligatures d'icônes, enums (technique) ; contenu saisi (pseudo, annonce) |
| `characters` : fiche (`character-sheet`, `my-characters`, `character-summary-card`) | Oui pour le chrome : chargement, erreurs, aria des crayons d'édition (préfixe « Modifier {label} »), historique, inventaire (CTA, états vides, placeholders), montée de niveau | Libellés de fiche Ryuutama (attributs, PV/PE, sections, méta « classe · voie · Niveau n »), catégories d'équipement Objets/Contenants/Animaux, descriptions de capacités (`capability-label.util.ts`), catalogues (règles du jeu) ; noms de champs passés aux crayons (libellés de fiche) |
| `characters` : création (`character-wizard`, `portrait-*`, `character-avatar`) | Oui pour le chrome : navigation d'étapes, chargement, erreurs, avertissement portrait, bascule d'équipement, aria des groupes, recadrage de portrait | Champs narratifs, fétiche, magie, attributs, sous-titres de classe, saisie d'arme libre, lignes du récapitulatif, « Po » (aides à la création et fiche Ryuutama) ; contenu de catalogue |
| `homme-dragon` | Oui pour le chrome seulement : export PDF, confirmations, états vides, erreurs, progression d'étapes, navigation, aventures, boutons et aria de la réserve | Races et teintes, intitulés et champs de fiche, règles et consignes de jeu, familles de souffles, catégories de la fenêtre de choix, vocabulaire de la réserve, étapes et champs de création, « N PS » ; nom propre « Homme Dragon » (titre de page) ; contenu de catalogue |
| `calendar` | Oui : vues (mois, semaine, agenda, rail), barre de composition, dialogues (composition, conflit, scellage), panneau de contraintes, aria de navigation, états d'état en mots (`util_*`, `week_status_*`) | Créneaux (domaine) ; noms de jours et de mois, dates `Intl` ; séparateurs et connecteurs de composition (` · `, ` — `, ` ou `) ; glyphes et icônes ; enums d'API ; compteurs `n / total` ; libellés fournis par l'appelant ; code mort `recurLabel` |
| `poll` | Oui (`pollui.*`, `common.oui`/`non`/`peut_etre`) | Créneaux ; emojis de réponse ; dates ; valeurs d'API YES/NO/MAYBE affichées sur les boutons de vote (voir section 5) |
| `parties` | Oui : confirmation, verrous de visibilité, détail de partie (onglets, lien d'invitation), rail d'effectif, panneau et historique d'XP | Créneaux ; règles de calcul d'XP et champs de calcul Ryuutama (rappel de règles) ; unité « XP » ; onglet « Homme Dragon » (nom propre) ; dates ; contenu serveur |
| `scenarios` | Oui : éditeur, formulaire, liste, chronologie, dialogue de lecture, liste des séances (boutons, aria, placeholders d'exemple, erreurs, confirmations) | Créneaux ; durées « N h · M séances » et taille « o » (unités) ; placeholders `min`/`max` ; dates ; glyphes 🔓/🔒 ; titres, descriptions et messages d'API (utilisateur/serveur). Aucun contenu Ryuutama dans cette zone |
| `shared/*` | Oui : `detail-surface` (`shared.*`, `common.detail`) ; le reste était déjà au registre (`identity`, `list-control-bar`, `password-reveal`, `status-badge`) | Marque (`shared/brand`, SVG) ; décoratifs `party-banner`/`party-countdown` ; décompte calculé du `status-badge` ; « Homme Dragon » de repli de `nature-marker` (nom propre) |
| `core/*` | Oui : types de partie (`partie.kind_*`, via `partieKindLabelKey()` qui renvoie une clé ; le tri « Type » suit un rang explicite, `partieKindSortRank()`) ; état vide des aventures (`core.homme_dragon_sans_aventure`, paramètre `emptyLabel`) | `APP_TITLE` « Dés Dispos » (marque) ; dates relatives de `status-badge.model.ts` ; noms de repli « Personnage sans nom » / « Homme Dragon sans nom » ; messages techniques jamais affichés (`realtime`, `availability`) ; fixtures de test |

## 5. Décisions ambiguës — tranchées par la 35.3

**Hors thème par choix, confirmé**
- Dates relatives (`imminenceLabel()`, `SLOT_WHEN` : « ce soir », « demain », « dans 5 j »…) : restent des
  formats de date, hors thème. Migrer imposerait de changer la signature et le contrat `StatusBadgeState.text`.
  À rouvrir seulement si l'on veut une voix par thème sur les échéances.
- « Personnage sans nom » / « Homme Dragon sans nom » : restent hors thème. Ce sont aussi des clés de tri et de
  recherche (~10 appelants purs) : les thématiser ferait dépendre tri et filtre du thème.
- ` (+1 autre)` de `buildDayDetail` (`day-detail.utils.ts`) : reste un compteur technique en dur.
- Durées « N h · M séances » (`scenarios`) : restent des unités.
- « Occupations » / « Actions » : sous-titres de classe du wizard, codés en dur dans `class-step.html`
  (vocabulaire Ryuutama, hors registre). Dans le registre, `character.choice_reference_toggle` (« Occupations et
  actions »), `character.choice_talents_label` (« Talents ») et `character.choice_advantages_label`
  (« Avantages ») sont identiques dans les trois thèmes et recensées par `NEUTRAL_KEYS`.
- Connecteur ` ou ` des créneaux d'un vote et séparateurs de composition : restent en dur.

**Migrés par la 35.3**
- Valeurs d'API YES / NO / MAYBE sur les boutons de vote de `poll-response.html` : elles ne s'affichent plus
  telles quelles, le bouton lit `common.oui` / `common.non` / `common.peut_etre` (mots neutres, identiques).
- `counterLabel()` et le compteur d'avancement de la boîte de conflit : gabarit `calendar.util_counter`
  (« {n} / {total} »), identique dans les trois thèmes.
- Libellés d'aria du roster (`roster-row.util.ts`) : gabarits `parties.roster_aria_character`,
  `_character_class` et `_create` (le séparateur « — » et les parenthèses ne sont plus dans le code).
- Boîte de conflit du calendrier : plus de « s » collé au mot d'état ni de « Tu déclares » en dur ;
  `ConflictDialogData.kind` remplace `kindLabel`, les phrases d'accord sont des clés.
- `partie.signal_vote_en_cours_sans_reponse` : ne dit plus « Vote en attente » ; il reprend la paire de la
  spec (« Réponds au vote » / « Vote en cours ») dans la voix du thème.
- « Email » / « e-mail » : l'orthographe « e-mail » est celle des phrases ; chaque thème nomme le champ dans sa
  voix (« Sceau », « Adresse du hibou », « Fréquence »), toujours suivi de « (e-mail) » ou de « adresse » dans
  les textes de sécurité (changement d'adresse) pour rester sans ambiguïté.
- « Calcul assisté » (titre de `rules-reminder`) : thème (« Calcul de l'oracle », « Calcul des anciens »,
  « Calcul par l'automate ») ; le corps du rappel (règles) reste hors thème.

**Doublons de formulation**
- `core.parties_kind_*` et `partie.kind_*` : **fusionnés** sur `partie.kind_*` (voix du thème) ; les clés
  `core.parties_kind_*` sont supprimées des trois thèmes. Dashboard, détail de partie et formulaire lisent la
  même série. Le tri « Type » est inchangé (rang explicite Campagne < Campagne épisodique < One-shot).
- `parties.detail_tab_scenarios` / `scenarios.list_title` et `parties.detail_tab_timeline` /
  `scenarios.timeline_title` : restent deux clés, désormais dites avec le même mot dans chaque thème.
- Mots d'état en minuscules (`calendar.week_status_*`, `calendar.month_*`) : restent neutres et séparés des
  formes capitalisées `common.disponible` / `common.indisponible`.
- Clés `_2` (`common.precedent_2`, `common.suivant_2`, `common.chargement_2`, `common.date_a_definir_2`) : le
  suffixe est conservé, chaque thème garde le glyphe ou la ponctuation de sa jumelle.
- `common.choisir` porte « -- … -- » (tirets inclus) dans les trois thèmes.

**Vérifié**
- `participationAriaLabel`, `answerLabel`, `groupAriaLabel`, `memberStatusWord`, `buildWeek()`,
  `counterLabel()` et `hommeDragonAventuresLabel()` exigent `tone` (ou `emptyLabel`) : tous les appelants de
  production le passent, les specs aussi, avec un cas par thème.
- « Niveau {n} » : hors thème dans la méta de fiche, migré dans l'historique et le titre de la montée de niveau ;
  les trois mots restent identiques (« Niveau » est un terme de jeu).
- Replis défensifs `?? '{partie}'` et `?? 'Voir les {n} autres'` de `character-creation-entries.ts` : non migrés.

## 6. Hors périmètre, suivi ailleurs

Les textes Ryuutama restés en dur dans le front (libellés de fiche, règles, aides à la création, calcul
d'XP, familles de souffles…) sortiront plus tard vers un fichier lié au système de jeu. Suivi dans
`_bmad-output/implementation-artifacts/deferred-work.md` (architecture multi-système, épic 31).

## 7. Voix des trois thèmes (story 35.3)

Source : `ux-jdr-master-20260626/EXPERIENCE.md` §3. Une seule forme d'adresse par thème, de la première à la
dernière clé (écrans d'authentification compris). Les trois fichiers de thème ont les mêmes sections, dans le même
ordre, groupées par fonctionnalité : un thème se relit d'un seul tenant.

| Thème | Univers | Adresse | Vocabulaire |
|---|---|---|---|
| Grimoire Émeraude | magie, bibliothèque, parchemins | **vouvoiement** | grimoire (la partie), chapitre (le scénario), voyageur (le personnage), compagnon, Maître (le MJ), oracle, sceau, sortilège, missive, enluminure ; verbes : sceller, inscrire, convoquer |
| Forêt Ancienne | nature, druides, saisons | **tutoiement** | sentier (la partie), étape (le scénario), cercle (le groupe), Guide (le MJ), compagnon de route (le personnage), besace, carnet, sifflet, hibou, écureuil messager, lune ; verbes : planter, graver, éveiller, cueillir |
| Atelier Cuivré | engrenages, vapeur, automates, registres | **vouvoiement** | mission (la partie), opération (le scénario), équipage (le groupe), Ingénieur (le MJ), mécanicien (le joueur), automate (le personnage), registre, scrutin, pneumatique, plaque, badge, composant, calibrage ; verbes : consigner, verrouiller, purger, assembler |

Exemples (même clé, trois voix) : `nav.logout` « Fermer le grimoire » / « Quitter la forêt » / « Couper la vapeur » ;
`common.mot_de_passe` « Sortilège de passage » / « Parole secrète » / « Code d'accès » ;
`calendar.util_answer_mine` « vous avez dit oui » / « tu as dit oui » / « vous avez répondu oui ».

**Règles**
- Un texte court (bouton, lien, onglet) reste court et sans ambiguïté : le thème passe par le vocabulaire, pas par la
  longueur. Un texte de sécurité ou d'erreur nomme sa cause (« invalide », « expiré », « indisponible »…) et ne ment
  jamais ; la connexion ne distingue jamais un compte inexistant d'un mot de passe incorrect.
- Le nom « Dés Dispos » est constant. Le texte de système de jeu (Ryuutama) reste hors registre, y compris sa forme
  d'adresse (« Votre race »…) : voir section 6.
- **Textes contractuels, neutres et identiques** : `status.*`, `character.nature_dragon`, `auth.password_*`,
  `auth.field_*`, badges de l'Agenda (`calendar.agenda.badge_*`). Ils gardent leur forme d'origine, y compris
  « Réponds au vote » dans un thème qui vouvoie.
- **Autres textes identiques** : recensés un à un par `NEUTRAL_KEYS` dans `theme-tone.service.spec.ts`, avec leur
  raison (verbatim du contrat d'UI du calendrier, vocabulaire de jeu, mots fonctionnels courts, gabarits
  structurels). Une clé qui reste identique sans y figurer fait échouer les tests ; une clé qui y figure et reçoit
  une voix aussi. Pour ajouter une clé : la voix des trois thèmes, ou une ligne motivée dans `NEUTRAL_KEYS`.
- Les tests vérifient aussi la forme d'adresse (aucun « tu » dans Grimoire et Atelier, aucun « vous » dans Forêt),
  la distinction des clés de grande visibilité, la part de vocabulaire propre à chaque thème et les gabarits.
