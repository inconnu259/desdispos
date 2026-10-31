# Réconciliation du PRD 10.6-10.8 avec ses sources (2026-10-31)

Relecture du brouillon `prd.md` (et de `addendum.md`) contre les cinq sources d'entrée, en tenant compte de
`.memlog.md` : les points que l'utilisateur a écartés exprès (candidat n° 5 du 10.8, boutons du pied de page ;
tutoriels et visites guidées) ne sont pas repris. Quand une source date et que le code a bougé depuis, le
constat le dit et cite le fichier.

Pour chaque écart : **(a)** manque ou contradiction par rapport à la source, **(b)** affirmation du PRD sur
l'existant que la source (ou le code) dément, **(c)** terme employé autrement que dans les glossaires précédents.
Les numéros de ligne du PRD renvoient à `prd.md`.

---

## 1. `docs/backlog.md` — Paliers 10.6, 10.7, 10.8 (l.287-323)

**1.1 (a) « Ma situation » aussi sur les cartes de chapitres.**
Source : `docs/backlog.md:314` (« Pastille Ma situation sur les cartes de **chapitres/séances** (participe, vote à
faire, pas inscrit) »). PRD : FR-9 (l.161-169) ne parle que des séances.
Correctif : soit ajouter la carte de chapitre (situation résumée : « Vote à faire » si une séance du chapitre
l'attend), soit écrire dans le Out of Scope du FR-9 que le chapitre est exclu, et pourquoi.

**1.2 (a) La valeur « participe » est devenue « Inscrit ».**
Source : `docs/backlog.md:314` (« participe ») ; même mot côté soirée (voir 5.3). PRD : FR-9 l.166 (« Inscrit »),
UJ-3 l.41.
Correctif : reprendre « Je participe » (mot du mode soirée), ou dire pourquoi le JDR prend « Inscrit ».

**1.3 (b) « Onglet d'accueil = la suite des chapitres/séances » : le joueur n'a pas d'onglet Chapitres.**
Source : `docs/backlog.md:321`. Dans le code, l'onglet Chapitres / Chapitre n'existe que pour le MJ
(`apps/web/src/app/features/parties/partie-detail/partie-detail.html:589-598`, `@if (isMj() && …)`) ; un joueur
voit les séances dans **Chronologie** (`:599-603`, absent pour une quête unique). PRD : FR-12 (l.190-197) et UJ-3
(l.41 : « Hugo, joueur… elle s'ouvre sur les chapitres »).
Correctif : fixer l'onglet d'accueil selon le rôle (MJ : Chapitres ; joueur : Chronologie, ou un onglet fusionné
comme celui du groupe, cf. 5.5), et traiter la quête unique (`ONE_SHOT`), qui n'a ni Chronologie ni Chapitres
côté joueur. Revoir UJ-3 en conséquence.

**1.4 (b) « Un lien vers un onglet précis continue de l'ouvrir » : ce lien n'existe pas.**
Source : `docs/backlog.md:321` (« ordre des onglets inversé »). Le code ne lit aucun paramètre d'onglet (seul
`announcementId` est lu, `partie-detail.ts:187`) ; les sauts internes passent par des **index en dur**
(`MJ_INVITATIONS_TAB_INDEX`, `partie-detail.ts:507` ; `manualTabIndex.set(0)`, `:734` ; `defaultTabIndex`, `:487`).
PRD : FR-12 l.197.
Correctif : remplacer la phrase par « les accès internes à un onglet (+ Inviter du roster, retour après création
du personnage…) mènent toujours au bon onglet après le réordonnancement ».

**1.5 (a) Badges de rôle sur les avatars : retirés du périmètre sans vérification.**
Source : `docs/backlog.md:321` (« badges de rôle sur les avatars »). PRD : note du FR-12 (l.199) qui les dit déjà
présents en JDR. `roster-rail.html:50` et `roster-strip.html:35` portent bien l'initiale du rôle.
Correctif : en faire une conséquence vérifiable (« les avatars du roster JDR portent MJ et l'initiale du rôle,
inchangés »), ou confirmer avec l'utilisateur que la puce du backlog visait seulement le badge Admin.

---

## 2. `ux-designs/ux-jdr-master-2026-10-08/.working/inventaire-icones.md`

**2.1 (a) Plusieurs icônes utilitaires et actions manquent au FR-6.**
Source : `inventaire-icones.md:28` (`check` : accepter une invitation, thème actif), `:34` (`replay` : rouvrir une
partie, ×3 aujourd'hui), `:41` (`person_remove` : retirer un joueur), `:43` (`mail` : inviter par e-mail), `:46`
(`info` : homonymie), `:57` (`description` : document joint). Ajouts récents relevés par
`.working/extrait-themes-icones.md:44-47` : `visibility_off`, `event_busy`, `admin_panel_settings`, `logout`,
`exit_to_app`. PRD : FR-6 l.126 (liste « au moins ») et FR-5 l.114 (concepts).
Correctif : ranger chacune de ces icônes dans FR-5 (sens : rouvrir, nommer admin, quitter l'office) ou dans FR-6
(utilitaire : valider, e-mail, information, document, retirer, masquer), pour qu'aucune ne reste en Material.

**2.2 (a) Les icônes à deux états ne sont pas couvertes.**
Source : `inventaire-icones.md:56` (`star` / `star_border`), `:44` (`link` / `link_off`), `:45` (`lock`) ; glyphes
🔒 🔓 (FR-8). PRD : FR-5 (favori) et FR-6.
Correctif : ajouter une conséquence « une icône à deux états (favori posé ou non, lien actif ou révoqué, verrou
ouvert ou fermé) est dessinée dans ses deux états, et les deux restent distincts sans la couleur ».

**2.3 (a) Il reste des surcharges hors des trois que lève le FR-7.**
Source : `inventaire-icones.md:17` (`chevron_right` = période suivante **et** « ouvrir »), `:28` (`check` =
accepter **et** thème actif), `:51` (`flag` sert aussi de repli à `tintIcon`). Dans le code, `shield` sert aussi
pour l'**hôte** (`dashboard.spec.ts:1745`, `dashboard.ts:189`). PRD : FR-7 l.133-136.
Correctif : ajouter hôte / MJ / admin (trois sens, ou une règle explicite si hôte et MJ gardent la même icône,
puisque « en mode JDR, l'hôte est le MJ », glossaire du PRD 10 l.79), chevron « ouvrir », check « actif », et
le repli de `tintIcon`.

**2.4 (a) L'objectif de sens (métaphores trompeuses) ne figure pas dans le PRD.**
Source : `inventaire-icones.md:78` (`campaign` porte-voix pour une proclamation, `auto_awesome` pour l'XP, `home`
pour « Mes parties », `badge` pour « Personnages »). PRD : Vision l.19 et FR-5 ne parlent que de générique,
double sens et emoji.
Correctif : une phrase dans la Vision et une conséquence du FR-5 : « chaque icône de sens représente le concept
lui-même dans le vocabulaire du thème, pas une métaphore générique » ; la SM-2 vérifie déjà la compréhension.

**2.5 (a) Le statut des SVG déjà sur mesure n'est pas tranché.**
Source : `inventaire-icones.md:66-69` (`nature-marker`, `identity-label`, `password-toggle` (œil), pictogrammes
de `calendar-week-view` et `calendar-detail-rail`), plus l'écu Admin et le crayon de couverture
(`.working/extrait-themes-icones.md:49-50`). PRD : description l.108 (« toutes les icônes ») contre le Out of
Scope l.147, qui ne cite que logo, bande, bannière, badges de système et icône de création.
Correctif : lister ces SVG soit dans le Out of Scope (inchangés), soit dans FR-5 ou FR-6 (redessinés par thème ou
mis au style commun). Noter aussi que l'inventaire date du 2026-10-08 : le compte « dix téléchargements » (FR-6
l.127) se vérifie encore (`download` ×10 dans les gabarits), mais l'UX doit partir de l'extrait du 2026-10-31.

---

## 3. PRD du Palier 10.4 (`prd-jdr-master-2026-10-19-p10-4/prd.md`) — FR-11, FR-13, FR-14, §4.7

**3.1 (b) FR-11 du 10.4 garde les chemins existants ; le 10.8 les retire sans dire qu'il lève cette garantie.**
Source : `prd-…-p10-4/prd.md:230` (« Les chemins existants (fiche de scénario, fenêtre de l'événement) restent en
place ») et `:320` (§4.7 : « scellement d'un créneau, inscriptions et contenu de la fiche de scénario sont
inchangés »). PRD : FR-11 l.187 (disparition de « Choisir cette date », « Sceller ce créneau », « Clôturer le
vote ») ; le ⚠️ l.159 ne cite que le FR-14 du 10.4.
Correctif : citer dans le ⚠️ du §4.3 le FR-11 (l.230) et le §4.7 (l.320) du 10.4 comme garanties levées.
Vérifier que la Destinée offre bien la clôture d'un vote sans date (le calendrier a `onClosePoll`,
`calendar-view.ts:3982`) ; sinon, retirer « Clôturer le vote » de la fiche ôte une fonction, ce que le FR-13
interdit (« seule la présentation change », l.211).

**3.2 (a) Les noms de ceux qui n'ont pas répondu ne vont qu'au MJ.**
Source : `prd-…-p10-4/prd.md:199` (FR-8 : noms à l'organisateur seulement, le nombre pour les autres ; règle de
confidentialité) ; même règle au PRD 10, `prd-jdr-master-2026-10-08/prd.md:227`. PRD : FR-11 l.185 (« qui n'a pas
répondu » pour tous) et glossaire l.54 ; UJ-3 l.41 fait déjà la différence, la FR non.
Correctif : FR-11, « le résumé donne au MJ les noms de ceux qui n'ont pas répondu, aux joueurs leur nombre ».

**3.3 (a) Le résumé oublie l'échéance et la plage, que le 10.4 a rendues visibles dans la fiche.**
Source : `prd-…-p10-4/prd.md:320` (échéance visible, FR-18) et `:312` (fiche de scénario, liste du vote comprise :
un créneau candidat de plusieurs créneaux s'affiche avec sa plage, FR-20) ; `:80` (pas de meilleur créneau tant
que personne n'a dit oui) ; `:228` (en JDR, prolonger = modifier le sondage). PRD : glossaire « Vote en résumé »
l.54, FR-11 l.185.
Correctif : le résumé montre aussi l'échéance (ou « échéance passée »), le meilleur créneau sous forme de plage
quand c'en est une, et « pas encore de meilleur créneau » ; pour le MJ, dire par où il prolonge (Destinée,
« Modifier »).

**3.4 (a) Rien ne dit comment le mode déclaration cohabite avec le composer et la Destinée.**
Source : `prd-…-p10-4/prd.md:167` (dans le composer, « un tap court ajoute ou retire un seul créneau » : le composer
est déjà un mode à tap simple), `:200` (la Destinée est suspendue pendant le composer), `:84` (Destinée), FR-5 du
10.4 (bouton « Proposer des dates » dans le même en-tête). PRD : FR-1 à FR-3 (l.64-90), FR-3 l.90.
Correctif : ajouter une conséquence « mode déclaration, composer et Destinée s'excluent : en ouvrir un ferme ou
suspend l'autre, comme le composer suspend la Destinée » ; aligner le bandeau du mode sur celui du composer (« le
calendrier indique clairement qu'on compose… ») ; dire où se placent « Déclarer mes dispos » et « Proposer des
dates » l'un par rapport à l'autre (cela touche la SM-C1).

**3.5 (c) « À dater » et les mots de situation ne suivent pas le glossaire du 10.4.**
Source : `prd-…-p10-4/prd.md:69` (« Rendez-vous à dater » = sans date, **sans sondage**, et vu par son
**organisateur**) ; `:183` (états de la liste des destinées : « à faire », « répondu », « organisateur », « vous ne
votez pas ») ; `:296` (FR-16 : en mode soirée, aucun mot du JDR, jamais « partie »). PRD : glossaire « Ma
situation » l.52 (état « à dater » appliqué à tout rendez-vous) ; FR-13 l.206 et le 10.7, qui touchent les deux
modes.
Correctif : écrire « sans date » plutôt que « à dater » dans l'état ; rattacher les valeurs de « Ma situation » aux
états du FR-7 du 10.4 ; rappeler la règle du FR-16 dans les NFR transverses (« Trois thèmes », l.217) pour la
pastille « Changer » et les noms accessibles des icônes en mode soirée.

---

## 4. Story 36.3 (`implementation-artifacts/36-3-la-selection-devient-le-geste-de-declaration.md`) — AC9, AC15-AC18

**4.1 (a) Vider la sélection ne doit pas éteindre le mode déclaration.**
Source : `36-3-…md:217-224` (AC17 : la sélection est un ensemble ; « retirer la dernière **quitte le mode
modification** — la barre disparaît d'elle-même »). PRD : FR-2 l.80 (le mode reste allumé après validation), sans
le cas de la sélection vidée à la main.
Correctif : FR-2, « retirer le dernier créneau sélectionné masque la barre mais laisse le mode allumé ; seul
« Terminer » l'éteint ».

**4.2 (c) « Mode déclaration » arrive à côté du « mode modification » de 36.3.**
Source : `36-3-…md:217-218` (AC17 et AC18 nomment « mode modification » l'état où la sélection est armée et où
chaque clic ajoute ou retire). PRD : glossaire l.47-48.
Correctif : situer les deux termes dans le glossaire (« le mode déclaration garde le calendrier dans l'état que
36.3 appelle *mode modification*, même sans sélection ») ou renommer l'un des deux, pour éviter deux modes
emboîtés sans définition.

**4.3 (a) La « date courante » (AC16) n'est pas traitée en mode déclaration.**
Source : `36-3-…md:209-215` (AC16 : le tap pose la date courante, avec un repère distinct de celui de la
sélection). PRD : FR-2 l.81 (« le tap ne sert plus à lire »).
Correctif : dire si le repère de date courante reste en place, suit le dernier tap ou disparaît en mode
déclaration, et garder les deux repères distincts.

**4.4 (a) Double-clic et glissement au doigt en mode déclaration.**
Source : `36-3-…md:184-188` (AC9 : le double-clic ne fait rien, mais il sélectionne au premier appui ; en mode
bascule, il ajouterait puis retirerait) ; `:118-124` (encadré 4b : au doigt, le glissement n'arme qu'après l'appui
maintenu, pour laisser défiler la page) ; `:190-207` (AC15 : le glissement est la seule porte découvrable sur
ordinateur). PRD : FR-2 (l.74-82).
Correctif : FR-2, (1) un double-clic ne laisse pas un créneau à l'état inverse de ce que voulait l'utilisateur ;
(2) au téléphone, en mode déclaration, plusieurs jours se sélectionnent par taps successifs, le glissement
vertical fait toujours défiler la page, et l'appui maintenu suivi d'un glissement reste possible.

**4.5 (b) À vérifier : raccourcis clavier et portée par défaut.**
Source : `36-3-…md:126-130` (encadré 4c : portée initiale = créneau de la bande touchée, `Journée` depuis le corps
de la case, un jour fusionné ou `Espace`) ; AC17 (`Maj`+flèches écrivent une plage) ; réserve de l'AC15 (au
clavier, `Espace` et `1/2/3` arment directement). PRD : FR-1 l.72 et FR-2 l.79 : cohérents. Le 10.4 a supprimé la
touche Maj **dans le composer** (`prd-…-p10-4/prd.md:16`, FR-6), pas dans les dispos.
Correctif : aucun sur le fond. Écrire au FR-1 que le clavier n'a jamais eu besoin de l'appui long, pour que le
mode ne soit pas vu comme une correction de l'accès clavier.

---

## 5. `ux-designs/ux-jdr-master-2026-10-08/EXPERIENCE.md`

**5.1 (b) Côté soirée, l'hôte ne conclut pas son vote uniquement dans la Destinée.**
Source : `EXPERIENCE.md:146` (encadré de l'hôte : « Fixer la date… », « Prolonger le vote », « Voir dans le
calendrier → ») ; dans le code, `events/event-dialog/event-dialog.html:121-148` (`ed__poll-fix`,
`ed__poll-extend`) ; même chose au 10.4 l.230. PRD : FR-11 l.187, hypothèse « toute la conclusion du vote passe
par la Destinée, **comme pour l'hôte d'une soirée** », reprise au §9 l.265.
Correctif : soit garder dans la fiche de séance un « Fixer la date… » qui ouvre la confirmation de la Destinée
(c'est le vrai modèle soirée), soit garder le retrait mais réécrire le motif sans la comparaison, et l'ajouter au
⚠️.

**5.2 (a) Le contenu du résumé est plus riche que les « trois lignes ».**
Source : `EXPERIENCE.md:144` (joueur : « Vote à faire… donnez vos disponibilités avant le *date* », « Vos
réponses : *x* créneaux sur *N* », « Meilleur créneau pour l'instant : *date* — *n* oui ») ; `:146` (hôte : « le
vote se termine dans *n* jours — *N* créneaux proposés », « Réponses : *x* sur *N* inscrits ») ; `:147` (date
fixée : l'encadré laisse place à la date en grand) ; `:187` (VoteSummary calculé côté serveur, en temps réel) ;
`.memlog.md:64` de l'UX (le résumé comprend l'échéance). PRD : glossaire l.54, FR-10 et FR-11.
Correctif : reprendre la forme de l'encadré soirée (échéance, comptes x/N, meilleur créneau avec son nombre de oui)
et ajouter au FR-10 l'état « date fixée » (l'encadré montre la date de la séance).

**5.3 (c) Les valeurs de « Ma situation » s'écartent du modèle soirée, et le MJ n'a pas de pastille.**
Source : `EXPERIENCE.md:209` (« Je participe » · « Vote à faire » · « Invitation à accepter » · « Pas inscrit·e »
· « J'y étais » · « Place réservée ») ; `:184` (EventCard : ligne « Ma situation » **toujours présente**) ; dans le
code, l'hôte a une pastille (« l'hôte et les inscrits participent », `events/event-card.util.ts:272`). PRD : FR-9
l.166-167 (« Inscrit », « Pas inscrit », aucune pastille pour le MJ), alors qu'il se dit « sur le modèle des cartes
d'événement ».
Correctif : reprendre les mots (« Je participe », « Pas inscrit·e ») et revoir l'hypothèse MJ (l'hôte de soirée en
a une : « Je participe », ou une valeur MJ comme « À fixer »). Préciser aussi que le badge d'état soirée change
de couleur selon que j'ai voté ou non (`EXPERIENCE.md:198`) : FR-9 l.168 dit que l'état ne doit plus mêler la
situation ; il faut choisir entre le libellé seul et le libellé plus la couleur.

**5.4 (b) Point ouvert 5, le badge Admin : il est déjà dessiné, et il fait 14 px.**
Source : `EXPERIENCE.md:297` (point ouvert 5 : « bouclier de l'indicateur de rôle, 14 px, au coin de l'avatar ») ;
`:74` et `:78` (badge sur l'avatar du rail **et** dans la liste Missives) ; `:247` (jamais la couleur ni le trait
seuls, badge avec un mot). Dans le code, il est livré : écu SVG de 14 px dans
`events/participant-chip/participant-chip.html:4-14` (Story 40.2) et badge bouclier plus mot dans Missives,
`partie-detail.html:513-518` (Story 39.4). PRD : FR-7 l.136 (« décidé au Palier 10 mais pas dessiné, l'est
ici ») ; NFR l.151 (lisible de 16 à 24 px) ; l'extrait `.working/extrait-dispos-ecrans-jdr.md:40` répète l'erreur.
Correctif : FR-7, « l'écu Admin existant (avatar et Missives) est redessiné par thème et distinct de l'icône du
MJ et de celle de l'hôte, le mot "Admin" restant écrit à côté » ; fixer une exception de taille (14 px, en badge)
ou relever la NFR.

**5.5 (a) L'ordre des onglets du groupe vient d'une fusion.**
Source : `EXPERIENCE.md:70-74` (onglets dans l'ordre, le premier ouvert par défaut ; ⚠️ la vue validée ouvre
« Détails ») ; `.memlog.md:46` et `:54` de l'UX (pour un groupe, « Chapitres » et « Chronologie » sont fusionnés en
un seul onglet d'événements, placé en premier) ; `.memlog.md:66` (c'est ce modèle qui doit passer au JDR).
PRD : FR-12 l.195 (Chapitres en premier, « Chronologie suit Chapitres »).
Correctif : poser la question de la fusion Chapitres et Chronologie (ou au moins d'un onglet d'accueil par rôle,
voir 1.3), et la verser en question ouverte si l'utilisateur ne tranche pas.

**5.6 (a) La pastille « Changer » de la bannière doit avoir son « Retirer ».**
Source : `EXPERIENCE.md:183` (CoverBanner + CoverChangeChip : « Retirer » à côté si une image perso existe) ;
`.memlog.md:39` de l'UX (pastille translucide avec crayon, en bas à droite ; « Retirer » en 2ᵉ pastille) ;
`EXPERIENCE.md:59` et `:279` (prévu pour le formulaire de création). PRD : FR-13 l.201-207. La formule « comme
l'hôte ou l'admin en mode soirée, peut changer la couverture depuis la bannière » laisse croire que la soirée l'a
déjà sur la page, ce que dément `.working/extrait-dispos-ecrans-jdr.md:42`.
Correctif : ajouter « Retirer » sur la bannière de la page, reprendre le dessin de la puce du formulaire, et dire
que l'ajout est nouveau dans les deux modes (⚠️ écran soirée validé aussi, à joindre à l'exception du NFR
« Mode soirée non régressé », l.216, qui la cite déjà).

