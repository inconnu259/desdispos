# Extrait — déclaration des dispos et écrans JDR (2026-10-31)

## Déclarer ses dispos aujourd'hui (Story 36.3, AC15 ; décision utilisateur du 2026-08-18)
- Story : `_bmad-output/implementation-artifacts/36-3-la-selection-devient-le-geste-de-declaration.md`.
  Motif d'AC15 : la barre qui surgissait à chaque clic gênait la lecture.
- Code : `apps/web/src/app/features/calendar/selection.utils.ts` (`LONG_PRESS_MS = 450`),
  `calendar-month-view.ts` (~l.961) et `calendar-week-view.ts`, `selection-bar/selection-bar.html`.
- Tap court = lecture (le rail affiche le jour, rien ne s'ouvre). Appui maintenu de 450 ms (souris comprise) ou
  glissement horizontal = la sélection s'arme et la barre de sélection apparaît ; ensuite chaque clic ajoute ou
  retire un créneau (AC17/18).
- Barre : portée (Journée · Matin · Après-m. · Soir), Disponible / Indisponible (indisponible par défaut,
  `Entrée`), « Autre… » (`constraint-panel` : seul chemin pour le récurrent et pour modifier/supprimer), Annuler.
- Unité = créneau matin / après-midi / soir. Clavier : `Espace`, `1/2/3`, `Maj`+flèches, `Entrée`, `Échap`.
- Desktop : clic droit et double-clic réservés à « aucune action » (AC9). La story reconnaît que le clic long n'a
  aucune convention sur ordinateur ; le glissement est la seule porte découvrable.
- Aucune autre entrée : pas de bouton « déclarer », la page Compte règle seulement l'affichage des couches.
  Story 45.3 réutilise le même geste pour composer un vote.
- Les dispos alimentent : jauge « disponibilité du groupe » (`GET /parties/:id/heatmap`), l'automate « Fenêtres de
  la destinée » (`available-slots.ts`), la ligne « n dispos sur toute la plage » du plateau Destinée (47.5).
  Les votes restent une réponse séparée.
- Specs UX : `ux-jdr-master-2026-10-08/EXPERIENCE.md` l.20 (calendrier non redessiné) et l.305 (renvoi au 10.6) ;
  `ux-jdr-master-2026-08-04/EXPERIENCE.md` l.495, 553, 601 (appui maintenu = amorce du glissement mobile).
- Mécanismes d'aide existants : aucun tutoriel, coachmark ni marqueur « déjà vu » ; signaux à traiter
  `partie.signal_*` (aucun « dispos non déclarées ») ; textes vides ponctuels ; bandeau d'homonymie « Ignorer »
  (mémorisé en mémoire seulement) ; la légende du calendrier explique les couleurs, pas les gestes.

## Candidats du Palier 10.8 — état actuel
1. **« Ma situation » sur les cartes** — JDR : `scenario-timeline.html`, `scenario-list.html`, `app-status-badge`
   (`core/status/status-derivation.ts`) mélange état de séance et situation perso (« Répondez au vote »).
   Soirée : `events/event-card/event-card.html`, ligne dédiée (Vote à faire, Place réservée, Participe, Pas inscrit,
   J'y étais). Partiel côté JDR : le vote à faire existe, pas « participe / pas inscrit ».
2. **Fiche « situation d'abord » + vote en résumé** — JDR : `seance-list` dans `scenario-read-dialog` /
   `scenario-editor` ; MJ = `app-poll-status` (liste complète, « Choisir cette date », « Clôturer le vote ») ;
   joueur = `app-poll-response` (vote créneau par créneau dans la fiche). Soirée : `events/event-dialog` = panneau de
   situation en tête, sondage en résumé 3 lignes + « Voter dans le calendrier ». Déjà en place : `?poll=` lu par
   `calendar-view.ts` (~l.3329, FR-13 du 10.4), `goToCalendarForSeance`. Reste : remplacer les listes de `seance-list`.
3. **Onglet d'accueil = chapitres + badges de rôle** — JDR (`partie-detail.html`, `.ts` l.487) : Détails · Fiches ·
   Invitations · Membres · (Homme Dragon) · Chapitres · Chronologie ; ouverture sur Détails (ou Fiches). Groupe :
   Conjonctions en premier et par défaut. Badges : `roster-rail` / `roster-strip` ont déjà MJ + initiale du rôle ;
   badge Admin décidé mais pas dessiné (EXPERIENCE 10-08, point ouvert 5).
4. **« Changer » sur la bannière** — `partie-form.html` l.42-95 : « Changer » / « Retirer » déjà présents en création
   et en édition, toutes familles (story 38.3). Pas de pastille sur la bannière de la page de partie elle-même.
5. **Boutons du pied de page** — même bloc `mat-card-actions.icon-bar` pour les deux modes (`partie-detail.html`
   l.646-716), boutons texte + icône sans hiérarchie. JDR (MJ) : Retranscrire · Visibilité · Clore / Rouvrir ·
   Brûler (rouge). Soirée (hôte) : Retranscrire · Clore / Rouvrir. Groupe (admin) : + Quitter l'office · Brûler.
   Différence = libellés et gouvernance, apparence identique.
