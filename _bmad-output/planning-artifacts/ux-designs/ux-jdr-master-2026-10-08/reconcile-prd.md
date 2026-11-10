# Réconciliation PRD ↔ UX — Palier 10 (2026-10-08)

Source PRD : `_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-08/prd.md` (FR-1 à FR-15). Comparé aux spines `DESIGN.md` / `EXPERIENCE.md` du même dossier.

## 1. FR du PRD couverts par une surface UX

| FR | Surface UX | État |
| --- | --- | --- |
| FR-1 (choisir le mode) | Formulaire de création : bascule Quête / Ralliement | couvert ; **ajout** : création ouverte à tout utilisateur (bouton d'en-tête) |
| FR-2 (rencontre isolée) | Page « rencontre isolée », onglets Conjonction / Invités / Invitations | couvert ; **ajout** : accepter / décliner |
| FR-3 (groupe) | Vue de groupe, onglets Conjonctions / Détails / Missives | couvert |
| FR-4 (membres) | Onglet Missives (existant) | couvert |
| FR-5 (admins) | Missives : badge, « Nommer admin », « Quitter l'office » | couvert ; confirmations 2 et 3 |
| FR-6 (retrait) | Missives « Retirer » (existant) + pied de page | partiel : « Quitter le groupe » à placer |
| FR-7 (compte admin) | **Réécrit** : suppression de compte inexistante → à créer | **écart majeur**, voir §2 |
| FR-8 (proposer) | Fenêtre « Nouvelle conjonction » | couvert |
| FR-9 (participation) | Fenêtre de création + inscrits (places réservées, filigrane) | couvert |
| FR-10 / FR-11 (date, sondage) | Fenêtre : date fixée / sondage ; vote **dans le calendrier** | **écart** : le vote ne se fait pas dans la fenêtre ; « Prolonger » est une capacité nouvelle |
| FR-12 (e-mails) | Tableau des 7 e-mails | **écart** : + annulation ; bouton + pied sur tous les e-mails |
| FR-13 (permissions) | Matrice de l'EXPERIENCE (admin annule, hôte fixe/prolonge) | à compléter |
| FR-14 (migration) | — (pas d'UI) | sans objet UX |
| FR-15 (libellés) | EXPERIENCE §3.1 (par thème) | couvert |

## 2. Écarts à reporter dans le PRD

1. **Suppression de compte** : n'existe pas dans l'application (aucune route, aucun écran). Décidée dans ce palier : Compte → « Zone sensible ». FR-7 est réécrite ; autorisée même pour un MJ ou un seul admin, avec avertissement fort et mot de passe.
2. **Annuler** une conjonction / une rencontre isolée : état « annulé » (trait diagonal), e-mail #7, masqué par la case « Masquer les clos et les annulés ». Nouvelle FR.
3. **Retirer de sa liste** (masquage définitif, pour soi seul) une partie terminée ou annulée ; **s'applique aussi au JDR**. Nouvelle FR.
4. **Accepter / décliner** une invitation nominative à une rencontre isolée.
5. **Bouton de création global**, visible pour tout utilisateur connecté (aujourd'hui réservé aux MJ). Nouvelle FR.
6. **Le vote se fait dans le calendrier** : la fenêtre ne porte qu'un résumé et un bouton ; pas de plafond de créneaux. **Prolonger l'échéance** d'un sondage n'existe pas côté serveur : capacité nouvelle.
7. **Le JDR n'est plus strictement inchangé** : la liste d'accueil (tuiles, filtres), le bouton de création, le Compte, les e-mails existants et « retirer de sa liste » touchent des écrans partagés. Le PRD (« pas de modification du JDR », SM-2, FR-13) doit lister ces **exceptions décidées**.
8. **Vocabulaire** : « soirée / groupe / événement » du PRD sont des noms de travail ; l'interface dit « ralliement / convergence / conjonction » (par thème).
9. **Hors Palier 10** (backlog) : 10.4 sondage et Destinée dans le calendrier (touche le JDR), 10.6 dispos découvrables, 10.7 icônes, 10.8 reporter côté JDR.

## 3. Choses que le PRD n'avait pas vues et que l'UX a déplacées
- La couverture du formulaire de création (puce « Changer » sur la bannière).
- Le badge de système (Ryuutama, Ralliement) et la pastille du système sur les tuiles.
- La confirmation en rouge pour l'irréversible.
