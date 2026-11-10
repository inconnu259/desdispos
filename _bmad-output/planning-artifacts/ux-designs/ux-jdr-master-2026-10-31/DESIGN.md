---
title: "jdr-master Design System — Delta Paliers 10.6 à 10.8"
status: final
created: 2026-10-31
updated: 2026-11-01
themes: [grimoire-emeraude, foret-ancienne, atelier-cuivre]
ui_system: Angular Material 22
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-29/DESIGN.md"
sources:
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-31-p10-6-8/prd.md
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-31-p10-6-8/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-31/.memlog.md
# Paliers 10.6 et 10.8. Aucun token de thème ajouté : tokens propres aux composants, qui référencent
# les tokens existants. Valeurs validées sur la planche du 2026-10-31.
components:
  declare-action:                      # bouton « Déclarer mes dispos » (§3.1 EXPERIENCE)
    extends: "{components.propose-dates-action}"   # contour, minHeight 36
    pressed: "fond {colors.accent-1}, texte {colors.on-primary}, libellé « Terminer »"
  declare-banner:                      # bandeau du mode déclaration (§3.2)
    backgroundColor: "{colors.accent-1} à 10 %"
    border: "1px solid {colors.accent-1}"
    rounded: 12px
    padding: "8px 12px"
    typography: "13px / 500, {colors.text-primary}"
  declare-grid:                        # grille en mode déclaration
    outline: "2px solid {colors.accent-1}"
    rounded: "{rounded.card}"
  selection-bar-sticky:                # barre de sélection en mode déclaration (§3.3)
    position: "collée au bas de l'écran (téléphone) ou de la zone du calendrier (ordinateur)"
    backgroundColor: "{colors.surface-bg}"
    shadow: "0 -4px 16px {colors.overlay}"
    padding: "8px 12px"
  reminder-banner:                     # rappel « Dispos à déclarer » du tableau de bord (§3.5)
    backgroundColor: "{colors.status-todo} à 12 %"
    border: "1px solid {colors.status-todo}"
    rounded: 14px
    padding: "12px 16px"
    typography: "titre « Dispos à déclarer » 14px / 700, puis la phrase de thème 14px / 500, {colors.text-primary}"
    actions: "bouton plein « Déclarer mes dispos » + bouton texte « Ne plus me le rappeler »"
  situation-pill:                      # pastille « Ma situation » (§4.1), reprise de event-card
    padding: "1px 8px"
    rounded: "{rounded.badge}"
    typography: "12px / 600"
    tones:
      je-mene: "contour 1px {colors.accent-1}, texte {colors.accent-1}"
      vote-a-faire: "fond {colors.status-todo} à 16 %, contour {colors.status-todo}"
      j-ai-vote: "contour 1px {colors.status-live}, texte {colors.status-live}"
      je-participe: "fond {colors.status-live} à 12 %, contour {colors.status-live}"
      pas-inscrit: "contour pointillé {colors.text-muted}"
      j-y-etais: "fond {colors.status-done} à 12 %, texte {colors.text-muted}"
  seance-situation:                    # encadré de situation d'une séance (§5.2), version compacte de situation-panel
    extends: "{components.situation-panel}"
    rounded: 10px
    padding: "10px 12px"
    border: "1.5px solid {colors.status-todo} (joueur) / {colors.accent-1} (MJ)"
  cover-chips:                         # « Changer » / « Retirer » sur la bannière en tête de l'onglet Détails (§4.3)
    extends: "pastille de couverture V1 du Palier 10 (ux-jdr-master-2026-10-08)"
    position: "haut droit de la bannière, 8px du bord"
  icon:                                # jeu d'icônes du Palier 10.7 (§Components, Icônes)
    viewBox: "0 0 32 32"
    color: "currentColor"              # hérite de la teinte du texte ou de {colors.accent-1}
    stroke: "2 (contour), 1.3 (détails)"
    linecap: round
    linejoin: round
    fill: "une seule zone pleine porteuse d'identité ; aucune pour les glyphes simples"
    forbidden: "id, mask, clipPath, script"
    sizes: "14 (badge sur avatar), 16, 20, 24 ; 48 sur les planches"
    source: "mockups/icones/icones-retenues.json"
---

# jdr-master — Design — Delta Paliers 10.6 à 10.8

