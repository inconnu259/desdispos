# Assets Ryuutama

Ce dossier attend, gitignoré (contenu sous droits d'auteur — fiche officielle éditée par
l'éditeur du jeu, cf. NFR4-équivalent Story 4.4), le fichier PDF source utilisé pour
l'export de fiche de personnage (`GET /characters/:id/export.pdf`) :

```
apps/api/game-systems/ryuutama/assets/
  Ryuutama_fiche_de_voyageur_big_edit.pdf
```

## Ryuutama_fiche_de_voyageur_big_edit.pdf

Fiche de voyageur officielle (2 pages), seule version des 3 fournies par l'éditeur à
posséder de vrais champs de formulaire AcroForm remplissables par nom de champ
(`pdf-lib`). Les deux autres versions (`Ryuutama_voyageur.pdf` 1 page paysage et
`Ryuutama_voyageur_big.pdf` 2 pages) sont purement visuelles, sans champ — non utilisées
ce palier.

Sans ce fichier, `GET /characters/:id/export.pdf` échoue avec une erreur explicite
pointant vers ce README (voir `RyuutamaPdfService`).

Le mapping champ métier → nom de champ AcroForm est documenté et testé dans
`packages/game-rules/src/ryuutama/pdf-field-map.ts`.

## Ryuutama-fiche_equipement_edit.pdf (Story 11.1)

Fiche d'équipement officielle (1 page, 94 champs AcroForm, tous `PDFTextField`), utilisée pour
l'export `GET /characters/:id/export-equipment.pdf`. Sans ce fichier, l'export échoue avec une
erreur explicite pointant vers ce README (voir `EquipmentPdfService`).

Le mapping champ métier → nom de champ AcroForm est documenté et testé dans
`packages/game-rules/src/ryuutama/equipment-pdf-field-map.ts`. Le template propose 21
emplacements Objet/Prix/Enc/Effets pour l'équipement individuel (Effets limité aux 5 premiers,
limite physique du template), plus des blocs « Contenant » et « Animal » (3 emplacements chacun,
Objet/Prix/Enc/Effets pour Contenant, Objet/Prix/Effets — pas d'Enc — pour Animal, cf. Story
14.3) désormais alimentés depuis `RyuutamaSheetData.equipment.{contenants,animaux}`. Seul le
champ « Po » (monnaie) n'a aucune donnée correspondante dans le modèle actuel et reste
volontairement vide (hors scope PRD §4.2).

## Ryuutama_fiche_de_notes_edit.pdf (Story 11.2)

Fiche de notes officielle (1 page, 42 champs AcroForm, tous `PDFTextField`), utilisée pour
l'export `GET /characters/:id/export-notes.pdf`. Sans ce fichier, l'export échoue avec une
erreur explicite pointant vers ce README (voir `NotesPdfService`).

Le mapping champ métier → nom de champ AcroForm est documenté et testé dans
`packages/game-rules/src/ryuutama/notes-pdf-field-map.ts`. Contrairement aux 3 autres templates
PDF déjà exploités dans ce projet, celui-ci **n'a aucun champ d'en-tête** (`joueur`/`voyageur`
absents) — uniquement 21 lignes `Note.{0..20}.{0|1}` (colonne `.0` = date, colonne `.1` = texte
de l'entrée). Au-delà de 21 notes, les entrées excédentaires sont omises silencieusement (limite
physique du template).

## Zone du portrait (Story 4.6)

