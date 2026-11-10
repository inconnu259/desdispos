# Addendum — Palier 10 : Soirées entre amis

Détail utile aux workflows suivants (architecture, épics), qui n'a pas sa place dans le PRD.

## 1. État vérifié du code (2026-10-08)

- `Partie` porte un unique `mjId` (`onDelete: Cascade` → supprimer le créateur supprime la partie). Le MJ n'est **pas** un `Membership` ; les joueurs le sont.
- `mjId` est lu dans treize fichiers de `apps/api/src` (`parties`, `poll`, `invitations`, `invite-links`, `scenarios`, `characters`, `homme-dragon`, `announcements`, `character-roles`, `xp-distributions`, `account`, `availability`, `party-signals`) : c'est la surface du refactor.
- `Seance` exige un `Scenario`. **Correction du 2026-10-09 (architecture)** : « sondage *ou* inscriptions, jamais les deux » (AD-4 d'origine) a été **levé dans le code pour `CAMPAGNE_EPISODIQUE`** (Story 8.8) — le vote choisit *quand*, l'inscription choisit *qui*, les deux coexistent sur la même séance ; la capacité (`inscriptionMin`/`inscriptionMax`) est réservée à l'épisodique. `lieu`, `heureRdv`, `notePratique` existent déjà sur `Seance`.
- `SessionPoll` est rattaché à la `Partie`, a un `expiresAt` (TTL par défaut) et un `choose()` côté hôte ; `PollVote` est unique par option et utilisateur.
- `Invitation` et `InviteLink` visent la `Partie` (donc déjà « le groupe », pas seulement l'événement).
- `AvailabilityDeclaration` est par utilisateur, pas par partie : les dispos sont déjà réutilisables.
- Services transverses réutilisables : `email`, `notifications`, `realtime` (SSE).

## 2. Forme du refactor — tranchée en architecture (2026-10-09)

Les pistes initiales (un champ `mode`, une table de rôles, `mjId` gardé pour le JDR) ont été **remplacées** par les décisions du spine `architecture/architecture-jdr-master-2026-10-08/ARCHITECTURE-SPINE.md` :
- **Pas de champ `mode`** : le ralliement est un **système** du registre ; le mode se déduit de la famille (AD-2).
- `mjId` devient **`ownerId`** (le créateur), aussi sur l'événement, dont il est l'hôte (AD-5).
- L'**événement** est la base, le **scénario** son extension JDR, avec le même identifiant (AD-3) ; une séance est une **plage continue** (AD-4).
- Un **service de permission** unique, politique par famille et forme (AD-6) ; admins = **rôle sur l'appartenance** (AD-7).
- La porte : tests de caractérisation d'abord, à comportement constant (AD-16).

## 3. Points faibles du forge — où ils sont traités

| # | Point faible | Traité en |
|---|---|---|
| 1 | `mjId` en cascade, pas de transfert d'admin | FR-5, FR-7 (admins multiples, avertissement, suppression du groupe si dernier admin) |
| 2 | Matrice des permissions non écrite | FR-13 (matrice mode soirée) |
| 3 | Retrait d'un membre | FR-6 |
| 4 | Qui vote | FR-11 |
| 5 | Migration | FR-1, FR-14 |
| 6 | E-mails et rappels | FR-12 |

## 4. Décisions écartées (rationale)

- **Sondage + places attribuées après coup (cas A)** : n'arrivera pas ; évite un cycle de vie à deux phases d'attribution.
- **Rôle de MJ tournant** : aucun besoin ; l'hôte par événement suffit.
- **Ajout en parallèle sans toucher à l'existant** : écarté au profit du refactor, parce que le cœur doit porter d'autres systèmes de JDR et peut-être une variante de soirée.
- **Liste d'attente** : écartée par l'utilisateur (premier arrivé, premier servi).
- **Doodle** : gratuit limité à 10 choix, pas de sondage long, dates à saisir à la main, aucune extension possible ; les dispos persistantes sont déjà dans l'application.

## 5. Axes à ne pas confondre

*Révisé le 2026-10-09 (architecture, décision de l'utilisateur)* : le forge distinguait le **mode** et le **système** comme deux axes. Ils sont désormais **unifiés dans un registre** : chaque système déclare une **famille** (ralliement ou JDR) et des **capacités** ; le mode est la famille. Restent distincts : le système (et sa famille) d'une part, la **forme** de la partie (`kind` : isolée, campagne linéaire, groupe épisodique) d'autre part.