**Ce document est un delta** sur le DESIGN.md du Palier 10.5 (champ `inherits` de l'en-tête). Il n'ajoute aucun
token de thème : il déclare les composants nouveaux ou étendus des Paliers 10.6 et 10.8, et porte le jeu d'icônes du
Palier 10.7. En cas d'écart, les spines (ce document et `EXPERIENCE.md`) l'emportent sur toute planche.

## Components

- **Bouton et bandeau du mode déclaration** (`declare-action`, `declare-banner`, `declare-grid`,
  `selection-bar-sticky`) : la couleur d'identité `{colors.accent-1}` marque l'écriture, comme elle marque déjà la
  sélection de dispos (emphase paire = dispo).
- **Rappel des dispos** (`reminder-banner`) : teinte `{colors.status-todo}` (« ça t'attend »). Titre en gras
  « Dispos à déclarer », puis la phrase de thème (EXPERIENCE §3.5).
- **Pastille « Ma situation »** (`situation-pill`) : même gabarit que sur la carte d'événement ; tons alignés sur la
  spec du Palier 10 (la carte d'événement s'y aligne aussi).
- **Encadré de situation d'une séance** (`seance-situation`) : version compacte de `situation-panel`.
- **Pastilles de couverture** (`cover-chips`) : reprise de la pastille V1 du formulaire.

### Icônes (Palier 10.7)

**Style « Trait + touche pleine »** (`{components.icon}`), choisi le 2026-10-31 parmi trois styles : il reprend le
langage de l'icône de création (dé et crayon). Trait de 2 au contour et de 1,3 aux détails, bouts ronds, et une seule
petite zone pleine qui porte l'identité (le fermoir, l'étoile, le bec de la plume…). Planche de comparaison : [`mockups/icones-1-style.html`](mockups/icones-1-style.html).

**Deux niveaux.**
- **Icônes de sens**, dessinées une fois par thème (30 par thème, le favori comptant pour deux : vide et posé).
- **Icônes utilitaires**, communes aux trois thèmes (41).

Le jeu retenu, un SVG par icône, est dans [`mockups/icones/`](mockups/icones/) (`grimoire-emeraude/`, `foret-ancienne/`,
`atelier-cuivre/`, `communes/`) et rassemblé dans `mockups/icones/icones-retenues.json`. Les noms de fichier sont les
mêmes dans les trois thèmes.

**Une famille par thème.** C'est elle qui permet de reconnaître son thème à ses icônes (SM-2) ; tout futur
dessin s'y range.
- **Grimoire émeraude** : la famille du livre. Les états d'une partie sont un même livre, ouvert, scellé, scellé puis
  fêlé, rouvert (seul le sablier fait exception) ; dans la gouvernance du groupe, la clé passe de main en main.
- **Forêt ancienne** : la famille du chemin. Le pas en cours, l'horizon, le cairn dressé puis renversé, la route
  reprise ; la couronne de bois de cerf porte la gouvernance du cercle.
- **Atelier de cuivre** : la famille du pupitre. La machine sous pression, le plan déroulé, le levier abaissé puis
  relevé, la chaîne rompue pour l'annulation ; l'engrenage nu est réservé aux Membres (à la place de ⚙) ; aucune autre
  icône n'en dessine.

| Concept (fichier) | Grimoire émeraude | Forêt ancienne | Atelier de cuivre |
|---|---|---|---|
| Mes parties (`nav-parties`) | livre de face, fermoir | sentier sous une voûte d'arbres | dirigeable souple |
| Personnages (`nav-personnages`) | portrait en médaillon | écureuil assis ✱ | tête d'automate carrée à visière |
| Calendrier (`nav-calendrier`) | almanach étoilé | calendrier au croissant de lune | feuillet de calendrier à cadran |
| Compte (`nav-compte`) | grimoire à monogramme | carnet à élastique | établi à étau |
| MJ (`role-mj`) | plume d'oie | lanterne | compas |
| Joueur (`role-joueur`) | bâton de mage à orbe ✱ | bâton de marche et baluchon | clé à molette |
| Admin (`role-admin`) | clé de bibliothécaire | couronne de bois de cerf | trois chevrons |
| Hôte (`role-hote`) | porte ronde de terrier (inspirée du Seigneur des anneaux, sans emprunt) | hutte ronde | porte d'atelier à hublot |
| En cours / À venir (`etat-en-cours`, `etat-a-venir`) | livre ouvert / sablier | empreintes / soleil levant | cylindre à vapeur qui souffle / plan déroulé |
| Terminée / Annulée (`etat-terminee`, `etat-annulee`) | livre fermé au cachet de cire / même livre, cachet fêlé | cairn / cairn renversé | levier abaissé / chaîne rompue |
| Rouvrir (`rouvrir`) | livre qui s'ouvre | empreinte et flèche qui repart | levier relevé et flèche |
| Masquer de ma liste (`masquer`) | livre à l'œil fermé | œil clos sous un rameau | iris fermé sur un hublot |
| Proclamer (`proclamer`) | parchemin déroulé à cachet | cor | antenne de télégraphe |
| Distribuer l'XP (`distribuer-xp`) | étoile qui s'élève d'un livre ouvert | livre sur une souche | pile de jetons de cuivre |
| Inviter / Retirer (`inviter`, `retirer-membre`) | missive cachetée / missive et croix | main tendue / main et croix | tampon / tampon et croix |
| Nommer admin / Quitter l'office (`nommer-admin`, `quitter-office`) | clé + / clé ↓ | couronne + / couronne ↓ | chevrons + / chevrons ↓ |
| Quitter le groupe (`quitter-groupe`) | flèche qui sort d'un cercle ouvert | sortie du cercle de pierres | sortie par l'écoutille |
| Favori (`favori-vide`, `favori-pose`) | signet | poteau à encoche | punaise |
| Signal à traiter (`signal`) | lettrine « ! » | nœud sur une ficelle | manomètre dans le rouge |
| Vote (`vote`) | main levée | main levée tenant une feuille | gant mécanique levé |
| Destinée (`destinee`) | constellation | étoile prise dans les branches | étoile dans une longue-vue |
| Document joint (`document`) | parchemin roulé | rouleau d'écorce | télégramme |
| Jeux de société (`jeux`) | calice seul, sans coffret ✱ | coffre aux trésors | râtelier à boîtes de jeux |
| Envie (`envie`) | cœur qui rayonne | cœur de deux feuilles | cœur mécanique à clé |
| Membres (`membres`) | baguettes croisées étincelantes (symbole magique) ✱ | feuille de chêne à moitié pleine | engrenage |

**✱ Retouches de l'utilisateur, à ne pas changer sans lui** (addendum du PRD, reprises en FR-6) :
- Forêt, Personnages (Compagnons) : un petit animal, l'écureuil.
- Grimoire, Joueur et Membres : bâton de mage (orbe plein) pour le joueur, baguettes croisées étincelantes (étincelles
  aux deux pointes) pour les membres. Les deux ne doivent pas se confondre.
- Grimoire, Jeux de société : une relique seule, le calice, sans coffret (le coffre reste à la Forêt).
- Grimoire, Membres : un symbole magique.

**Admin** : `role-admin` remplace l'écu Admin du Palier 10, y compris en badge de 14 px sur l'avatar (planche 2b) ;
c'est l'icône admin de chaque thème qui s'affiche (amendement au PRD, FR-8, listé en EXPERIENCE §9).

**Pourquoi ces choix** (pour qu'aucune story ne revienne à l'addendum) :
- Forêt sans feu de camp : il est réservé au badge du ralliement (L1).
- Vote = main levée dans les trois thèmes, par cohérence (d'où le gant V1 gardé par l'Atelier plutôt que l'urne à
  manivelle).
- Grimoire, Mes parties : le livre de face V2 ; le livre à fermoir V1 a été écarté parce qu'il ressemblait à un
  portefeuille.
- Atelier, Mes parties : le dirigeable souple V1, retenu pour sa lisibilité en petit, alors que l'utilisateur préférait
  le zeppelin V2.

**Libellés de thème** : le tableau donne le concept, pas le nom affiché. Le nom affiché — et donc l'`aria-label` d'une
icône seule (EXPERIENCE §6) — est le libellé de thème du concept, pris dans les fichiers de ton
(`apps/web/src/app/core/theme/tones/`). Par exemple, l'icône `vote` du bouton « Lancer le vote » porte « Convoquer le
conseil » / « Réunir le cercle » / « Ouvrir le scrutin ». D'autres exemples figurent sur les planches (« Close »,
« Achevé », « Démantelée », « Cette relique m'appelle »…).

Planches thème par thème : [`mockups/icones-2-grimoire.html`](mockups/icones-2-grimoire.html),
[`mockups/icones-2b-grimoire-retouches.html`](mockups/icones-2b-grimoire-retouches.html),
[`mockups/icones-3-foret.html`](mockups/icones-3-foret.html), [`mockups/icones-4-atelier.html`](mockups/icones-4-atelier.html),
[`mockups/icones-4b-atelier-admin.html`](mockups/icones-4b-atelier-admin.html). Elles montrent aussi les variantes
écartées ; seul le dossier `mockups/icones/` fait foi.

**Icônes utilitaires** ([`mockups/icones-5-utilitaires.html`](mockups/icones-5-utilitaires.html)) : les glyphes simples
sont en trait seul (fermer, chevrons, déplier, rechercher…) ; les pictogrammes ont une zone pleine (pointe de flèche,
point de l'info et de l'avertissement, trou de serrure, pupille, case du jour).

| Remplacé | Par (`communes/`) |
|---|---|
| `close`, ✕ | `fermer` |
| `arrow_back` | `retour` |
| `chevron_left` / `chevron_right`, ❮ ❯ ‹ › | `precedent` / `suivant` |
| `chevron_right` « ouvrir » | `ouvrir` |
| `expand_more`, ⌄ ⌃ ▾ ▴ ▸ | `deplier` / `replier` (▸ = `deplier` tourné de −90°) |
| `today` | `aujourdhui` |
| `add` | `ajouter` |
| `edit`, ✎ | `modifier` |
| `delete` | `supprimer` |
| effacer un champ | `effacer` |
| `check` « accepter », ✓ | `valider` |
| `check` « thème actif » | `actif` |
| `search` | `rechercher` |
| `tune` | `filtres` |
| `restart_alt` | `reinitialiser` |
| `download` | `telecharger` |
| `content_copy` | `copier` |
| `mail` | `email` |
| `link` / `link_off` | `lien` / `lien-revoque` |
| `info` | `information` |
| `warning`, ⚠ ⚠️ | `avertissement` |
| `lock` (bouton Visibilité), 🔒 🔓 (note privée / partagée) | `cadenas-ferme` / `cadenas-ouvert` |
| œil du mot de passe | `oeil` / `oeil-barre` |
| `grid_view` / `view_agenda` / `view_list` | `vue-large` / `vue-moyenne` / `vue-compacte` |
| ✅ ⚠️ ❌ des compteurs de dispos | `dispo-oui` / `dispo-partiel` / `dispo-non` |
| ☰ « Affichage » | `menu-affichage` |
| ⋮ menu d'actions | `menu-actions` |
| pictos matin / après-midi / soir du calendrier | `matin` / `apres-midi` / `soir` |
| déconnexion | `quitter` |
| *(nouveau)* « Déclarer mes dispos » | `declarer-dispos` |

Les icônes Material de sens (`home`, `badge`, `calendar_month`, `person`, `shield`, `flag`, `play_circle`,
`schedule`, `event_busy`, `replay`, `visibility_off`, `campaign`, `auto_awesome`, `person_add`, `person_remove`,
`admin_panel_settings`, `logout`, `exit_to_app`, `star`/`star_border`, `description`) et ♥ ✦ ⚔ 🌿 ⚙ sont remplacés
par les icônes de sens du tableau des familles (plus haut).

**À surveiller en recette** (compromis connus, à vérifier à 16 px dans l'application) :
- Grimoire : Terminée et Annulée (`etat-terminee`, `etat-annulee`) presque identiques à 16 px.
- Atelier : l'iris de Masquer (`masquer`) peut se lire comme un diaphragme d'appareil photo, les jetons de Distribuer l'XP
  (`distribuer-xp`) comme une base de données.
- Utilitaires : `menu-affichage` et `vue-compacte` proches ; `actif` et `dispo-partiel` proches.
- `quitter` (déconnexion) proche de la trappe Atelier de « Quitter le groupe ».
- `dispo-non` dessiné en anneau barré (⊘) pour ne pas se confondre avec `effacer`.

## Do's and Don'ts

- Do : réserver le contour plein `{colors.accent-1}` au mode déclaration allumé : il signale qu'on est en train
  d'écrire.
- Don't : faire porter l'appel à l'action par le badge d'état d'une séance ; il appartient à la pastille « Ma situation ».
