---
title: jdr-master Experience — Delta Palier 10 Soirées entre amis
status: final
updated: 2026-10-08
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/EXPERIENCE.md"
design: "./DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-08/prd.md"             # FR-1 à FR-18, UJ-1 à UJ-3 (mis à jour après ce travail UX)
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-08/addendum.md"
  - "_bmad-output/forge/soiree-jeux-de-societe/forged-idea.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/.memlog.md"
---

# jdr-master — Experience — Delta Palier 10 Soirées entre amis

Ce document est un **delta** : il hérite de l'EXPERIENCE.md `ux-jdr-master-2026-09-23` (et, par lui, des spines de base) et ne décrit que ce que le PRD du Palier 10 ajoute : **créer** pour tous, **deux formes de rencontre** (la *rencontre isolée* et le *groupe*), **gouverner** un groupe, **voir et répondre** à une rencontre, **annuler**, **effacer son compte**, **être prévenu**.

**Ce qui n'est PAS redessiné** : le calendrier, le sondage de dates, les inscriptions, les dispos, l'écran de JDR. Le comportement du JDR est **inchangé** (contrainte dure du palier). Quatre chantiers remontés pendant ce travail sont au backlog : **Palier 10.4** (refonte du sondage et du mode « Destinée » dans le calendrier, JDR compris), **Palier 10.6** (découvrabilité des dispos), **Palier 10.7** (jeu d'icônes sur mesure, par thème) et **Palier 10.8** (reporter côté JDR une partie de ce travail). *Le comportement du JDR reste inchangé dans le Palier 10 lui-même.*

**Vocabulaire.** Les termes du PRD (« soirée », « mode soirée », « groupe », « événement ») sont des **noms de travail**. L'interface emploie les noms **par thème** du §3 : **ralliement** (le mode, côté grimoire), **conjonction** (une rencontre), **convergence** (un groupe), etc.

**Contrat UI.** Toute modification d'un écran déjà validé est précédée de **⚠️** ; récapitulatif §10. Planches de référence : [`mockups/`](mockups/) — rendues sur l'interface réelle ; **les spines l'emportent sur elles**.

## 1. Foundation

Web responsive, Angular Material 22 — hérité. **Mobile d'abord** pour la réponse (voter, accepter, s'inscrire : sur téléphone, depuis un e-mail) ; **bureau** pour organiser. Trois thèmes dark inchangés. Les groupes comptent **4 à 20 membres** ; les sondages jusqu'à **~20 créneaux** : aucune liste ne se pagine.

**Un seul mode, deux entités.** À la création, le **mode** (quête ou ralliement) est choisi par une bascule et devient **définitif**. Un ralliement est soit une **rencontre isolée** (un hôte, des invités), soit un **groupe** (des membres, des rencontres successives).

## 2. Information Architecture

### 2.1 Surfaces

| Surface | Route | Nouveau / modifié | Contenu |
| --- | --- | --- | --- |
| **Création** | `/parties/new` | ⚠️ modifié | couverture → nom → bascule → champs du mode → description |
| **Liste d'accueil** (« Mes aventures ») | `/` | ⚠️ modifié | tuiles quêtes **et** ralliements ; filtres Genre / Rang / Phase ; cases « Grouper par type », « Masquer les clos et les annulés » |
| **Groupe** | `/parties/:id` (mode ralliement durable) | nouveau contenu | onglets **Conjonctions** (défaut) · **Détails** · **Missives** |
| **Rencontre isolée** | `/parties/:id` (mode ralliement isolé) | nouveau contenu | onglets **Conjonction** (détail en ligne) · **Invités** (invité) / **Invitations** (hôte) |
| **Détail d'une conjonction** | fenêtre sur la liste du groupe | nouveau | situation → fiche → inscrits |
| **Nouvelle conjonction** | même fenêtre, en mode création | nouveau | nom, date (fixée ou sondage), lieu, heure, infos, participation (§2.6 bis) |
| **Compte** (« Mon grimoire personnel ») | `/account` | ⚠️ modifié | + section « Zone sensible » |
| **Confirmations** | fenêtres | nouveau / ⚠️ modifié | §5.4 |
| **E-mails** | — | nouveau + ⚠️ modifié | §3.5 |

