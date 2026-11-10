# PRD Quality Review — Paliers 10.6 à 10.8 (prd-jdr-master-2026-10-31-p10-6-8)

*Revue calibrée pour un projet personnel (scope personal / scope-1, PRD volontairement court, rédigé en voie rapide). Les sections « entreprise » absentes ne sont pas reprochées.*

## Overall verdict

Un PRD solide pour son enjeu : la Vision est propre au produit, les trois paliers ont chacun un périmètre net, leurs non-objectifs datés, et les 16 `[ASSUMPTION]` sont toutes indexées. Le 10.6 et le 10.7 sont prêts pour l'UX, à une réserve près : personne n'a décidé comment produire ~80 dessins d'icônes. Le 10.8 n'est pas encore prêt pour les épics : la matrice « Ma situation » n'est pas définie, et la suppression de « Clôturer le vote » retire une capacité du MJ, ce qui contredit la promesse « seule la présentation change ».

## Decision-readiness — adequate

Les décisions sont énoncées et datées (« Tutoriel, visite guidée […] : non retenus le 2026-10-31 », « Boutons du pied de page […] : abandonné le 2026-10-31 »). La seule vraie tension du 10.6, rendre la déclaration visible sans revenir sur AC15, est dite franchement (§4.1, Description : « sans barre qui surgit (motif de la décision AC15 du 2026-08-18) ») et elle a sa contre-métrique (SM-C1). Les Questions ouvertes sont réellement ouvertes et Q-1 a un défaut explicite (« sinon le périmètre s'arrête là »).

Le point faible : plusieurs choix qui structurent le travail aval restent des hypothèses formulées par l'agent, pas des décisions de l'utilisateur. Le signal FR-4 tout entier (« signal retenu en plus du mode, proposé par l'agent »), le passage de toute la conclusion du vote par la Destinée (FR-11) et la pastille « Changer » sur la bannière dans les deux modes (FR-13) changent le nombre et le contenu des stories. Au 10.7, la question la plus coûteuse n'est pas posée du tout : qui dessine les icônes, et à partir de quoi.

### Findings

- **[high]** Production des icônes non décidée (§4.2, Description) — « Les dessins eux-mêmes relèvent de l'UX ; ce PRD fixe le périmètre et les règles. » Or FR-5 liste ~21 concepts × 3 thèmes, et FR-6 + FR-8 ajoutent une vingtaine d'icônes utilitaires, soit environ 80 dessins. Le flux UX (DESIGN.md / EXPERIENCE.md) ne produit pas de SVG. Rien ne dit si on part d'un jeu sous licence libre (avec attribution éventuelle à prévoir), si les dessins sont générés ou faits à la main, ni sous quel format ils seront livrés. C'est ce qui fixe la taille du 10.7 et sa faisabilité. *Fix :* ajouter une décision (ou un `[NOTE FOR PM]` / une Q-4) sur le mode de production, la source et la licence, et le format attendu (SVG en ligne, sprite…). On peut aussi prévoir un lot pilote, par exemple les destinations dans un seul thème.
- **[medium]** Choix structurants laissés en hypothèse (§4.1 FR-4, §4.3 FR-11, FR-13) — trois `[ASSUMPTION]` créent ou suppriment des fonctions entières au lieu de préciser un détail. *Fix :* les faire confirmer par l'utilisateur avant le découpage en épics, puis les convertir en décisions datées comme les autres.

## Substance over theater — strong

Rien n'est là pour meubler. Les quatre lignes de JTBD (§2.1) correspondent chacune à un palier. La Vision n'est transposable à aucun autre produit (« un écureuil pour les Compagnons de la forêt, une tête d'automate dans l'atelier »). Les NFR ont des bornes (« Lisibles de 16 à 24 px »), le retrait de la police Google Fonts est concret, et les métriques sont qualitatives sans prétendre au contraire, ce qui convient à une bande d'amis. Aucun finding.

## Strategic coherence — adequate

La thèse est claire et tenue : polir avant la mise en production (Palier 11), pour qu'un nouvel arrivant n'ait pas besoin qu'on lui montre l'application. Le 10.6 et le 10.7 la servent directement. Le 10.8 suit une autre logique, rattraper côté JDR ce que la soirée a reçu, mais le §1 l'annonce honnêtement. Chaque métrique (SM-1 à SM-3) valide un palier. SM-C1 est une vraie contre-métrique, rattachée à la décision qu'elle protège. FR-12 et FR-13 n'ont pas de métrique, ce qui est acceptable à cette échelle.

### Findings

- **[low]** FR-13 se contredit sur son propre statut (§4.3 FR-13) — l'énoncé dit « comme l'hôte ou l'admin en mode soirée, peut changer la couverture depuis la bannière », ce qui suppose que la soirée le fait déjà. L'hypothèse dit au contraire « ajout retenu […] ; vaut pour les deux modes puisque la bannière est commune » : c'est donc nouveau aussi en soirée, et ce n'est pas un « acquis soirée » reporté. *Fix :* reformuler (« nouveau dans les deux modes ») ou retirer la comparaison.

## Done-ness clarity — thin

Le 10.6 et le 10.7 sont majoritairement testables. FR-7 nomme chaque surcharge à lever (`flag`, `person`, `shield`), FR-8 liste les glyphes à remplacer et FR-6 dit « Une seule icône « télécharger » sert aux dix téléchargements actuels ». Le 10.8 est la partie que les stories vont solliciter le plus, et c'est là que le « done » est flou. Le cœur du palier, les valeurs de « Ma situation » et les actions qu'elles appellent, est laissé à une hypothèse « sur le modèle de `event-card` ». FR-11 retire en plus une action sans dire où elle va.

### Findings

- **[high]** Matrice « Ma situation » non définie, et UJ-3 laisse croire que voter inscrit (§4.3 FR-9, §2.2 UJ-3) — FR-9 donne quatre valeurs (« Vote à faire », « Inscrit », « Pas inscrit », « J'y étais ») sans dire quelle combinaison état de séance × inscription × réponse au vote produit laquelle. UJ-3 écrit « Il vote. De retour, la pastille indique « Inscrit » », ce qui sous-entend que voter vaut inscription. Ce serait un changement de règle du JDR, exclu par §5 (« Pas de changement des règles du JDR »). Il manque aussi le cas « a voté, date pas encore fixée », ainsi que le cas d'une séance passée sans inscription (« J'y étais » seulement si on était inscrit ?). *Fix :* ajouter à FR-9 une table (état de la séance × inscrit oui/non × a voté oui/non → situation affichée). Ajouter si besoin une valeur « A voté », et corriger UJ-3.
- **[high]** Retirer « Clôturer le vote » supprime une capacité (§4.3 FR-11) — « la liste « Choisir cette date » / « Sceller ce créneau » et « Clôturer le vote » dans la fiche disparaissent ». Or, en JDR, le plateau de la Destinée n'offre que « Fixer la date… » et la modification du sondage (PRD 10.4, FR-11 : « en JDR, il n'y a pas de bouton « Prolonger » »). Aucune action ne permet de clore un vote sans date. Le MJ perdrait donc cette possibilité, ce qui contredit §4.3 Out of Scope (« seule la présentation change ») et §5. *Fix :* soit garder « Clôturer le vote » dans le vote en résumé côté MJ, soit l'ajouter explicitement au plateau de la Destinée en JDR, et le dire en conséquence testable.
- **[medium]** Cohabitation des modes du calendrier non spécifiée (§4.1 FR-1, FR-2, FR-3) — le calendrier de partie connaît déjà le Composer et la Destinée (glossaire 10.4). Le PRD ne dit pas si le mode déclaration peut être allumé en même temps, ni ce qu'il devient en entrant en Composer ou en Destinée. Il ne dit pas non plus si le glissement fonctionne en mode déclaration (FR-3 ne le garantit qu'« en mode lecture »). *Fix :* ajouter à FR-1 une conséquence d'exclusion, par exemple « allumer le Composer ou la Destinée éteint le mode déclaration, et inversement », et une ligne sur le glissement en mode déclaration.
- **[medium]** Déclencheur et emplacement du signal FR-4 formulés trois fois (§4.1 FR-4, §8 Q-2) — l'énoncé dit « aucune dispo utile », la conséquence dit « aucune dispo ni indisponibilité déclarée sur les quatre semaines à venir », et Q-2 rouvre la question (« ou jamais aucune déclaration ? »). De plus, les dispos appartiennent à l'utilisateur (glossaire P10 : « disponibilités persistantes de l'utilisateur ») alors qu'UJ-1 met le signal sur une partie (« la partie porte le signal »). Un joueur de trois parties verrait-il donc trois signaux pour une seule action ? *Fix :* garder une seule formulation (renvoyer à Q-2) et préciser l'emplacement : un signal par carte de partie JDR, ou un seul signal global.
- **[low]** Vote en résumé : noms ou nombre ? (§3 « Vote en résumé », §4.3 FR-11, §2.2 UJ-3) — le glossaire et FR-11 disent « qui n'a pas répondu ». UJ-3 montre au joueur « 2 personnes n'ont pas répondu », un nombre, et au MJ « qui n'a pas répondu », des noms. On ne sait pas si un joueur voit les noms. *Fix :* trancher par rôle dans FR-11.
- **[low]** Choix de l'action principale non dit (§4.3 FR-10) — « voter, s'inscrire, se désinscrire » côté joueur, « lancer le vote, fixer la date » côté MJ, mais sans la règle qui choisit, ni le cas d'une séance datée ou passée où aucune action n'est attendue. *Fix :* découle de la table de FR-9 ; y ajouter une colonne « action en tête ».
- **[low]** Adjectifs non bornés (§4.1 FR-1 « dit clairement qu'on est en train de déclarer ») — la présence de l'action « Terminer » rend la conséquence testable, mais « clairement » ne l'est pas. *Fix :* écrire « un bandeau ou un état du bouton indique le mode déclaration ».

## Scope honesty — strong

C'est le point fort du document. Il a des non-objectifs explicites (§5), un Out of Scope par palier, et chaque écran validé qu'il modifie est signalé ⚠️ en tête de section. La régression soirée est bornée (« Hors icônes (10.7) et bannière (FR-13), aucun écran du mode soirée ne change »). Les 16 hypothèses sont toutes reprises au §9. Avec 16 `[ASSUMPTION]` et 3 questions pour un projet personnel en voie rapide, la densité est acceptable, à condition de traiter le finding Decision-readiness avant les épics. Seul accroc : la perte de « Clôturer le vote » (voir Done-ness), une réduction de périmètre faite sans être annoncée.

### Findings

- **[low]** Une vérification déguisée en exigence (§4.3 FR-13, 2ᵉ conséquence) — « déjà livré en Story 38.3, à vérifier » est une tâche de contrôle, pas un comportement à construire. *Fix :* la déplacer en note, ou la reformuler en test de non-régression.

## Downstream usability — adequate

Le glossaire ne contient que les termes nouveaux, avec un renvoi aux PRD précédents. Les IDs se suivent sans trou ni doublon (FR-1 à FR-13, UJ-1 à UJ-3, SM-1 à SM-3 + SM-C1, Q-1 à Q-3). Les renvois externes ont été vérifiés et pointent bien où il faut : 10.4 FR-11 « Fixer la date depuis la Destinée », 10.4 FR-13 « Ouvrir le calendrier en Destinée sur un sondage précis », et l'Out of Scope de 10.4 FR-14 qui confie bien le vote en résumé au « Palier 10.8 ». Chaque UJ a un protagoniste nommé. Deux points gêneront l'architecture et l'UX.

### Findings

- **[medium]** Mauvais canal temps réel pour le signal des dispos (§4 Cross-cutting NFRs, « Temps réel ») — « Le signal des dispos, les pastilles « Ma situation » et le vote en résumé sont câblés sur le signal de changement de leur partie ». Les dispos ne dépendent d'aucune partie (PRD 10.4, FR-15 : « les dispos de l'utilisateur, qui ne dépendent d'aucune partie »). Leur déclaration ne déclenche donc pas le signal d'une partie, et la conséquence FR-4 « disparaît […] sans recharger la page » ne tiendrait pas. *Fix :* préciser que le signal FR-4 suit le canal de l'utilisateur (`user:{id}`), et les pastilles et le résumé celui de la partie.
- **[medium]** La grille de l'addendum ne couvre pas la liste de FR-5 (§4.2 FR-5, addendum §A) — FR-5 compte quatre rôles et quatre états, plus « envie » et « jeux de société ». La grille ne propose rien pour « hôte », « admin de groupe », « annulée » ni « envie ». Par ailleurs, FR-8 remplace ✦, qui est la puce de la liste des destinées (glossaire 10.4), mais aucun concept « Destinée » ou « vote ouvert » ne figure dans FR-5. L'UX ne sait donc pas s'il s'agit d'une icône de sens ou d'une icône utilitaire. *Fix :* compléter la grille, ajouter « Destinée / liste des destinées » à FR-5 (ou le classer explicitement en utilitaire), et dire comment le ♥ est classé.
- **[low]** Engrenages en série dans le thème Atelier (addendum §A) — « horloge à engrenage » (calendrier), « engrenage qui tourne » (en cours) et « engrenage » (membres) vont à l'encontre de FR-5 (« deux concepts n'y partagent jamais la même ») et de FR-7 (« Chaque sens a sa propre icône »). Même risque en Forêt entre « feu allumé » (en cours) et « braises de feu de camp » (XP). *Fix :* signaler ces paires à l'UX, ou remplacer « engrenage » pour les membres.

## Shape fit — strong

La forme est bonne. Une section par palier, avec des FR numérotées à la suite pour garder le découpage backlog/épics (§0). Trois UJ courtes, dont les cas limites sont pertinents (ordinateur sans le signal, vue MJ de la même fiche). Il n'y a pas de sur-formalisation. UJ-2 décrit l'écran plus qu'un parcours, mais c'est le bon outil pour faire sentir un jeu d'icônes. Le PRD part d'un produit existant et le dit (constats dans `.working/`, Stories 36.3, 45.3 et 38.3 citées). Aucun finding.

## Mechanical notes

- **Collision de glossaire « Atelier »** — le glossaire 10.4, repris explicitement (§0), définit l'**Atelier** comme « le calendrier de partie ou le calendrier du groupe : là où l'on compose un sondage ». Ici, « atelier » désigne le thème Atelier cuivre (§1 « dans l'atelier », UJ-2, addendum §A « Atelier (vapeur, cuivre) »). Écrire « thème Atelier » partout, ou noter l'homonymie au §3.
- **Noms de thèmes instables** — « Forêt ancienne » (UJ-2), mais « Forêt » partout ailleurs, et « Grimoire » / « Atelier » sans leurs noms complets (`grimoire-emeraude`, `atelier-cuivre`). Définir une fois au §3 la forme courte employée.
- **Glossaire du 10.5 non cité** — §0 et §3 ne renvoient qu'aux Paliers 10 et 10.4, alors que FR-5 (« envie », « jeux de société ») et §5 (« ludothèque, apports, envies, compteur d'hôte ») emploient des termes du PRD du 10.5. Ajouter `prds/prd-jdr-master-2026-10-28-p10-5/` au renvoi.
- **Termes d'interface non définis** — « rail » (§3, Mode déclaration ; FR-2), « rencontres » (FR-12), « Habitants », « Mes pérégrinations » (UJ-2) : ce sont des libellés existants, compréhensibles en contexte. Mettre les libellés de thème entre guillemets suffit.
- **Glossaire 10.4 rendu caduc** — la « puce ✦ » de « Liste des destinées » disparaît avec FR-8. À signaler lors de la prochaine mise à jour du glossaire.
- **IDs et renvois** — FR, UJ, SM et Q sont contigus et uniques ; les renvois internes (§4.1–§4.3, addendum §A) et externes (10.4 FR-11, FR-13, FR-14) aboutissent. `.working/extrait-themes-icones.md` existe.
- **Assumptions Index** — aller-retour complet : 16 `[ASSUMPTION]` dans le texte, toutes retrouvées au §9, et aucune entrée du §9 sans occurrence dans le texte.
- **Sections requises** — toutes présentes pour l'enjeu déclaré ; l'absence de `[NOTE FOR PM]` est acceptable, hormis le cas de la production des icônes signalé plus haut.