**Remarques mineures (source)**
- `EXPERIENCE.md:94` place le mode Destinée au « Palier 10.6 » ; c'est le 10.4 depuis `.memlog.md:92` de l'UX.
  Le PRD a raison, mais quiconque lit l'UX seule peut s'y tromper.
- `EXPERIENCE.md:140` : les textes de l'encadré de situation étaient voulus « neutres de thème » ; à
  l'implémentation, ils ont pris le vocabulaire du thème (« conjonction », `grimoire-emeraude.ts:596-601`). Le NFR
  « Trois thèmes » (l.217) suit l'implémentation : rien à changer, mais à savoir.
- `EXPERIENCE.md:301` (point ouvert 9 : icône de création et badges sans masque ni identifiant) est réglé dans le
  code (`shared/create-icon/create-icon.ts:23-24`, `shared/system-badge/system-badge.ts:21`). En revanche, la
  règle de dessin elle-même (SVG inline monochrome en `currentColor`, ni masque ni identifiant, un tracé lisible
  à 19 px : `DESIGN.md:107`, `:229`) manque dans les NFR du 10.7 (l.150-153) : à y ajouter.

---

## 6. Écarts croisés avec les glossaires précédents (hors des cinq sources)

**6.1 (b) FR-4 : « les dispos n'alimentent que l'automate du JDR ».**
Faux. PRD du Palier 10 : `prd-jdr-master-2026-10-08/prd.md:47` (les invités répondent grâce à leurs dispos) et
`:213` (chaque créneau candidat affiche combien d'inscrits sont disponibles d'après leurs dispos) ; le plateau
Destinée affiche « n dispos sur toute la plage » (Story 47.5, `.working/extrait-dispos-ecrans-jdr.md:18-19`).
PRD : FR-4 l.97.
Correctif : revoir le public du signal (joueurs de JDR **et** participants d'une soirée ou d'un groupe qui a un
vote ouvert ?) ou garder le JDR seul avec un autre motif ; si le signal touche la soirée, le libeller selon la
règle du FR-16 du 10.4.

