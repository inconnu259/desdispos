# Addendum — Palier 10.4

*Matière utile aux workflows suivants (UX, architecture, stories) qui n'a pas sa place dans le PRD. Non contractuelle : à vérifier dans le code au moment de l'architecture.*

## État réel au 2026-10-08 (source : `ux-designs/ux-jdr-master-2026-10-08/palier-10-4-entrees.md`)

- Colonne droite du calendrier MJ : « Aucun conseil de date en cours » + champs Du / Au + « Scruter » + liste « Fenêtres de la destinée » (≈ 20 cartes, ≈ 3 000 px, sans action). Planche : `.working/etat-reel-calendrier-mj-fenetres-destinee.jpg` du même dossier.
- Composer : barre cible + compte + Valider / Annuler, 2 créneaux minimum ; crée un vote par sélection de cases.
- Destinée : état interne sans paramètre d'URL ; ‹ n/N › passe d'un vote à l'autre ; votes du mois affiché seulement.
- Panneau « Affichage » : filtre par nature, pas par partie.

## Contraintes héritées à respecter

- **Destinée = mode, pas couche** (Story 36.9, encadré n° 2) : hors de `activeLayers` / `CALENDAR_LAYER_KEYS`, non persistée, état keyé par `pollId` (jamais par un index, à cause des rechargements SSE). Le paramètre d'URL de FR-13 doit porter un identifiant de sondage, pas un rang.
- **Estompe au jour** (36.9, encadré n° 3) dérivée de la liste non filtrée `allCalendarEntries()` ; activer la Destinée allume `votes-en-cours`. Le filtre par partie (FR-15) ne doit pas vider l'ensemble qui pilote l'estompe.
- **`PollStatusPanel`** rendu à trois endroits (calendrier + deux dans la fiche de scénario) : le plateau de la destinée ne doit pas casser les deux surfaces de la fiche de scénario, seul chemin de scellement (36.9, encadré n° 4).
- **Groupe** (Story 40.5b) : la page calendrier du groupe saute `available-slots`, `heatmap`, scénarios, panneaux MJ ; sondages chargés depuis `GET /parties/:id/events/list` ; composer en `MORNING | AFTERNOON | EVENING`, `FULL_DAY` refusé ; modification d'un sondage = `PATCH /parties/:id/events/:eventId` en remplacement complet ; `PARTIE_AVAILABILITY_READ` reste fermé. C'est pourquoi les fenêtres de l'automate n'existent pas en mode soirée.
- **Aller-retour de création** d'une conjonction (40.5b) : brouillon dans un service racine, composer armé « nouvelle conjonction », retour à la fenêtre de création. À conserver avec FR-5 / FR-6.
- **Un sondage appartient toujours à un rendez-vous** : en JDR, un vote exige une `Seance` (Story 36.10 : `createSeancePoll()` sur une des `eligibleSeances()`, refus si aucune) ; en mode soirée, le sondage est celui d'un événement (40.5b). La liste des « rendez-vous à dater » (FR-5) est donc, côté JDR, une généralisation multi-parties de `eligibleSeances()`, et suppose sans doute une lecture nouvelle pour le calendrier personnel.
- **Fixer la date** (FR-11) réutilise les chemins existants : `PollStatusPanel` « Sceller ce créneau » en JDR, `DateFixDialog` / `EventsApiService.choose` en mode soirée (Story 40.6) ; « Prolonger » = Story 40.7.

## Pistes techniques (non décidées)

- FR-13 : un paramètre de requête sur les routes calendrier existantes (calendrier de partie, `/parties/:id/guild-calendar`, calendrier personnel), lu à l'initialisation puis tenu à jour quand la destinée change.
- FR-7 « toutes les parties actives » : le calendrier personnel ne charge peut-être pas les sondages hors du mois affiché ; vérifier si une lecture nouvelle est nécessaire (première story probablement non « front pure », contrairement à 36.9).
- FR-3 / FR-4 : ~~décider entre stockage serveur et local~~ — **tranché en architecture le 2026-10-20** : masquage sur le serveur, repli dans le navigateur.

## Après l'architecture (2026-10-20)

La spine `architecture/architecture-jdr-master-2026-10-20-p10-4/ARCHITECTURE-SPINE.md` fait foi pour la technique (AD-1 à AD-17). Repères pour les stories : calendrier de partie ou du groupe = « atelier » (AD-5, AD-16), calendrier personnel = « vitrine » (AD-1, AD-2, AD-6) ; durée d'une plage = `Seance.durationSlots` (AD-10) ; une plage datée se lit entière (AD-14) ; échéance par défaut unique (AD-17). Les plages longues (FR-19 à FR-23) y portent le nom de lot `PL-1`.
- Temps réel : le signal `changed` des scénarios et de la liste des événements suffit sans doute ; à évaluer pour chaque surface selon `docs/checklist.md`.
