# Relecture éditoriale — PRD Paliers 10.6 à 10.8

Date : 2026-10-31. Passe `bmad-review` (lentilles structure puis prose) sur `prd.md` et `addendum.md`, puis
corrections appliquées. Lecteur visé : humain, non développeur. Modèle de structure retenu : Strategic/Context
(PRD). Corrections sans effet sur le sens : aucune exigence, décision, conséquence, libellé « … », chemin ou
identifiant (FR, UJ, SM, Q) ajouté, retiré ou renuméroté ; titres de section et marqueurs ⚠️ conservés
(vérifié par comparaison avant / après).

## prd.md — 22 corrections

**Structure (2)**
- FR-11 : la justification entre parenthèses passe avant « Réalise UJ-3. », au lieu de suivre la référence.
- Double ligne vide avant le §8 réduite à une seule.

**Grammaire et accords (4)**
- FR-1 : « allumer l'un éteint l'autre » → « éteint les deux autres » (trois modes s'excluent).
- §4.3 Out of Scope et §6.2 : « abandonné » → « abandonnés » (les boutons).
- FR-10 : « à part de son état » → « distincte de son état ».

**Phrases sans verbe ou sans sujet complétées (5)**
- §0 : « Une section par palier, FR numérotées à la suite… » → « Chaque palier a sa section et les FR sont numérotées à la suite… ».
- FR-5 : « Ne vaut que pour ce signal » → « Le choix ne vaut que pour ce signal ».
- FR-7 : « Couvre au moins » → « Le jeu couvre au moins ».
- NFR du 10.7 : « Lisibles de 16 à 24 px » → « Les icônes sont lisibles de 16 à 24 px ».
- §4.2 : « … et les règles ; une vingtaine de concepts… » → « … et les règles. Volume estimé : une vingtaine de concepts… ».

**Clarté, ambiguïtés levées (8)**
- FR-2 : « Valider une déclaration vide la sélection » (lisible « une déclaration vide ») → « Une fois une déclaration validée, la sélection est vidée ».
- FR-5 : « réactivé, le signal réapparaît » (participe mal rattaché) → « une fois le rappel réactivé, le signal réapparaît ».
- FR-8 : la phrase qui mêlait deux paires d'icônes est coupée en deux propositions.
- FR-10 : « suit les changements des autres » → « suit les changements faits par les autres ».
- FR-10 : « Le badge d'état ne mêle plus la situation personnelle » → « ne porte plus » ; virgule et « y » ajoutés dans l'exemple.
- §4.3 Description : « Le Palier 10 a gardé le JDR inchangé ; les paliers 10, 10.4 et 10.5 ont depuis donné » → « a laissé le JDR inchangé, tandis que les paliers… donnaient ».
- §4.3 ⚠️ : « comme le 10.4 l'avait laissé au 10.8 » → « changement que le 10.4 avait renvoyé au 10.8 ».
- Cross-cutting NFRs, Trois thèmes : « avec leur ton » → « avec le ton de chacun ».

**Répétitions allégées (3)**
- §0 : « matière de l'UX » → « destinée à l'UX ».
- UJ-3 : « Hugo ouvre sa partie : elle s'ouvre sur » → « Hugo ouvre sa partie, qui affiche d'emblée ».
- FR-1 : « Tout utilisateur peut, depuis un calendrier où il peut aujourd'hui… » (double « peut ») → « Dans tout calendrier où il peut aujourd'hui déclarer ses dispos, l'utilisateur allume… et peut l'éteindre ».

**Conservé volontairement (PRESERVE)**
- Les justifications entre parenthèses en fin de conséquence (« (pour remplir un mois d'affilée) »…) : elles reprennent les hypothèses confirmées, listées au §9.
- Les redites entre §4.x Out of Scope, §5 Non-Goals et §6.2 : vue par palier contre vue d'ensemble ; le §9 renvoie à ces emplacements.
- La phrase « Les autres SVG existants… sont repris » dans l'Out of Scope du 10.7 : le §9 la cite à cet endroit.

## addendum.md — 2 corrections

- **Structure** : le paragraphe « Production (décidée le 2026-10-31) » passe en fin de section A, après les listes de ce qu'il faut dessiner (icônes de sens, utilitaires, surcharges), puisqu'il s'applique à toutes les icônes.
- **Cohérence** : « dans le style de l'app » → « de l'application », comme dans le PRD.

## À arbitrer (décision de contenu, non appliqué)

1. **Volume d'icônes** (§4.2) : « une vingtaine de concepts » alors que la liste de FR-6 en compte 29. Avec les ~23 utilitaires de FR-7, on dépasse les « 80 dessins » annoncés : on approche plutôt 110.
2. **Extinction du mode déclaration** : le Glossaire dit « il ne s'éteint que par « Terminer » (ou en quittant la page) », mais FR-1 prévoit aussi qu'allumer le Composer ou la Destinée l'éteint.
3. **Glyphes à remplacer** : la liste de FR-9 contient ▴ ▸ ⌃, absents de la liste de l'addendum (section A, Icônes utilitaires).
4. **Surcharges** : l'addendum ne cite que `flag`, `person` et `shield`. FR-8 ajoute `chevron_right` (suivant / ouvrir) et `check` (accepter / thème actif).
5. **Traçabilité** : FR-5 et FR-7 à FR-9 ne disent pas « Réalise UJ-… ». FR-14 ne se rattache à aucun parcours.
6. **Métriques** : aucune SM ne valide FR-13 ni FR-14 (SM-3 couvre FR-10 à FR-12).
7. **« L'utilisateur »** désigne tantôt le porteur du projet (§0, FR-4, FR-6, §8, §9), tantôt l'utilisateur de l'application. Le cas le plus ambigu est FR-4 : « l'utilisateur tient à ce que chacun pense à mettre ses dispos à jour ». Faut-il nommer le porteur du projet autrement ?
8. **FR-1, dernière conséquence** : « Atteignable et utilisable au clavier » n'a pas de sujet. S'agit-il du bouton, du mode, ou des deux ?