**Planches** (rendues sur l'interface réelle) : création [`D1`](mockups/entree-desktop-D1-barre-du-haut.png) · [`M1`](mockups/entree-mobile-M1-droite-du-titre.png) · [`couverture`](mockups/couverture-desktop-V1-pastille.png) ; groupe [`bureau`](mockups/groupe-desktop-B-onglet-conjonctions.jpg) · [`mobile`](mockups/groupe-mobile-B-onglet-conjonctions.jpg) ; conjonction [`membre`](mockups/conjonction-v2-desktop-membre-resume.jpg) · [`hôte`](mockups/conjonction-v2-desktop-hote-resume.jpg) ; rencontre isolée [`hôte`](mockups/soiree-isolee-desktop-hote.jpg) · [`invité mobile`](mockups/soiree-isolee-mobile-invite.jpg) ; confirmations [`1`](mockups/confirmation-1-suppression-de-compte.png) [`2`](mockups/confirmation-2-dernier-admin-quitte.png) [`3`](mockups/confirmation-3-quitter-office.png) [`4`](mockups/confirmation-4-masquer-partie-terminee.png) ; compte [`zone sensible`](mockups/compte-zone-sensible.jpg) ; liste [`ralliements et filtres`](mockups/liste-accueil-ralliements-filtres.png) ; badges [`R1 + L1`](mockups/badges-systemes-R1-L1.png). Inventaire des icônes : [`inventaire-icones.md`](mockups/inventaire-icones.md).

### 2.2 Navigation

- **Barre principale** : quatre destinations inchangées (parties, personnages, calendrier, compte).
- **Création** : **bouton global** dans l'en-tête, **bureau** bord droit de la barre du haut, **mobile** à droite du titre (icône seule). Visible **pour tout utilisateur connecté, sur toutes les pages**.
- **Aucun CTA « rejoindre »** pour un nouvel utilisateur : on n'entre que **sur invitation** ; l'invitation reçue figure déjà en tête de la liste d'accueil.
- **Bouclage** : toute surface est atteinte par un parcours (§8) et en sort par « Refermer », le retour du navigateur ou la barre.

### 2.3 Formulaire de création (⚠️)

Ordre : **couverture** (bannière + puce « Changer ») → **nom** → **bascule** → champs du mode → **description** (toujours en dernier).

| Option de la bascule | Champs suivants |
| --- | --- |
| **Quête** (JDR) | « Livre de règles » (liste des systèmes) → « Nature de la quête » (quête unique, chronique, chronique épisodique) |
| **Ralliement** | « Nature du ralliement » : **deux types** — le type **isolé** et le type **durable** (noms par thème, §3.1) ; **pas** de livre de règles |

Les libellés des champs et le bouton final suivent le mode choisi (« Nom du grimoire » → « Nom du ralliement », §3.1). La couverture est offerte aux deux modes.

### 2.4 Vue d'un groupe

Onglets, **dans cet ordre**, **le premier ouvert par défaut** (⚠️ la vue de partie validée ouvre « Détails ») :

1. **Conjonctions** — titre de l'onglet à gauche, bouton **« + Nouvelle conjonction »** à droite (tout membre) ; sections **« À venir »** puis **« Passées »** ; cartes `EventCard` (DESIGN.md §7.4). Vide : « Aucune conjonction pour l'instant. » + invitation à en proposer une `[ASSUMPTION]`.
2. **Détails** — description et réglages. **Plus de cartes d'événements ici** (pas de doublon).
3. **Missives** — membres, ajout par pseudo ou e-mail, lien d'invitation (**admin seulement** ; un membre voit la liste `[ASSUMPTION]`). Existant, réutilisé, **enrichi** : un **badge « Admin »** (bouclier) sur chaque admin ; **« Nommer admin »** sur chaque membre non admin (confirmation §5.4 n° 7) ; **« Quitter l'office »** sur **sa propre** ligne d'admin ; « Retirer » inchangé. [`planche`](mockups/missives-admins-nommer-quitter.png)

**Disparaissent** pour un groupe : « Homme Dragon », « Chapitres », « Chronologie » (fusionnés en « Conjonctions »). **Pied de page** (⚠️) : « Retranscrire » (modifier), « Clore », « Brûler » (supprimer le groupe, admin) conservés ; **ajouts** : « Quitter l'office » (admin, §5.4) et « Quitter le groupe » (membre) `[ASSUMPTION : emplacement]`. « Sceller des secrets » n'existe pas pour un groupe `[ASSUMPTION]`.

**Rôles** : l'**admin** porte un **badge** (sur l'avatar du rail et dans la liste « Missives ») ; plusieurs admins possibles.

