# Mémo — actions manuelles à ne pas oublier (master-jdr)

> Ce que **toi (humain)** dois penser à faire — des actions que Claude ne peut pas déclencher à ta place,
> ou des décisions qui t'appartiennent. **Claude te rappellera ces points aux bons moments**
> (c'est enregistré dans sa mémoire + le futur `CLAUDE.md`), mais ce doc est ton **filet de sécurité**.

## Avant de coder une feature non triviale
- [ ] **Passer en mode plan** (Maj+Tab jusqu'à « plan mode », ou demander « passe en mode plan »).
      → Claude propose l'approche et l'arborescence, tu valides **avant** qu'il touche au code.

## À la fin de chaque palier
- [ ] **`/security-review`** (revue sécurité du diff).
- [ ] **`/code-review`** (bugs + simplifications).
- [ ] Cocher les tâches faites dans **`docs/backlog.md`**.
- [ ] Vérifier que l'app tourne (**`/verify`** ou **`/run`**).

## Régulièrement (≈ hebdo)
- [ ] Relire / merger les **PR Renovate ou Dependabot** (mises à jour des dépendances).
- [ ] **`pnpm audit`** (via Docker) pour les failles connues.

## Tâches sensibles (auth, données, upload, autorisation)
- [ ] Dérouler la checklist de **`docs/security.md`** pour la couche concernée.
      (La CI couvre les types + build API et tous les tests, pas le lint ni la sécurité :
      aucun Semgrep. Revue manuelle.)

## Nouveau composant affichant des données de Partie (ou de l'utilisateur)
- [ ] **Évaluer le besoin de câblage temps réel (SSE)** : ce composant a-t-il besoin de refléter
      un changement fait par un autre membre pendant qu'il reste ouvert ? Si oui, câbler un
      `effect()` réactif sur le signal `changed`/`notifyChanged()` du service de domaine concerné.
      N'ouvrir `RealtimeService.connect()`/`disconnect()` (topic `partie:{id}` ou `user:{id}`) que
      si aucun composant ancêtre déjà monté ne le fait pour ce même topic (une connexion par
      composant routé, jamais dédupliquée entre composants — voir `RealtimeService`) : les
      composants imbriqués (ex. `ScenarioTimeline`/`SeanceList` dans une page déjà connectée) se
      contentent en général de l'`effect()`, sans ouvrir leur propre connexion.
      Cas de la fiche Homme Dragon (AD-23, story 33.8) : elle suit 0..N aventures, donc aucun canal
      `partie:` n'est ouvert ; la page ouvre `user:{id}` elle-même (`connect` / `disconnect` à la
      destruction) et `HommeDragonService.notifyChanged` est câblé sur le préfixe `user:`. Les
      écritures de fiche n'émettent rien (le client se met à jour avec la réponse) ; create, link et
      unlink émettent `partie:{id}` puis les signaux.
      Patterns établis au Palier 7 (`_bmad-output/implementation-artifacts/21-*.md`, `19-*.md`).
      ⚠️ **Ne jamais câbler un service partagé sur le préfixe générique `'partie:'`/`'user:'` dans
      `RealtimeService.handlers` si le signal ne correspond pas réellement au domaine de la
      mutation** — un handler enregistré sur ce préfixe se déclenche sur **toute** mutation
      partie-scopée (scénario, personnage, homme-dragon, poll, dispo...), pas seulement celles
      pertinentes pour ce service. Bug réel (2026-07-24) : `ModeService` (qui ne devrait réagir
      qu'à un changement d'appartenance) était câblé sur `'partie:'` générique — créer un vote sur
      n'importe quelle Partie déclenchait un refetch complet et non protégé de `playerParties`, et
      la moindre erreur réseau transitoire vidait silencieusement toute la liste des Parties du
      joueur (`.set([])` sans réparation). Avant de brancher un nouveau handler, vérifier : (1) que
      le préfixe choisi correspond au véritable scope du signal, et (2) que la méthode déclenchée a
      une garde de concurrence (compteur `seq`, cf. `OpenPollsService.refresh()`/`ModeService`) et
      ne vide jamais l'état sur un échec transitoire.

## Git
- [ ] Committer aux **jalons** (Claude ne committe que si tu le demandes ; il proposera une branche).

## Déploiement (Raspberry Pi)
- [ ] Secrets **hors git**, **Cloudflare Tunnel** actif (aucun port ouvert), build **prod**.
- [ ] OS + Docker à jour ; sauvegarde de la base.

## Nouvelle machine / autre contributeur
- [ ] Installer **Docker Desktop + WSL2** (Node **inutile**, tout est dans Docker).
- [ ] **Lancer Docker Desktop** (attendre « Engine running ») avant de bosser.
- [ ] Éditeur : VS Code + extension **Dev Containers** → « Reopen in Container ».

## Outils Claude utiles
- **Mode plan** · **`/security-review`** · **`/code-review`** · **`/verify`** · **`/run`** · **`/simplify`**
- **Context7** (doc à jour des libs)
