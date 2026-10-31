# Addendum — Paliers 10.6 à 10.8

Matière destinée à l'UX (`bmad-ux`) et à l'architecture, hors du PRD lui-même.

## A. Grille d'icônes de sens par thème (10.7) — état au 2026-10-31

Proposée par l'agent à partir du vocabulaire des fichiers de ton, retouchée par l'utilisateur (✱).
Point de départ pour l'UX, pas un dessin arrêté.

| Concept | Grimoire (magie, parchemin) | Forêt (sentier, tutoiement) | Atelier (vapeur, cuivre) |
|---|---|---|---|
| Mes parties | livre fermé à fermoir | sentier entre deux arbres | dirigeable |
| Personnages / Compagnons / Automates | portrait en médaillon | ✱ petit animal (écureuil ou similaire) | tête d'automate rivetée |
| Calendrier (Almanach / lunaire / Registre) | almanach étoilé | croissant de lune | horloge à engrenage |
| Compte (grimoire / carnet / établi) | grimoire à monogramme | carnet à feuille | établi |
| MJ (Maître / Guide / Ingénieur) | plume d'oie | lanterne | compas de plan |
| Joueur (Héros / Voyageur / Mécanicien) | ✱ bâton de mage ou baguette | bâton de marche | clé à molette |
| En cours / À venir / Terminée | livre ouvert / sablier / sceau de cire | feu allumé / soleil levant / cairn | engrenage qui tourne / plan roulé / levier coupé |
| Proclamation / Appel / Transmission | parchemin scellé | cor | antenne de télégraphe |
| Distribuer l'XP / les récits / les crédits | étoile sur une page | braises de feu de camp | jetons de cuivre |
| Inviter (Convoquer / Accueillir / Enrôler) | missive cachetée | main tendue | tampon d'enrôlement |
| Favori (signet / encoche / épingle) | ruban de signet | entaille dans le bois | punaise |
| Signal à traiter | lettrine « ! » enluminée | nœud sur une ficelle | manomètre dans le rouge |
| Vote (conseil / cercle / scrutin) | chandelles autour d'une table | pierres dressées en cercle | urne à manivelle |
| Jeux (reliques / coffre / râtelier) | ✱ une relique seule, sans coffret | coffre aux trésors | râtelier |
| Membres (remplace ⚔ 🌿 ⚙) | ✱ symbole magique (baguettes croisées ou autre) | feuille | engrenage |

Concepts du FR-6 sans proposition à ce jour, à dessiner en UX : hôte, admin de groupe, annulée, rouvrir,
masquer de ma liste, retirer un joueur, nommer admin, quitter l'office, quitter le groupe, Destinée (✦), document
joint, envie (♥).

Icônes utilitaires (communes aux trois thèmes, redessinées dans le style de l'application) : fermer, retour, chevrons,
rechercher, filtres, réinitialiser, télécharger, copier, supprimer, déplier, modifier, effacer, cadenas, vues de
liste… plus les glyphes Unicode qui servent d'icônes (♥ ✦ ✎ ✕ ✓ ▾ ▴ ▸ ⌄ ⌃ ✅ ⚠️ ❌ 🔒 🔓 ❮ ❯).

Surcharges à lever : `flag` (terminé / signal), `person` (compte / joueur), `shield` (MJ / admin de groupe), `chevron_right` (suivant / ouvrir), `check` (accepter / thème actif).
Inventaire détaillé : `.working/extrait-themes-icones.md`.

Production (décidée le 2026-10-31) : SVG maison dessinés par l'agent, planches par thème validées par
l'utilisateur ; même facture que `shared/create-icon` et `shared/system-badge` (SVG inline en `currentColor`,
sans `id`, `mask` ni `clipPath`, taille par variable CSS). Aucune bibliothèque tierce.
