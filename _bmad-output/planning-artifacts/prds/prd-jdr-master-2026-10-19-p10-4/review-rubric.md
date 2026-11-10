# PRD Quality Review — Palier 10.4 — Sondage et Destinée dans le calendrier

*Revue selon `prd-validation-checklist.md`, 2026-10-19. Calibrage : projet perso (l'auteur et sa bande), rigueur moyenne, PRD en tête de chaîne (UX → epics → stories), incrément brownfield sur le calendrier existant. Sources croisées : `prd.md`, `addendum.md`, `.memlog.md`, `ux-designs/ux-jdr-master-2026-10-08/palier-10-4-entrees.md`, Glossaire du PRD du Palier 10, Story 36.10, spec 40.5b, `docs/backlog.md` §10.4.*

## Overall verdict

C'est un PRD solide et honnête. La Vision est concrète (« une vingtaine sur 3 000 pixels », « a galéré »), les quatre UJ sont incarnées et couvrent les deux modes, la plupart des FR ont des conséquences vraiment testables, et les écrans validés modifiés sont signalés ⚠️ (§4.6). Le risque principal est un trou brownfield : le PRD parle de « créer un sondage » comme d'un objet autonome, alors que dans le code un vote de JDR est toujours rattaché à une séance et qu'un sondage de groupe est toujours celui d'une conjonction. FR-5, FR-6, FR-10 et FR-2 ne disent donc pas *à quoi* se rattache le sondage créé. Le cycle de vie « ouvert / clos » d'un sondage n'est pas défini non plus, alors que FR-7, FR-11, FR-12 et FR-16 en dépendent. Il faut corriger ces deux points avant l'UX ; le reste est du polissage.

## Decision-readiness — adequate

Les décisions sont écrites comme des décisions, pas comme des « considérations » : Destinée « A + B » (§4.3), « Ajouter au vote passe toujours par le composer » (FR-2), Du / Au visibles seulement liste dépliée (FR-4), filtre par partie réservé au calendrier personnel (FR-14, Out of Scope), fixation de la date depuis le plateau dans le périmètre (FR-16). Le `.memlog.md` montre que ces quatre questions (Q1 à Q4) ont été tranchées par l'utilisateur, et le PRD les reflète fidèlement.

Ce qui manque, c'est ce qu'on abandonne. Aucun arbitrage n'est nommé avec son coût. Par exemple, FR-2 impose de passer par le composer même pour ajouter une seule fenêtre à un sondage ouvert : on gagne une validation et un avertissement uniques, mais on perd l'ajout en un geste promis par la Vision (« d'un geste », §1). De même, FR-14 ne persiste pas le filtre : on gagne en simplicité, mais l'utilisateur doit le remettre à chaque visite. Il n'y a aucun `[NOTE FOR PM]`. Le §8 annonce « Aucune » question ouverte, alors que plusieurs décisions sont explicitement renvoyées à l'UX (voir Scope honesty).

### Findings
- **[low]** Arbitrages sans leur coût (FR-2, FR-14, §1) — « d'un geste » (§1) et « passe toujours par le composer » (FR-2) se tirent dessus sans que le PRD le reconnaisse. *Fix:* une phrase par décision : « choisi X plutôt que Y ; on renonce à Z ». Si le « d'un geste » de la Vision ne tient plus, l'ajuster en « en quelques gestes ».

## Substance over theater — strong

Rien ne relève de la décoration. La Vision ne pourrait servir à aucun autre PRD : elle décrit des défauts observés, chiffrés (≈ 20 cartes, ≈ 3 000 px) et vérifiés dans l'application. Les protagonistes (Incon, Léa, Marc) sont les vrais utilisateurs et chacun porte une décision : la Destinée multi-parties pour Incon, l'aller-retour 40.5b pour Léa, l'ouverture directe pour Marc. Les NFR sont propres au produit : « aucune n'exige un appui long pour être trouvée », « l'estompe de la Destinée ne porte jamais seule une information », confidentialité des dispos en mode soirée. Ce ne sont pas des « scalable / secure » génériques. La contre-métrique SM-C1, qui suit le nombre de fonctions dans la colonne de droite, vise exactement le défaut d'origine. Pas de section Innovation inutile.

## Strategic coherence — adequate

La thèse est claire et posée en §1 : « faire du calendrier l'endroit où l'on fabrique et où l'on suit un sondage ». §4.1 et §4.2 servent la moitié « fabriquer », §4.3 et §4.4 la moitié « suivre », et FR-15 lève une ambiguïté de vocabulaire qui gênait les deux. FR-14 (filtre par partie) est un peu à côté de la thèse, puisqu'il touche la navigation générale du calendrier personnel. Il vient cependant du backlog et sert UJ-4 : c'est acceptable.

Les métriques ne valident qu'une partie de la thèse. SM-1 couvre la création et SM-2 l'arrivée par un lien. Aucune métrique ne couvre « suivre un vote » : liste des destinées, plateau, flèches et fixation de la date (FR-7 à FR-11, FR-16), soit la plus grosse feature du palier. En plus, SM-1 est mesurée sur Incon, le créateur du produit et de la feature : « sans chercher comment faire » ne prouve rien de la découvrabilité quand c'est le concepteur qui teste.

### Findings
- **[medium]** SM-1 mesurée sur la mauvaise personne (§7 SM-1) — « Incon crée un sondage… sans chercher comment faire » : celui qui a spécifié le bouton ne peut pas tester s'il le trouve. Le problème d'origine (« non découvrable ») concerne surtout un hôte du mode soirée qui n'est pas l'auteur. *Fix:* mesurer SM-1 sur un membre de la bande (Léa dans UJ-2) qui crée un sondage de conjonction sans aide, en moins d'une minute.
- **[medium]** Aucune métrique pour « suivre un vote » (§7) — FR-7 à FR-11 et FR-16 ne sont validées par aucune SM. *Fix:* ajouter une SM-3, par exemple « Incon fixe la date d'un sondage depuis la Destinée sans passer par la fiche de scénario ni la fenêtre de la conjonction », ou « un joueur répond à tous les créneaux candidats d'un vote depuis le plateau sans changer de mois à la main ».

## Done-ness clarity — thin

C'est la dimension la plus fragile, et c'est celle dont les stories dépendront le plus. Prises une à une, les conséquences sont souvent excellentes : FR-1 (une seule fenêtre sélectionnée, la désélection rend l'affichage normal), FR-9 (n/N = rang du créneau), FR-12 (refus sans fuite d'information), FR-16 (effet identique au chemin existant, mode par mode). Deux trous structurels ne laissent cependant pas l'ingénieur savoir ce qu'est « fini ».

Le premier, le plus grave, est le rattachement d'un sondage créé. Dans le code, un vote de JDR « exige TOUJOURS un lien vers une `Seance` ». La Story 36.10 crée un nouveau vote via `createSeancePoll()` après avoir demandé la séance parmi `eligibleSeances()`, et le refuse si aucune n'est éligible. En mode soirée, un sondage est toujours celui d'une conjonction (spec 40.5b : le composer est armé soit sur un sondage ouvert, soit sur « nouvelle conjonction » via le brouillon de la fenêtre de création). Le PRD ne parle ni de séance ni de conjonction. FR-5 (« Créer un sondage »), FR-6 (« Valider ouvre ou modifie le sondage »), FR-10 (« « Créer » ouvre le composer vide ; le nouveau sondage devient la destinée active ») et FR-2 (« la validation crée le sondage ») laissent donc ouvertes trois questions :
- en JDR, quelle séance porte le vote, et que se passe-t-il s'il n'y en a aucune d'éligible ?
- dans le calendrier du groupe, hors aller-retour 40.5b, « Créer » ouvre-t-il la fenêtre de création d'une conjonction (titre, participation, échéance…) ?
- dans le calendrier personnel, où FR-7 rend la Destinée multi-parties, dans quelle partie FR-10 « Créer » crée-t-il ?

Le second trou est le cycle de vie du sondage, jamais défini. Le PRD emploie « sondage ouvert » (FR-2, FR-7, §3), « clos » (FR-12, UJ-3), « scellée, clôturée, annulée ou supprimée » (FR-11) et « date fixée » (FR-16), sans dire ce qui se passe à l'échéance. Or, d'après FR-11 du Palier 10 et la spec 40.5b, après l'échéance on ne vote plus mais l'hôte peut encore fixer la date. Si « ouvert » exclut les sondages échus, FR-16 devient inaccessible précisément quand il sert le plus, et FR-11 fermerait la Destinée à l'échéance. Si « ouvert » les inclut, FR-7 doit dire ce que voit un votant d'un sondage échu.

### Findings
- **[high]** Le sondage créé n'est rattaché à rien (FR-2, FR-5, FR-6, FR-10) — le PRD ignore qu'un vote de JDR est porté par une séance (Story 36.10, `eligibleSeances()`) et qu'un sondage du mode soirée est celui d'une conjonction (spec 40.5b). « Créer » depuis la Destinée ou le calendrier personnel n'a pas de cible définie. *Fix:* une conséquence par contexte dans FR-5 et FR-10. En JDR : choix de la séance à la validation, et message écrit si aucune n'est éligible (comportement 36.10 conservé). Dans le calendrier du groupe : « Créer » ouvre la fenêtre de création de conjonction (aller-retour 40.5b), ou n'existe que pendant cet aller-retour. Dans le calendrier personnel : « Créer » absent, ou précédé d'un choix de partie. Reporter la contrainte dans l'addendum.
- **[high]** Cycle de vie du sondage non défini (§3, FR-7, FR-11, FR-12, FR-16) — « ouvert », « clos », « clôturé » et « scellé » ne sont pas définis, et rien ne dit ce qu'un sondage échu mais non fixé devient dans la liste des destinées et dans une Destinée active. *Fix:* ajouter au Glossaire **Sondage ouvert** (date non fixée, ni annulé ni supprimé, échéance passée ou non) et **Sondage clos** (date fixée, annulé ou supprimé). Préciser dans FR-7 et FR-8 qu'après l'échéance le plateau reste consultable, sans vote possible, et que « Fixer la date… » reste offert à l'organisateur.
- **[medium]** FR-2 suppose un seul sondage par partie (FR-2) — « Sans sondage ouvert… / Avec un sondage ouvert… » est une fausse alternative : une partie de JDR peut avoir plusieurs votes ouverts, un par séance (Story 8.8 multi-votes, et FR-7 qui regroupe « les sondages » par partie). On ne sait pas à quel sondage la fenêtre s'ajoute, ni de quelle liste elle « sort ». *Fix:* « Ajouter au vote » vise la destinée active si elle existe, sinon le MJ choisit le sondage (ou « nouveau ») à l'ouverture du composer. Une fenêtre quitte la liste si elle est créneau candidat de *n'importe quel* sondage ouvert de la partie.
- **[medium]** Qui voit quoi dans la liste des destinées (FR-7) — « l'état de l'utilisateur (à répondre / répondu) » ne couvre ni un membre non inscrit d'un événement à places limitées (non votant d'après FR-11 du Palier 10), ni l'organisateur qui ne vote pas. *Fix:* la liste montre les sondages que l'utilisateur peut *voir* (règle d'accès existante). L'état prend trois valeurs : « à faire », « répondu », « vous ne votez pas » (ou « organisateur »).
- **[low]** Fenêtres retirées puis abandonnées (FR-2, FR-6) — UJ-1 dit qu'une fenêtre ajoutée « quitte la liste » dès le brouillon. FR-6 dit qu'« annuler ne change rien », sans préciser que les fenêtres reviennent alors dans la liste. *Fix:* l'ajouter en conséquence de FR-2.
- **[low]** FR-12 ne nomme pas ses calendriers (FR-12) — « l'adresse du calendrier » : l'addendum en cite trois (partie, groupe, personnel), le PRD aucun. *Fix:* lister les trois dans FR-12.

## Scope honesty — adequate

Les Non-Goals (§5) font un vrai travail : ils séparent explicitement 10.6, 10.7 et 10.8, et excluent les dispos de groupe en mode soirée, une exclusion qu'on aurait facilement pu supposer couverte. Les dix `[ASSUMPTION]` en ligne sont tous indexés en §9, et la densité est raisonnable pour ce niveau d'enjeu. La phrase « Rien de ce qui est listé dans le backlog du 10.4 n'est différé » se vérifie dans `docs/backlog.md` §10.4.

Deux points d'honnêteté posent problème. Le premier est une contradiction interne sur le JDR. Le NFR « JDR non régressé » dit que « seuls les écrans de §4.6 changent ; … séances et fiche de scénario sont inchangés », et FR-16 répète « Les chemins existants (fiche de scénario…) restent… inchangés ». Pourtant, FR-13 change la destination des accès au vote de la fiche de scénario et des séances, ainsi que les liens des e-mails, et §4.6 ne les liste pas. Le signal ⚠️ des contrats UI validés manque donc sur ces surfaces.

Le second point : §8 affirme « Aucune » question ouverte, alors que plusieurs décisions sont renvoyées à plus tard sous une autre forme :
- l'équivalent tactile de Maj (FR-6 ; le memlog dit « à définir en UX ») ;
- le libellé qui remplace « Fenêtres de la destinée » (FR-15, « choisi en UX ») ;
- le stockage serveur ou local du masquage et de l'état replié (addendum, « décider entre… »).

À l'inverse, le tag `[ASSUMPTION]` de FR-6 porte sur Maj / Ctrl, un point **décidé** (memlog Q2), et non sur l'équivalent tactile, qui est le vrai point inconnu.

### Findings
- **[medium]** FR-13 contredit le NFR « JDR non régressé » et §4.6 (FR-13, Cross-cutting NFRs, FR-16, §4.6) — la fiche de scénario et les séances sont déclarées « inchangées » alors que FR-13 change leurs accès au vote. Les e-mails ne sont pas cités non plus. *Fix:* soit ajouter à §4.6 « Fiche de scénario et séances (JDR) : les accès au vote mènent en Destinée » et « E-mails de vote : destination du lien », et corriger le NFR ; soit sortir ces deux puces de FR-13 et les passer en Non-Goal. Les deux cas de FR-13 sont aujourd'hui `[ASSUMPTION]` : c'est le moment de trancher.
- **[medium]** Questions ouvertes déguisées (§8, FR-6, FR-15, addendum) — trois décisions sont renvoyées à l'UX ou à l'architecture, alors que le §8 se dit vide. *Fix:* passer en §8 (ou en `[NOTE FOR PM]`) l'équivalent tactile, le libellé de FR-15 et le stockage des préférences MJ, avec l'étape qui tranche chacun. Déplacer le tag de FR-6 de « Maj / Ctrl » vers « équivalent tactile ».

## Downstream usability — adequate

Le Glossaire est bon : il reprend explicitement celui du Palier 10 et ajoute des termes nets (Destinée « n'est pas un filtre ni une couche », Plateau de la destinée, Masquage). Les UJ ont toutes un protagoniste nommé, avec son contexte écrit dans le texte même. Les FR citent leurs UJ, et l'addendum transmet aux étapes suivantes les vraies contraintes de code : `pollId` plutôt qu'un rang, estompe calculée sur `allCalendarEntries()`, les trois rendus de `PollStatusPanel`. C'est exactement ce que `bmad-architecture` voudra.

Ce qui gêne l'extraction, c'est surtout le vocabulaire soirée. Le PRD du Palier 10 garde « événement » comme nom de travail, avec « conjonction » comme libellé d'interface (§0 du PRD 10). Ce PRD-ci emploie les deux comme synonymes sans définir « conjonction » : « hôte de l'événement » (§3, FR-5) et « une conjonction « par sondage » » (UJ-2, FR-13, FR-16, §4.6). Une story extraite de FR-13 ne saura pas que les deux mots désignent la même chose. Voir aussi les notes mécaniques.

### Findings
- **[low]** « Conjonction » utilisé sans entrée de Glossaire (§3, UJ-2, UJ-3, FR-5, FR-13, FR-16, §4.6) — c'est le libellé d'interface de **Événement** d'après le PRD du Palier 10, mais aucun des deux Glossaires ne le dit. *Fix:* ajouter au §3 « **Conjonction** — libellé d'interface d'un Événement (PRD du Palier 10, §0) », ou n'écrire que « événement » dans les FR et réserver « conjonction » aux libellés cités entre guillemets.

## Shape fit — adequate

La forme convient. Le PRD est léger mais complet pour un projet perso en tête de chaîne : quatre UJ là où l'expérience compte, sans en ajouter pour une petite feature. Le contenu technique est sorti dans l'addendum, explicitement « non contractuel ». Les écrans existants modifiés sont distingués des nouveaux (§4.6), ce qu'exige un brownfield. L'exactitude brownfield est bonne sur ce que le PRD cite : Story 36.1 AC7, l'aller-retour 40.5b, la règle `FULL_DAY` refusée, `PARTIE_AVAILABILITY_READ` fermé, et le fait qu'une fenêtre de l'automate correspond bien à un `AvailableSlotDto` (date + moment) et se transforme donc proprement en créneau candidat. Le seul écart est un oubli plutôt qu'une erreur : la séance et la conjonction qui portent un sondage (voir Done-ness, finding high n° 1). C'est précisément le genre de fait brownfield qu'un PRD sur la création de sondage doit poser.

FR-16 dépend du chemin « Fixer la date… » de la Story 40.6, encore en `review` dans `sprint-status.yaml`. Ce n'est pas bloquant, mais c'est à signaler à l'architecture.

## Mechanical notes

- **Glossaire, synonymes** : « vote » et « sondage » sont employés comme synonymes partout (« Ajouter au vote », « vote actif », « destinée active — le sondage »). C'est tolérable, puisque « vote » est un libellé d'interface, mais il faudrait une ligne au §3 (« Vote : synonyme d'interface de Sondage »). Le libellé « moment de vote » (§3, Créneau candidat) n'apparaît dans aucune FR : soit on le confirme comme libellé pour l'UX, soit on le retire.
- **« Partie » dans l'interface du mode soirée** : le Glossaire du Palier 10 précise que « le mot n'apparaît pas dans l'interface du mode soirée ». La liste des destinées « groupée par partie » (FR-7) et la « liste des parties actives » du filtre (FR-14) devront donc avoir un libellé neutre. FR-15 couvre le cas en termes généraux (« aucun mot du JDR en mode soirée ») ; le citer explicitement éviterait l'oubli en UX.
- **Ordre des ID** : FR-1 à FR-16 sont uniques et sans trou, mais FR-16 est placée entre FR-11 et FR-12 (§4.3). Les stories qui suivent l'ordre du document le liront dans le désordre. C'est acceptable, puisque l'ID reflète l'ordre d'ajout, mais une mention « (ajoutée après relecture) » ou une renumérotation aiderait.
- **Liens FR → UJ** : FR-4, FR-10, FR-11, FR-14 (partiellement) et FR-15 ne citent aucune UJ ou n'en citent qu'une partie. FR-4 devrait citer UJ-1 (Incon déplie la liste) ; FR-10 et FR-11 n'ont pas d'UJ porteuse, ce qui est acceptable mais à savoir.
- **Aller-retour de l'index des hypothèses** : les 10 tags en ligne correspondent bien aux 8 entrées du §9, FR-13 et FR-14 regroupant chacun deux tags. L'entrée §9 de FR-3 ajoute « et se défait », que le texte de FR-3 traite comme un fait non tagué : c'est cohérent mais redondant.
- **FR-7, formulation** : la puce 2 (« toutes les parties actives de l'utilisateur ») et la puce 3 (« en calendrier de partie ou du groupe, … que cette partie ») se contredisent à la lecture. Il faudrait préfixer la puce 2 par « En calendrier personnel ».
- **FR-14, « visite »** : le terme n'est pas défini (navigation ? onglet ? rechargement ?). Le préciser, par exemple « perdu au rechargement de la page ».
- **Sections requises** : toutes sont présentes pour ce niveau d'enjeu. Le §6.2 renvoie au §5, ce qui convient ici.
