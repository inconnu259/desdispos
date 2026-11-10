# Inventaire des icônes de l'application (2026-10-08)

Source : `apps/web/src/app` (gabarits `.html`, fonctions TS, composants à SVG inline). Toutes les icônes
« Material » sont des ligatures de la police Material Icons (`<mat-icon>nom</mat-icon>`), donc **génériques,
identiques dans les trois thèmes**. Les textes, eux, varient par thème.

## 1. Material Icons (génériques) — 33 icônes statiques + 10 dynamiques

### Navigation et structure
| Icône | Signification actuelle | Où |
|---|---|---|
| `home` | destination « Mes parties » (1ʳᵉ de la barre) | shell |
| `badge` | destination « Personnages » | shell |
| `calendar_month` | destination « Calendrier » | shell |
| `person` | destination « Compte » ; **aussi** « joueur » (rôle) | shell, dashboard |
| `arrow_back` | retour | fiche de personnage, détail de scénario |
| `chevron_left` / `chevron_right` | période précédente / suivante (calendrier) ; « ouvrir » (liste) | calendrier, détail de partie |
| `expand_more` | déplier | création de sondage |
| `close` | fermer (bandeau, panneau, fenêtre) | shell, dashboard, calendrier, sondage |
| `today` | revenir à aujourd'hui | calendrier |

### Actions
| Icône | Signification actuelle | Où |
|---|---|---|
| `add` | créer / ajouter (**bouton « lancer une quête »**, ajouter une option) | dashboard, sondage |
| `edit` | modifier la partie | détail de partie |
| `delete` | supprimer | détail de partie, calendrier, sondage |
| `check` | accepter une invitation ; thème actif | dashboard, sélecteur de thème |
| `download` (×10) | télécharger une fiche / un journal (PDF, etc.) | détail de partie |
| `content_copy` | copier le lien d'invitation | détail de partie |
| `search` | rechercher | détail de partie, barre de liste |
| `tune` | afficher filtres et tri | barre de liste |
| `restart_alt` | réinitialiser filtres | barre de liste |
| `replay` | rouvrir une partie terminée | détail de partie |
| `auto_awesome` | « distribuer l'XP / faveurs » | détail de partie |
| `campaign` | « publier une proclamation » (annonce MJ) | détail de partie |

### Invitations et accès
| Icône | Signification actuelle | Où |
|---|---|---|
| `person_add` | inviter un joueur | détail de partie |
| `person_remove` | retirer un joueur | détail de partie |
| `mail` | inviter par e-mail | détail de partie |
| `link` / `link_off` | créer / révoquer un lien d'invitation | détail de partie |
| `lock` | verrous de visibilité (anti-spoil) | détail de partie |
| `info` | avertissement d'homonymie | détail de partie |

### États
| Icône | Signification actuelle | Où |
|---|---|---|
| `flag` | ⚠️ **surchargé** : partie **terminée** (indicateur, bandeau, bouton « clore ») ; **signal** à traiter (pastilles « Assembler son Homme Dragon… ») ; repli de `tintIcon` | dashboard, détail de partie |
| `play_circle` | partie en cours (teinte « live ») | dashboard |
| `schedule` | partie à venir (teinte « soon ») | dashboard |
| `shield` | rôle **MJ** (Maître / Guide / Ingénieur) | dashboard |
| `person` | rôle **joueur** (Héros / Voyageur / Mécanicien) | dashboard |
| `star` / `star_border` | favori | dashboard |
| `description` | document joint à un scénario | éditeur de scénario |

### Vues de liste (barre de contrôles)
| Icône | Signification |
|---|---|
| `grid_view` | vue large |
| `view_agenda` | vue moyenne |
| `view_list` | vue compacte |

## 2. SVG déjà sur mesure
`brand-logo` (d20 coché, logo « Dés Dispos ») · `auth-band` (bande de marque) · `party-banner` (bannière
générée) · `nature-marker` (marqueur Homme Dragon) · `identity-label` (convention d'identité personnage/joueur) ·
`password-toggle` (œil) · `calendar-week-view` / `calendar-detail-rail` (pictos du calendrier).

## 3. Pictogrammes dans les textes de thème
Au moins : `⚔` Compagnons, `🌿` Habitants, `⚙` Équipage (titres de liste de membres). Emoji rendus par la police
du système : **aspect différent selon l'appareil**, non teinté par le thème.

## 4. Constats
1. **Un seul jeu d'icônes générique pour trois thèmes** : l'identité (grimoire, forêt, atelier) ne passe que par les textes.
2. **Icônes surchargées** : `person` (compte **et** rôle joueur) ; `flag` (terminé **et** signal à traiter).
3. **Métaphores faibles ou trompeuses** : `campaign` (porte-voix) pour une proclamation, `auto_awesome` (étincelles) pour distribuer de l'XP, `home` pour « Mes parties », `badge` pour « Personnages ».
4. **Emoji** dans des titres : rendu hétérogène.
5. **Surface** : ~43 glyphes, dont 10 occurrences de `download` : un bon candidat à un seul glyphe décliné.
