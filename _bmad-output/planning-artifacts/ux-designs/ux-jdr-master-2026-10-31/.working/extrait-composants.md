# Extrait — composants à réutiliser (2026-10-31)

Chemins : UX/ = `_bmad-output/planning-artifacts/ux-designs/`, APP/ = `apps/web/src/app/`.

## Tokens
- Héritage : 10-29 → 10-20 → 10-08 → 09-23 → 08-31 → 08-04 → 20260626 ; les deltas n'ajoutent pas de token de thème.
- Couleurs de base (20260626) : primary-bg, surface-bg, accent-1, accent-2, gradient-cta, text-primary, text-muted,
  status-unavailable, status-unknown, status-mixed, border-subtle, overlay.
- Statuts par thème (08-04 l.83-104) : status-todo, status-live, status-soon, status-done ; brouillon = contour tireté.
- Typo : text-sm 12, text-base 14, text-lg 16/500, text-xl 20/600, text-2xl 26/700 ; P10 ajoute 13, 11, 22.
- Arrondis : card 10, badge 6, input 4, button 8, button-cta 10, panel 12, chip 4 ; P10 : pilule 999, encadré 14, case 10.
- Espacements : xs 4, sm 8, md 12, base 16, lg 24, xl 32.
- Composants : StatusBadge (08-04 l.176-203) ; event-card (10-08 DESIGN l.59-62) ; situation-panel (10-08 DESIGN
  l.71-76 : rayon 14, bordure 1.5px status-todo membre / accent-1 hôte, fond todo 7 %) ; vote-summary (10-08 l.77-80) ;
  state-tag (10-20 l.53-60) ; side-dock ; destiny-sheet ; propose-dates-action (10-20 l.78-80, stroked, minHeight 36).
- Pastille « Ma situation » : pas de token ; code `event-card.scss:102-119` (1px 8px, rayon 6, status-live 12 %,
  variante pointillée). Écart au spec : « Vote à faire » devrait être en status-todo (10-08 EXPERIENCE l.207-209).
- Signaux du tableau de bord : code `dashboard.scss:196-223` (todo 20 %, variante soon, « +N » tireté, icône flag).

## Comportement
- « Ma situation » (10-08 EXPERIENCE l.184, 207-209) : ligne toujours présente ; Je participe = live, Vote à faire =
  todo, Invitation à accepter = todo, Pas inscrit·e = pointillé, J'y étais = done, Place réservée = todo.
  Priorité du code : vote à faire > place réservée > pas inscrit·e > j'y étais / je participe.
- Fenêtre d'événement : titre + badge → encadré de situation → fiche → inscrits → pied (10-08 EXPERIENCE l.86-94).
- Résumé du vote (event-dialog.html:117-160) : membre = « Vos réponses : x créneaux sur N », « Meilleur créneau pour
  l'instant : date — n oui », bouton plein « Voter dans le calendrier » ; hôte = « Réponses : x sur N inscrits »,
  meilleur créneau, « N'ont pas encore répondu : noms », « Fixer la date… » (plein), « Prolonger le vote » (contour),
  « Voir dans le calendrier → ». Confirmation « Fixer » : radios, meilleur présélectionné.
- Signaux : dérivés côté serveur, aucun ne se ferme ; plafond 2 + « +N ». Patron de bandeau fermable :
  `destinyNotice` (calendar-view.html:30-39).

## Calendrier
- `.calendar-controls` (calendar-view.html:40-145) : ☰ Affichage · pastille de résumé · puce ✦ (masquée en Agenda) ·
  « Proposer des dates » · ressort · bascule Mois | Semaine | Agenda. Même ligne sur mobile, en flex-wrap.
- Navigation ‹ titre › et « aujourd'hui » dans chaque vue.
- Barre de sélection dans le flux, sous la grille (ni sticky ni tiroir), puis compose-bar, rail, légende.
- Colonne de droite : < 768 empilée sous la grille ; ≥ 768 colonne (MJ 40 % min 280 ; joueur/groupe 340 sticky), dans
  side-dock.

## Fiche de scénario et onglets
- scenario-read-dialog : titre → badge, description, durées → (passé) résumé, journal → annonces → participants →
  seance-list (en fin, l.138).
- scenario-editor : en-tête → ajout de séance → résumé de fin → seance-list (l.76) → participants, description…
- seance-list : par séance titre, date ou vote, infos pratiques, compte rendu ; poll-status (MJ) l.114/196,
  poll-response (joueur) l.170/231.
- Onglets JDR : MJ = Détails · Missives · Homme Dragon · Chapitre(s) · Chronologie ; joueur = Détails · Folios ·
  Chronologie. Quête unique : pas de Chronologie.

## Compte
- account.html : identité → thème → « Ce que révèle mon calendrier » (cases) → Ludothèque → mot de passe →
  déconnexion → zone sensible. Pas de section d'options.

## Vocabulaire
- Signaux `partie.signal_*` : « Répondez au vote » / « Réponds à l'appel du vote » / « Vote à renseigner ».
- Disponibilités : clés neutres ; `calendar.view_propose_dates` = « Proposer » / « Propose » / « Soumettre des dates ».
