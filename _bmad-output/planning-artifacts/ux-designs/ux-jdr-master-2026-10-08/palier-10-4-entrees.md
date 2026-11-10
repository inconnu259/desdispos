# Entrées pour le Palier 10.4 — Sondage et Destinée dans le calendrier

*Issu du travail UX du Palier 10 (2026-10-08). Ce n'est PAS une spec : c'est la matière à reprendre dans un PRD puis un UX dédiés du Palier 10.4. Le Palier 10 utilise en attendant le mode « composer » existant.*

## État réel (vérifié sur l'application)
- Calendrier d'une partie en MJ : colonne droite = « Aucun conseil de date en cours » + champs Du/Au + « Scruter » + liste **« Fenêtres de la destinée »** (créneaux où le groupe est dispo, calculés par l'automate), ≈ 20 cartes, ≈ 3 000 px de haut, **cartes sans aucune action**. Planche : `.working/etat-reel-calendrier-mj-fenetres-destinee.jpg`.
- Mode « composer » (barre cible + compte + Valider/Annuler, 2 créneaux minimum) : crée un vote par sélection de cases ; **non découvrable**.
- Mode ✦ **Destinée** : focus sur UN vote ouvert, état interne sans paramètre d'URL ; flèches ‹ n/N › = passer d'un VOTE à l'autre ; ne liste que les votes du mois affiché.
- Panneau « Affichage » : filtre par nature (indisponibilités, disponibilités, séances confirmées, votes en cours), **pas par partie**.
- Le mot « destinée » désigne deux choses (fenêtres de l'automate, mode de focus).

## Demandes de l'utilisateur
1. **Créneau de l'automate sélectionnable** : mis en évidence dans le calendrier, tous les autres créneaux grisés ; actions **« Ajouter au vote »** / **« Masquer »** ; un créneau ajouté **quitte** la liste de l'automate (il vit dans le vote, où on peut le **retirer**).
2. **Créer un vote en sélectionnant des jours**, comme on déclare ses dispos.
3. **Liste de l'automate repliable**, redépliable.
4. **Destinée enrichie** (décidé : **A + B**) :
   - (A) la puce ✦ ouvre une **liste groupée par partie** (nom du vote, échéance, mon état) pour choisir la destinée active ; seules les destinées des parties **actives** y figurent (plus seulement celles du mois affiché) ;
   - (B) une fois active, la **colonne de droite** devient le **plateau de la destinée** : la liste de ses **moments de vote** (options, avec comptes de oui) ; un clic recentre le calendrier ;
   - les flèches **‹ n/N ›** ne servent plus qu'à parcourir les **dates** du vote actif (raccourci) ;
   - **créer / éditer** le sondage depuis la Destinée (MJ ou hôte).
5. **Ouverture directe en Destinée** sur un sondage précis (paramètre d'URL) — utile au bouton « Voter dans le calendrier » d'une conjonction — et **filtre du calendrier par partie / groupe**.

## À trancher au démarrage du 10.4
- « Partie active » = ni close ni annulée ? Une rencontre isolée **passée** sort-elle de la liste ? `[ASSUMPTION : oui aux deux]`
- Que devient « Scruter » (Du/Au) quand la liste est repliable ?
- Mobile : tiroir en bas pour le plateau de la destinée.
- Le vote de conjonction (Palier 10) y renvoie : « Voter dans le calendrier » ouvre `/parties/:id/guild-calendar` **sans focus** tant que le 10.4 n'est pas livré.