Le portrait du personnage (s'il existe) est dessiné directement sur la page 1 — ce n'est
**pas** un champ AcroForm (aucun champ de type image sur ce template), donc pas de nom de
champ à mapper : positionnement en dur par coordonnées dans
`apps/api/src/characters/ryuutama-pdf.service.ts` (constantes `PORTRAIT_X/Y/WIDTH/HEIGHT`).

Page 1 : 595.276 × 841.89 pt (A4 portrait). Coordonnées (origine bas-gauche, comme pdf-lib) :

| Constante | Valeur | Repère utilisé |
|---|---|---|
| `PORTRAIT_X` | 451 | aligné sur le bord gauche du champ `Joueur` (x:450.96) |
| `PORTRAIT_Y` | 662 | juste au-dessus des champs `créé le`/`Homme dragon` (y:641.93, hauteur 15.7) |
| `PORTRAIT_WIDTH` | 90 | largeur du champ `Joueur` |
| `PORTRAIT_HEIGHT` | 110 | ratio portrait (plus haut que large), rentre sous le titre (marge ~70pt en haut de page) |

Ces valeurs ont été déduites des coordonnées des champs AcroForm voisins (mesurées via
`page.getRectangle()` de pdf-lib) — **pas vérifiées par un rendu visuel du PDF final**
(aucun visualiseur PDF disponible à l'implémentation). Vérifiées fonctionnellement : l'image
s'intègre bien sur la page (XObject `/Image` présent dans les ressources), mais son
positionnement exact par rapport au titre/logo imprimé n'a pas été confirmé à l'œil. **Si un
décalage est constaté à l'usage, ajuster ces 4 constantes** dans `ryuutama-pdf.service.ts`
plutôt que de redécouvrir ces repères depuis zéro.

## Ryuutama_fiche_homme-dragon_big_edit.pdf — souffles et pages ajoutées (Story 33.4)

Export `GET /homme-dragons/:id/export.pdf?format=editable|2pages` — **réservé au propriétaire de l'Homme Dragon** (`404` pour tout autre, fiche absente ou étrangère : la fiche porte la réserve de souffles, que les joueurs ne voient jamais ; AD-23) (`format` obligatoire, comme
l'export joueur ; `2pages` aplatit le formulaire avec `form.flatten()`). Champs de souffle du
gabarit :

| Champ | Contenu |
|---|---|
| `souffle_max` | Points de Souffle max (`derived.PS`) |
| `souffle_actuel` | **Vide** — case à remplir au stylo : l'application ne suit aucune consommation (épic 33) |
| `nombre_souffles` | « Nombre Max : » de la réserve = `max(niveau − 1, 0)` (pas les PS) |
| `souffle_1`..`souffle_4` | Les 4 cases de la réserve (Story 33.6) : le **nom du souffle** (sans son coût) de l'emplacement de même numéro de `sheetData.reserve`, lu des catalogues `souffle` + `souffleRituel` (repli sur la clé brute si le souffle a quitté le catalogue) ; case **vide** si l'emplacement ou la réserve est vide. Aucun décompte : rien n'indique « utilisé » ni « restant » |

Le gabarit ne peut pas contenir la liste des souffles : une ou plusieurs pages « Souffles de mon
dragon » (A4 portrait, polices standard Helvetica, dessinées côté serveur dans
`apps/api/src/homme-dragon/homme-dragon-souffles-pages.ts`) sont **ajoutées après** le gabarit,
identiques dans les deux formats. Elles listent, lus du catalogue `souffle` uniquement (jamais des
pouvoirs d'éveil, qui restent dans leur section du gabarit) : les souffles communs par famille, ceux
de la race du dragon et, dès le niveau 3, ceux des autres races (« souffles multicolores »), chacun
avec son coût en PS, la mention « ne peut pas être mis en réserve » le cas échéant et son effet. La
règle de disponibilité est la fonction pure `availableSouffles()` (`packages/game-rules`). Catalogue
`souffle` vide : aucune page ajoutée.

Tout texte est assaini pour l'encodage WinAnsi (police standard de pdf-lib) : un glyphe non
encodable est remplacé par `?`, jamais une erreur d'export. Les voyageurs protégés sont tous
imprimés, répartis dans l'ordre sur les deux zones multilignes `voyageurs_proteges_1/2`.

Taille de police : tous les champs texte du gabarit sont ramenés à 10,5 pt (entre les 12 pt du
gabarit et les 9 pt d'« Apparence - Caractère »), remplis ou non, pour que inscription, scénario et
date ne débordent pas ; `apparence_caractere`, `voyageurs_proteges_*` et `voy_sc_*`, déjà plus
petits, gardent leur taille. `nombre_souffles` n'a aucun `/DA` dans le gabarit : le service lui en
donne un explicite (`/Helv 10.5 Tf`).
