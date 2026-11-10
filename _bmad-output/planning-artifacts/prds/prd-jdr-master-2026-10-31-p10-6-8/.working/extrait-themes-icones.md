# Extrait — vocabulaire des thèmes et icônes (2026-10-31)

Source : fichiers de ton `apps/web/src/app/core/theme/tones/*.ts`, gabarits `apps/web/src/app`,
inventaire du 2026-10-08 (`ux-designs/ux-jdr-master-2026-10-08/.working/inventaire-icones.md`).

## Ambiances
- **grimoire-emeraude** : magie, bibliothèque et parchemins, au vouvoiement. Grimoire, chapitre, Maître.
- **foret-ancienne** : sentier en forêt, au tutoiement. Sentier, étape, clairière, cercle, Guide.
- **atelier-cuivre** : atelier mécanique, steampunk et vapeur. Mission, opération, équipage, Ingénieur, mécanicien.

## Vocabulaire des concepts portant une icône
| Concept | Grimoire | Forêt | Atelier |
|---|---|---|---|
| Mes parties | Mes aventures | Mes pérégrinations | Mes expéditions |
| Créer | Lancer une quête | Ouvrir un sentier | Initier une mission |
| Personnages | Personnages | Compagnons | Automates |
| Calendrier | Almanach | Calendrier lunaire | Registre horaire |
| Compte | Mon grimoire | Mon carnet | Mon établi |
| Déconnexion | Fermer le grimoire | Quitter la forêt | Couper la vapeur |
| MJ | Maître | Guide | Ingénieur |
| Joueur | Héros | Voyageur | Mécanicien |
| Genre JDR | Quêtes | Sentiers | Missions |
| Chapitres | Chapitres | Étapes | Opérations |
| Proclamation | Proclamer une annonce | Lancer un appel dans la forêt | Diffuser une transmission |
| Distribuer l'XP | Distribuer de l'XP | Partager les récits | Distribuer les crédits d'expérience |
| Clore / Rouvrir | Clore / Rouvrir le grimoire | Achever le sentier / Reprendre la route | Mettre à l'arrêt / Remettre en service |
| Inviter | Convoquer | Accueillir | Enrôler |
| Inviter (groupe) | Convier | Inviter au feu | Affecter |
| Invitations reçues | Missives reçues | Appels de la forêt | Transmissions reçues |
| Membres | ⚔ Compagnons | 🌿 Habitants | ⚙ Équipage |
| En cours / À venir / Terminée | En cours / À venir / Close | En route / À l'horizon / Achevé | En service / En préparation / Démantelée |
| Favori | Marquer d'un signet | Marquer d'une encoche | Épingler au tableau |
| Signal à traiter | choses à accomplir | choses à faire | interventions à mener |
| Vote | Convoquer le conseil | Réunir le cercle | Ouvrir le scrutin |
| Fenêtre de la Destinée | Fenêtre | Clairière | Créneau |
| Genre soirée | Ralliements | Veillées | Rassemblements |
| Conjonction | Conjonction | Halte | Réunion |
| Jeux de société | Mon cabinet de reliques | Mon coffre aux trésors | Mon râtelier |
| J'apporte | J'apporte | Je l'apporte | Je l'achemine |
| Envie | Cette relique m'appelle | J'ai envie d'y jouer | Je veux l'essayer |

Non thématisés : séance, Destinée, disponibilités, Annulée, Hôte/Admin/Membre, administration du groupe.

## Icônes ajoutées depuis le 2026-10-08
- Material : `event_busy` (annulée), `visibility_off` (masquer de ma liste), `warning` (confirmation
  destructive), `admin_panel_settings` (nommer admin), `logout` (quitter l'office), `exit_to_app` (quitter le
  groupe), `shield` réutilisé pour Admin (déjà MJ → nouvelle surcharge).
- Disparues : `add` (remplacée par le SVG `create-icon`), `expand_more`.
- SVG sur mesure : `create-icon` (d20 + crayon), `system-badge` (R1 Ryuutama, L1 ralliement), écu Admin
  (participant-chip), crayon inline (couverture).
- Glyphes Unicode servant d'icônes (non teintés) : ♥ envie, ✦ Destinée, ⌄⌃▸▾▴ déplier, ✎ modifier, ✕ effacer,
  ✓, ✅⚠️❌ compteurs de dispo, 🔒🔓 partage de note, ❮❯ pagination, ⚔🌿⚙.

## Rendu
Police Material Icons (Google Fonts, `apps/web/src/index.html:19`), `MatIconModule`, pas de `MatIconRegistry`.
SVG sur mesure = composants Angular inline en `currentColor` dans `apps/web/src/app/shared/`.