### 2.5 Vue d'une rencontre isolée

Même page que le groupe, **sans liste** : l'onglet **« Conjonction »** affiche **directement le détail** (§2.6), en ligne, pas dans une fenêtre. Le sous-titre de l'en-tête dit le type (« Ralliement · La conjonction des Esprits »). **Pas d'onglet « Détails »**. L'onglet **« Invités »** (côté invité) liste les participants — ils **sortent** du premier onglet pour l'alléger ; côté **hôte**, l'onglet **« Invitations »** liste **et** gère (rechercher, inviter par e-mail, créer ou révoquer un lien).

**Invitation nominative** : tant que l'invité n'a pas répondu, **« Accepter / Décliner »** s'affiche **en tête de page**, avant le vote.

### 2.6 Détail d'une conjonction (fenêtre ou page, mêmes blocs)

1. **Titre + badge d'état.**
2. **Encadré de situation** (`SituationPanel`) — *ce que je dois faire, ou ce que je suis*.
3. **La fiche** : date, hôte, lieu, participation (« 8 places · 5 inscrits · 3 libres » ou « Sur invitation · pas de limite »), infos pratiques.
4. **Inscrits** (fenêtre d'un groupe) — *absent du premier onglet d'une rencontre isolée* (§2.5).
5. **Pied** : « Me désinscrire » (membre) ou « Modifier · Annuler la conjonction » (hôte ; **un admin du groupe** peut aussi annuler) ; « Refermer ».

**Le vote ne se fait pas ici** : l'encadré donne un **résumé** et le bouton **« Voter dans le calendrier »** ouvre le calendrier **du groupe** (`/parties/:id/guild-calendar`), **sans focus** sur ce vote pour l'instant (mode « Destinée » : Palier 10.6). Le **lieu** est visible de **tous les membres du groupe**.

### 2.6 bis Fenêtre « Nouvelle conjonction » (création)

**Quand elle s'ouvre** : (a) **rencontre isolée** — dès la validation du formulaire de création, la grande fenêtre s'ouvre en mode création ; (b) **groupe** — par « **+ Nouvelle conjonction** » dans l'onglet Conjonctions (tout membre). **Une seule fenêtre** pour créer et consulter. Planches : [`groupe`](mockups/creation-conjonction-desktop-groupe.jpg) · [`rencontre isolée`](mockups/creation-conjonction-desktop-isolee.png) · [`mobile`](mockups/creation-conjonction-mobile-groupe-haut.jpg).

Champs, dans l'ordre :
1. **Nom** (obligatoire).
2. **Date** — bascule **Date fixée | Sondage de dates**. *Date fixée* : un jour et un créneau (matin, après-midi, soir). *Sondage* : bouton **« Choisir les créneaux dans le calendrier »**, résumé des créneaux choisis (« 4 créneaux · ven. 17 → sam. 25 oct. », modifiable), et **« Le vote se termine le »**.
3. **Lieu** ; **heure de rendez-vous** (facultative, étiquette « HH:MM » : jamais un instant).
4. **Infos pratiques** (facultatif).
5. **Participation** — *groupe* : bascule **Tous les membres | Places limitées** ; en places limitées, un **stepper** du nombre de places (l'hôte en occupe une) et **« Réserver une place à des membres »** en puces avec l'aide « rendue aux autres si la personne décline ». *Rencontre isolée* : « Sur invitation · pas de limite — vous invitez ensuite depuis l'onglet Invitations ».
6. Pied : **« Renoncer »** · **« Créer la conjonction »**.

**Sondage avant le Palier 10.4** : le bouton renvoie au calendrier du groupe en mode « composer » existant (peu découvrable : gêne temporaire **acceptée**).

### 2.7 Liste d'accueil (⚠️)

- **Tuile de ralliement** : même gabarit que la tuile de quête ; **sous-titre = nature** (« La convergence des Sortilèges ») ; **indicateur de rôle** (§3.4) ; **pastille du système** + **badge du système** au coin de la vignette (DESIGN.md §7.5) ; pastilles de signaux existantes (« Vote à faire », date prochaine). **La tuile de quête perd aussi le nom du système de son sous-titre** (« Chronique » seul) : il passe dans la pastille.
- **Filtres** (`ListControlBar`) : « Ranger par », **« Genre »** (Tous / Quêtes / Ralliements — **nouveau**), « Rang » (rôles étendus), « Phase » (+ **« Annulée »**). Cases : **« Grouper par type »** (**nouvelle** : coche = sections « Quêtes » et « Ralliements » ; décoché = liste unique) ; **« Masquer les clos et les annulés »**.
- **Retirer de ma liste** : une partie **terminée ou annulée** peut être **retirée de sa liste** (masquage définitif, **pour soi seul**) ; confirmation §5.4.

## 3. Voice and Tone

Ton chaleureux et malicieux (DESIGN.md §1 de la base). **Une variante par thème** pour tout libellé d'interface ; **vocabulaire neutre** pour les e-mails.

### 3.1 Libellés par thème

| Clé | Grimoire Émeraude | Forêt Ancienne | Atelier Cuivré |
| --- | --- | --- | --- |
| Bascule — ralliement | **Ralliement** | **Veillée** | **Rassemblement** |
| Bascule — quête | Quête | Sentier | Mission |
| Type **isolé** | **La conjonction des Esprits** | **La halte au gué** *(provisoire)* | **La réunion d'établi** |
| Type **durable** | **La convergence des Sortilèges** | **La grande transhumance** | **Le grand chantier** |
| Nom d'une rencontre / onglet | une conjonction / **Conjonctions** | une halte / **Haltes** | une réunion / **Réunions** |
| Bouton de l'onglet | + Nouvelle conjonction | + Nouvelle halte | + Nouvelle réunion |
| Champ « nature » (ralliement) | Nature du ralliement | Nature de la veillée `[ASSUMPTION]` | Régime du rassemblement `[ASSUMPTION]` |
| Champ « nom » (ralliement) | Nom du ralliement | Nom de la veillée `[ASSUMPTION]` | Nom du rassemblement `[ASSUMPTION]` |
| Bouton de création (en-tête) | Lancer une quête | Ouvrir un sentier | Initier une mission |

Le bouton de création **ne change pas** : son libellé thématique couvre déjà tout. Le bouton final du formulaire en mode ralliement n'est **pas arrêté** (§11).

### 3.2 Action d'admin

« **Quitter l'office** » (admin qui lâche le rôle). « **Renoncer** » reste **exclusivement** le bouton d'annulation des fenêtres (texte déjà employé par le thème grimoire). Déclinaison par thème : **non faite** `[ASSUMPTION : « office » identique dans les trois thèmes]`.

### 3.3 Textes de l'encadré de situation (neutres de thème)

| Cas | Texte |
| --- | --- |
| Membre, vote à faire | « **Vote à faire.** Vous êtes inscrit·e : donnez vos disponibilités avant le *date*. » · cases « Vos réponses : *x* créneaux sur *N* » · « Meilleur créneau pour l'instant : *date* — *n* oui » · bouton « Voter dans le calendrier » |
| Invité, vote à faire | « **Vote à faire.** Vous êtes invité·e : donnez vos disponibilités avant le *date*. » |
| Hôte, vote ouvert | « **Vous êtes l'hôte.** Le vote se termine dans *n* jours — *N* créneaux proposés. » · cases « Réponses : *x* sur *N* inscrits » · « Meilleur créneau » · « N'ont pas encore répondu : *noms* » · « Fixer la date… », « Prolonger le vote », « Voir dans le calendrier → » |
| Date fixée | encadré remplacé par la date, l'heure, le lieu en grand `[ASSUMPTION]` |
| Place réservée en attente (hôte) | « *Nom* — invité·e, n'a pas encore accepté » (pastille pointillée) |
| Échéance | « Date à voter · jusqu'au *date* » |

### 3.4 Rôles (mots de travail)

**Admin** et **Membre** (groupe) ; **Hôte** et **Invité** (rencontre). Variantes par thème **non arrêtées**. Point de départ proposé (non validé) : grimoire *Gardien / Compagnon / Hôte / Convié* · forêt *Sentinelle / Habitant / Passeur / Passant* · atelier *Contremaître / Équipier / Maître d'atelier / Visiteur* (existant : « Compagnons », « Habitants », « Équipage »).

### 3.5 E-mails

Vocabulaire **neutre** (« groupe », « rencontre »), identique pour tous : un invité sans compte n'a pas de thème. **Bouton** vert plein + pied **« Dés Dispos »** pour **tous** les e-mails (nouveaux **et existants** ⚠️ : le pied actuel dit « jdr-master » et les liens sont soulignés). Sept e-mails :

| # | Quand | Sujet | Corps (extrait) | Bouton |
| --- | --- | --- | --- | --- |
| 1 | Un admin invite dans un groupe | *Marc* vous invite à rejoindre « *Groupe* » | … pour organiser vos rencontres entre amis. | Rejoindre le groupe |
| 2 | Un hôte invite à une rencontre isolée | *Marc* vous invite : « *Rencontre* » | date à voter jusqu'au … · chez … | Accepter ou décliner |
| 3 | Un hôte réserve une place | *Léa* vous a réservé une place : « *Rencontre* » | Acceptez ou déclinez : une place déclinée est rendue aux autres. | Répondre |
| 4 | Date fixée | C'est fixé : « *Rencontre* », *date* | date · lieu | Voir la rencontre |
| 5 | Veille de la rencontre | Demain : « *Rencontre* » | date · lieu | Voir la rencontre |
| 6 | J-1 de l'échéance du vote, **une seule fois**, à qui n'a pas voté | Plus qu'un jour pour voter : « *Rencontre* » | Le vote se termine demain (*date*). | Voter dans le calendrier |
| 7 | Annulation | Annulée : « *Rencontre* » | *Hôte* a annulé … Vous n'avez rien à faire. | Voir |

Aucun récapitulatif ni autre relance automatique. Texte complet : `mockups/emails-mode-soiree.md`.

### 3.6 Textes des confirmations

Titre **« Votre accord »** (existant). Voir §5.4.

## 4. Component Patterns

**Noms canoniques** — identiques dans DESIGN.md §7.

| Composant | Comportement |
| --- | --- |
| **CreateAction** | ouvre `/parties/new` ; global ; icône seule en mobile (nom accessible = libellé de thème) |
| **ModeSwitch** | bascule à deux options ; **définitive** après création ; le choix reconfigure les champs suivants **sans effacer** nom et description |
| **CoverBanner + CoverChangeChip** | clic sur la puce = sélecteur de fichier ; aperçu mis à jour ; « Retirer » à côté si une image perso existe |
| **EventCard** | clic ou Entrée = ouvre la fenêtre ; ligne « Ma situation » toujours présente |
| **SystemChip / SystemBadge** | informatif, non interactif |
| **EventDialog** | s'ouvre par-dessus la liste ; Échap, « Refermer » et geste précédent la ferment et **conservent** l'état de la liste |
| **SituationPanel + VoteSummary** | résumé calculé côté serveur et mis à jour en temps réel (câblage SSE : `docs/checklist.md`) |
| **ParticipantChip** | avatar + nom ; **ghost** = invitation en attente (hôte seul) |
| **TileCancelled** | reste cliquable : ouvre le détail, avec l'état « Annulée » en tête |
| **DangerZone / DestructiveConfirm** | §5.4 |

## 5. State Patterns

### 5.1 État d'une conjonction (badge + cadre)

| État | Badge | Couleur | Cadre |
| --- | --- | --- | --- |
| Vote en cours, **je n'ai pas répondu** | Vote en cours | `todo` | orange |
| Vote en cours, **j'ai répondu** | Vote en cours | `live` | cyan |
| Inscriptions ouvertes | Inscriptions ouvertes | `live` | cyan |
| Date fixée, à venir | À venir | `soon` | rose |
| Date proche (**imminent**) | Dans *n* jours | `soon` **plein** | rose, bord épais |
| Complet (pour qui n'est pas inscrit) | Complet | `done` `[ASSUMPTION]` | gris |
| Passée | Passé | `done` | gris |
| **Annulée** | Annulée | rouge + trait diagonal | carte estompée |

### 5.2 Ma situation (pastille)

« Je participe » (`live`) · « Vote à faire » (`todo`) · « Invitation à accepter » (`todo`) · « Pas inscrit·e » (pointillé) · « J'y étais » (`done`) · « Place réservée » (`todo` tant qu'elle n'est pas acceptée).

### 5.3 Places et inscriptions

Premier arrivé, premier servi ; **pas de liste d'attente** ; un invité qui décline **libère** sa place ; un membre peut se **désinscrire** à tout moment ; **inscription tardive** possible après la date fixée (la date ne rouvre pas) ; **seul l'hôte** voit une place réservée non acceptée (**filigrane**), les autres la voient **comme inscrite** dès qu'elle est acceptée.

### 5.4 Confirmations (⚠️ fenêtre « Votre accord », bouton rouge pour l'irréversible)

| # | Déclencheur | Message | Confirmer |
| --- | --- | --- | --- |
| 1 | **Effacer mon compte** (Compte → Zone sensible) | « Effacer votre compte « *pseudo* » ? Seront supprimés avec lui : **Groupes dont vous êtes le seul administrateur** (*nom — n membres · n conjonctions*) · **Parties de JDR dont vous êtes le MJ** (*noms* — leurs *n* joueurs y perdent aussi leurs personnages). Cette action est irréversible. Pour confirmer, saisissez votre mot de passe. » + champ | **Effacer mon compte** (rouge) |
| 2 | **Le seul admin quitte l'office** | « Vous êtes le seul administrateur de « *groupe* ». Si vous quittez l'office, le groupe sera supprimé avec ses *n* membres et ses *n* conjonctions. Pour le conserver, nommez d'abord un autre administrateur. » | **Quitter et supprimer** (rouge) |
| 3 | **Un admin parmi d'autres quitte l'office** | « Quitter l'office d'administrateur de « *groupe* » ? Vous restez membre du groupe. » | Quitter l'office |
| 4 | **Retirer de ma liste** (partie terminée / annulée) | « Retirer « *nom* » de votre liste ? Elle disparaîtra définitivement pour vous seul ; les autres participants la conservent. » | Retirer |
| 5 | **Fixer la date…** (hôte) | « **Fixer la date** — « *conjonction* » : les créneaux, du plus au moins plébiscité » ; liste en boutons radio avec « 4 oui · 0 peut-être · 0 non », **le meilleur présélectionné** ; « La date sera scellée et les inscrits prévenus par e-mail. Elle ne pourra plus être rouverte ; les inscriptions tardives restent possibles. » | Fixer la date |
| 6 | **Prolonger le vote** (hôte) | « « *conjonction* » — le vote se termine le *date*. » + champ **Nouvelle échéance** ; « Les personnes qui n'ont pas encore voté seront relancées la veille de la nouvelle échéance. » | Prolonger |
| 7 | **Nommer admin** (admin, Missives) | « Nommer *Léa* administratrice de « *groupe* » ? Elle pourra ajouter et retirer des membres et nommer d'autres administrateurs. » | Nommer admin |

Planche des fenêtres 5 à 7 : [`fixer-date-prolonger-nommer-admin.jpg`](mockups/fixer-date-prolonger-nommer-admin.jpg). *« Fixer la date » reprend le principe de la confirmation « Sceller » du calendrier ; **« Prolonger » n'a aujourd'hui aucun équivalent serveur** (l'échéance est fixée à la création).*

« **Renoncer** » = annuler, partout. **Suppression de compte autorisée même pour un MJ ou un seul admin** (décision), **avec** l'avertissement fort ; `[ASSUMPTION : mot de passe requis]`. Le retrait d'un membre (règles du PRD, FR-6) et la suppression d'un groupe par un admin réutilisent la confirmation existante, rouge pour la suppression.

### 5.5 États vides et attente

« Aucune conjonction pour l'instant » (onglet) ; « Aucun invité pour l'instant » (hôte, onglet Invitations) `[ASSUMPTION]` ; chargement : mêmes squelettes que la chronologie ; erreur de réponse à un vote : message existant du composant de vote.

## 6. Interaction Primitives

- **Ouvrir / refermer le détail** : clic ou Entrée sur la carte ; Échap, « Refermer » ou geste précédent du navigateur referment et **ne perdent ni filtre ni défilement**. Le focus revient **sur la carte** d'origine.
- **Répondre à une invitation** : Accepter / Décliner en tête de page (rencontre isolée) ou dans l'encadré (place réservée) ; la réponse est **immédiate** et recompte les places.
- **Voter** : jamais ici ; « Voter dans le calendrier » ouvre le calendrier du groupe.
- **Annuler une conjonction** (hôte, admin) : confirmation ; les inscrits sont prévenus par e-mail (#7).
- **Retirer de ma liste** : confirmation ; effet immédiat et **sans effet sur les autres**.
- **Temps réel** : inscriptions, places, votes, membres se mettent à jour sans recharger (`RealtimeService`).

## 7. Accessibility Floor

Hérité, plus :
- **Jamais la couleur ni le trait seuls** : « Annulée » est écrit ; l'état d'une conjonction est un **badge avec un mot**.
- **Pastille « place réservée en attente »** : bord pointillé + avatar estompé, **texte à plein contraste** (≥ 4,5:1) ; l'opacité ne s'applique **pas** au texte.
- **Bouton de création mobile** : nom accessible = libellé du thème ; **zone de toucher 44 px**.
- **Bascule** : groupe nommé, `aria-pressed` ou rôle `radiogroup` ; changement annoncé.
- **Fenêtre** : titre = nom de la conjonction ; focus piégé, rendu à la carte à la fermeture.
- **Rouge** : jamais seul (mot « Effacer… », glyphe corbeille).
- `prefers-reduced-motion` : aucune animation ajoutée par ce palier.

## 8. Key Flows

- **UJ-1. Incon réunit douze amis pour une soirée à lui.** Connecté, il clique le bouton de l'en-tête → **Création** : nom « Marathon Pandémie », bascule **Ralliement**, nature **La conjonction des Esprits** → **page de la rencontre** : il invite douze personnes (onglet « Invitations » : pseudo, e-mail, lien) et lance un vote sur ~20 créneaux. *Climax* : l'encadré lui dit « 9 sur 12 ont répondu · meilleur créneau sam. 18 oct. · soir » ; il **fixe la date** → e-mail #4. *Edge* : un invité répond après la date → inscription tardive, la date ne bouge pas.
- **UJ-2. Léa propose une conjonction à six places.** Dans le groupe, onglet **Conjonctions** → **+ Nouvelle conjonction** → six places, date par sondage, elle **réserve** deux places (Marc, Sam) → e-mail #3. *Climax* : ses invités acceptent, quatre membres s'inscrivent, six places occupées. *Edge* : Sam **décline** ; la place est **libérée** ; le septième membre voit « Complet » puis la place libre.
- **UJ-3. Incon efface son compte.** **Compte** → « Zone sensible » → « Effacer mon compte » → **fenêtre #1** (le groupe « La Bande du Jeudi » est listé, ses 14 membres, ses 6 conjonctions ; les parties de JDR dont il est MJ aussi) ; il **annule** (« Renoncer »), **nomme Léa admin** (Missives), revient, saisit son mot de passe, **efface**.
- **UJ-4. Diane crée sa première rencontre.** Joueuse (jamais MJ), elle n'avait aucun moyen de créer ; le **bouton de l'en-tête** s'offre maintenant à elle (UJ-1 en tant qu'utilisatrice sans partie).

Dans chaque flux, la **situation** (ce que je dois faire) précède la **fiche**.

## 9. Responsive & Platform

- **En-tête mobile** : logo + titre + bouton de création. Largeur nécessaire avec libellé (mesurée sur les largeurs réelles de texte, calculée pour 360 px) : **399 px (grimoire)**, **422 px (atelier)**, **437 px (forêt)** → **icône seule sous 440 px**, **307 px** au plus ; libellé complet au-dessus. La fenêtre de Chrome utilisée pour les rendus ne descend pas sous 500 px : **à revérifier sur un téléphone réel**.
- **Fenêtre d'une conjonction** : bureau `min(900px, 96vw)` ; mobile pleine largeur utile, défilement interne ; quatre créneaux et l'encadré tiennent sur un écran (planche mobile).
- **Cartes** : grille 250 px mini, une colonne sous 520 px.
- **Liste d'accueil** : panneau de filtres existant ; **quatre** sélecteurs (Ranger par, Genre, Rang, Phase) + deux cases.

## 10. ⚠️ Écarts aux écrans validés

| # | Écran validé | Ce qui change | Pourquoi |
| --- | --- | --- | --- |
| 1 | Page « Parties » + en-tête | le bouton de création quitte le contenu, passe dans l'en-tête, **pour tous** | un joueur n'avait aucun moyen de créer |
| 2 | Bouton de création | « + » → **d20 + crayon** ; icône seule en mobile | icône explicite, marque |
| 3 | Formulaire de création | **bascule** Quête/Ralliement ; ordre nom → bascule → champs ; **types** de ralliement | deux modes |
| 4 | Formulaire de création | **couverture** : bannière + puce « Changer » (plus de champ de fichier natif) | ligne brute non stylée |
| 5 | Vue de partie (groupe) | onglet par défaut = **Conjonctions** ; « Homme Dragon / Chapitres / Chronologie » → absents ; « Détails » second | gérer des rencontres |
| 6 | Pied de page de la vue | + « Quitter l'office », « Quitter le groupe » | gouvernance du groupe |
| 7 | Liste d'accueil | + filtre **Genre**, **Rang** étendu, **Phase « Annulée »**, case **Grouper par type** | deux genres |
| 8 | Tuile de la liste | **pastille + badge de système** ; sous-titre réduit à la nature (**quêtes comprises**) | distinguer les systèmes |
| 9 | Liste d'accueil | état **Annulée** (trait diagonal), « Masquer les clos **et les annulés** », **retirer de ma liste** | annuler / ranger |
| 10 | Compte | section **Zone sensible** + « Effacer mon compte » | suppression de compte (nouvelle) |
| 11 | `ConfirmDialog` | bouton **rouge** pour l'irréversible | action destructrice |
| 12 | `DetailSurface` | **largeur 900 px** pour la conjonction | contenu plus dense |
| 13 | E-mails existants | bouton vert + pied « Dés Dispos » | cohérence de marque |

## 11. Open Items

**À trancher ou à vérifier avant livraison** (`[NOTE FOR UX]`)

1. **Contraste de `status-unavailable` en texte** sur `surface-bg` dans les **trois** thèmes (≥ 4,5:1) — mesuré à la main sur le grimoire seulement (≈ 4,6:1).
2. **Noms de rôles par thème** (§3.4) — non validés ; l'écran montre « Admin / Hôte / Invité » comme mots de travail.
3. **Forêt : « La halte au gué »** provisoire ; **atelier** : « réunion d'établi » (le message disait « d'étable », lu comme « établi »).
4. **Bouton final du formulaire en mode ralliement** (et libellés de champs forêt / atelier) : non arrêtés.
5. **Badge d'admin** : décidé, **non dessiné** (avatar du rail et liste « Missives »). Proposition : le bouclier de l'indicateur de rôle, 14 px, au coin de l'avatar.
6. **Point d'entrée de « Retirer de ma liste »** : la confirmation est dessinée, **pas l'endroit** d'où on la lance (menu de la tuile ? détail ?).
7. **Pied de page d'un groupe** : emplacement exact de « Quitter l'office / Quitter le groupe » ; « Clore » a-t-il un sens pour un groupe ?
8. **Mot de passe requis** pour effacer un compte (`[ASSUMPTION]`).
9. **Icône de création et badges** à **redessiner sans masque ni identifiant** (règle du logo) ; **Draconis** n'a pas de badge (Palier 13).
10. **Lecture sur téléphone réel** de l'en-tête mobile (§9).
11. **Revue d'accessibilité** : non lancée (proposée à la finalisation).

**Backlog** : **10.4** (sondage et Destinée dans le calendrier — demandes et décisions : [`palier-10-4-entrees.md`](palier-10-4-entrees.md) ; touche aussi le JDR), 10.6 (dispos découvrables), 10.7 (jeu d'icônes), 10.8 (reporter ce travail côté JDR). **En attendant le 10.4**, le Palier 10 crée ses sondages avec le mode « composer » existant, et « Voter dans le calendrier » ouvre le calendrier du groupe sans focus sur le vote.

**Impacts reportés dans le PRD le 2026-10-08** (FR-7, FR-11, FR-12, FR-13, FR-15, FR-16 à FR-18 ; comparaison : [`reconcile-prd.md`](reconcile-prd.md)) : (1) **suppression de compte** — nouvelle FR (API + écran), à remettre en cohérence avec FR-7 ; (2) **état « annulé »** et e-mail d'annulation ; (3) **retirer de sa liste** (masquage définitif par utilisateur, s'applique aussi au JDR) ; (4) **accepter / décliner** une invitation à une rencontre isolée ; (5) **bascule Quête / Ralliement** et noms par thème ; (6) vote **dans le calendrier** plutôt que dans la fenêtre (PRD FR-11) ; (7) bouton de création **global**.