**6.2 (c) Le PRD n'hérite pas du glossaire du 10.5, dont il emploie pourtant les termes.**
Source : `prd-jdr-master-2026-10-28-p10-5/prd.md:52-60` (Jeu, Ludothèque, Envie avec majuscule, Jeux du groupe,
Compteur d'hôte). PRD : §0 l.15 (n'hérite que des glossaires des PRD 10 et 10.4), FR-5 l.114 (« jeux de société ;
envie »), Non-Goals l.228.
Correctif : citer le glossaire du 10.5 au §0 et reprendre ses termes (« Ludothèque », « Envie »), avec un nom
précis pour l'icône (Ludothèque, ou Jeux du groupe).

**6.3 (c) « Fiche de séance » désigne une fenêtre qui n'existe pas.**
Source : PRD 10.4 (« fiche de scénario » partout, l.271, l.312) ; backlog l.315 (« détail d'un chapitre/séance »).
Dans le code, le joueur ouvre `ScenarioReadDialog` (depuis Chronologie) et le MJ `scenario-editor` (depuis
Chapitres), tous deux avec `seance-list`. PRD : glossaire l.53, FR-10 et FR-11, UJ-3.
Correctif : définir la fiche de séance comme « la partie séance de la fiche de scénario (lecture pour le joueur,
éditeur pour le MJ) » ou décider qu'elle devient une fenêtre à part, et dire laquelle des deux fiches change.
