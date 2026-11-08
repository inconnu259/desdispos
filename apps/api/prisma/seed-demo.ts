import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import { RYUUTAMA_ID } from '../src/game-systems/supported-game-systems';
import { writeDocumentFile } from '../src/scenarios/document-storage.util';
import type { HommeDragonSheetData } from '@master-jdr/game-rules';

// `@master-jdr/game-rules` est un package ESM — `ts-node` (CJS, ce script) ne peut pas le
// `require()` (cf. package.json `"type": "module"` du package). Les stats dérivées sont donc
// recalculées ici avec la même formule que `computeDerived()` (packages/game-rules), plutôt que
// de modifier la configuration ESM/CJS du monorepo pour un script de seed de dev.
//
// ⚠️ Cette copie avait divergé : elle ignorait `levelUps` (allocations PV/PE et encombrement),
// donc tout personnage monté de niveau se retrouvait avec des dérivées fausses. Elle est
// réalignée sur `packages/game-rules/src/ryuutama/compute-derived.ts` — à resynchroniser si la
// formule bouge là-bas.
interface RyuutamaAttributes {
  AGI: number;
  ESP: number;
  INT: number;
  VIG: number;
}
interface InventoryItem {
  id: string;
  name: string;
  weight: number;
  price?: string;
  effect?: string;
  addedBy: 'player' | 'mj';
}
interface LevelUpEntry {
  level: number;
  pvAllocated: number;
  peAllocated: number;
  capabilities: { type: string; params: Record<string, unknown> }[];
}
interface RyuutamaSheetData {
  classId: string;
  specialtyTypeId?: string;
  typeId: string;
  attributes: RyuutamaAttributes;
  weaponId: string;
  // Modèle d'inventaire unifié (Story 14.1) — individual/contenants/animaux, plus de `group`.
  equipment?: {
    individual: InventoryItem[];
    contenants: InventoryItem[];
    animaux: Omit<InventoryItem, 'weight'>[];
  };
  narrative?: { name?: string; motivation?: string; personality?: string };
  levelUps?: LevelUpEntry[];
  // Type Magie (Règle 7 de `validate.ts`) : une saison d'affinité du catalogue `season` ET
  // exactement 2 sorts rituels débutants distincts du catalogue `spell`.
  magicSeason?: string;
  knownRitualSpells?: string[];
}
interface MagicChoice {
  magicSeason: string;
  knownRitualSpells: string[];
}
function computeDerived(sheetData: RyuutamaSheetData) {
  const { AGI, ESP, INT, VIG } = sheetData.attributes;
  const levelUps = sheetData.levelUps ?? [];
  const pvAllocated = levelUps.reduce((sum, entry) => sum + entry.pvAllocated, 0);
  const peAllocated = levelUps.reduce((sum, entry) => sum + entry.peAllocated, 0);
  return {
    PV: VIG * 2 + pvAllocated,
    PE: ESP * 2 + peAllocated,
    Condition: VIG + ESP,
    Initiative: AGI + INT,
    Encombrement: VIG + 3 + levelUps.length,
  };
}

/**
 * Seed de données de démo pour le développement local — PAS destiné à la production (aucun appel
 * depuis `prisma.config.ts` `migrations.seed`, contrairement à `seed.ts` qui reste le seul seed
 * automatique).
 *
 * ─── Remise à zéro COMPLÈTE : la séquence, dans cet ordre ───
 *   1. `docker compose exec api pnpm exec prisma migrate reset --force` (base vide) ;
 *   2. `docker compose exec api pnpm seed` — crée le compte admin (identifiants de `.env`).
 *      Prisma 7 ne lance PLUS le seed après `migrate reset` : il faut le lancer à la main ;
 *   3. `docker compose restart api`, puis attendre « Nest application successfully started »
 *      dans les logs : c'est le DÉMARRAGE de l'API (`GameSystemService.onApplicationBootstrap`)
 *      qui crée la ligne `GameSystem` « ryuutama » et son contenu — ce script n'en crée jamais ;
 *   4. `docker compose exec api pnpm seed:demo`.
 * Lancé avant l'étape 3, le script le détecte et abandonne AVANT d'écrire quoi que ce soit
 * (`verifierPrerequis()`) : sans cela, `HommeDragon.gameSystemId` et `Character.gameSystemId`
 * (FK vers `GameSystem`) échoueraient en P2003 en laissant un état partiel qui bloquerait aussi
 * la relance. Non idempotent — si les comptes de démo existent déjà, le script s'arrête sans
 * rien modifier (cf. `main()`), pour éviter des doublons/erreurs de contrainte unique sur une
 * base partiellement peuplée.
 *
 * ─── Toutes les dates sont RELATIVES au moment de l'exécution ───
 * Aucune date en dur : `NOW` est capturé au démarrage et tout se positionne par décalage en jours
 * (`at()`/`day()`). Un scénario `PASSE` est donc toujours dans le passé, un vote `OPEN` a toujours
 * des options futures, un lien expiré est toujours expiré — quelle que soit la date à laquelle on
 * rejoue ce seed. C'est ce qui manquait : les dates figées de mi-2026 rendaient le vote « ouvert »
 * expiré et ses options révolues, donc l'écran de vote intestable.
 *
 * ─── Ce que couvre le jeu de données ───
 * 9 comptes aux préférences volontairement toutes différentes (thème, tris, modes d'affichage,
 * masquage des parties terminées, rappel « Dispos à déclarer ») pour qu'aucun réglage ne reste à sa
 * valeur par défaut — dont 2 comptes « mode soirée seulement » (Gaspard, Hélène).
 *
 * Mode soirée (famille `ralliement`, paliers 10 à 10.5) : deux groupes et cinq rencontres isolées.
 * · « Les Joueurs du Jeudi » (Bob, Alice co-admin, MaitreJeu simple membre) : trois conjonctions
 *   passées (compteur « Qui reçoit »), une à venir à places limitées avec place réservée en attente,
 *   jeux apportés (doublon ×2), jeu écarté par l'hôte et Envies, une conjonction COMPLÈTE en plage de
 *   2 créneaux, un sondage « tous les membres » à réponses partielles dont l'échéance est DEMAIN
 *   (relance de la veille), un week-end en plage longue (6 créneaux) et une conjonction annulée ;
 *   invitation en attente (Hélène) et lien d'invitation ouvert.
 * · « Ludo du Quartier » (Gaspard) : aucun événement.
 * · Rencontres isolées : à venir avec jeux apportés, sondage ouvert, « à dater » (ni date ni
 *   sondage, invitation en attente), terminée et retirée de sa liste par Alice, annulée.
 * · Ludothèques : six comptes, doublons entre personnes, noms accentués, un jeu sans champ
 *   facultatif ; Faustine et Hélène sans aucun jeu.
 * Toutes les `nextSession*` sont recalculées en fin de script (`recalculerProchaineSeance`).
 *
 * JDR — huit Parties : une ONE_SHOT clôturée, une CAMPAGNE_LINEAIRE en cours, une CAMPAGNE_EPISODIQUE, une
 * seconde CAMPAGNE_LINEAIRE déjà bien avancée (« Les Annales de Brume », onze scénarios joués) et
 * quatre MJ'd par Diane (compte mixte MJ + joueuse) : une jamais commencée, une ONE_SHOT dont la
 * séance tombe dans moins de 24 h (rappel e-mail), une ONE_SHOT SANS aucun membre et une
 * campagne sur un système sans module (Draconis, état hérité — voir plus bas).
 *
 * Chaque feature a de la donnée à afficher : disponibilités récurrentes/ponctuelles + une archivée
 * (créneaux matin, après-midi, soir et journée entière), couches de calendrier personnalisées (et
 * un compte qui n'y a jamais touché), deux votes de date ouverts en parallèle **avec des
 * bulletins** (réponses partielles, un membre qui n'a pas voté) et un vote OUVERT dont
 * l'expiration est passée, scénarios aux quatre statuts (tous avec au moins une séance), séances
 * avec infos pratiques (heure/lieu/note), prochaine séance matérialisée sur la Partie
 * (`nextSessionDate`/`nextSessionSlot`), inscriptions, journal de personnage
 * (associations manuelle et automatique), distributions d'XP cohérentes avec `Character.xp`, un
 * personnage monté de niveau avec ses instantanés et un autre en attente de montée, fiches de type
 * Magie valides (saison + deux sorts rituels), documents de scénario et de bibliothèque, annonces
 * MJ avec accusés de lecture (Partie et scénario), rôles de groupe, favoris, cadenas de
 * visibilité, invitations nominatives dans leurs quatre statuts, liens d'invitation dans leurs
 * états (dont un révoqué) et jetons de réinitialisation de mot de passe / changement d'e-mail.
 *
 * ─── Hommes Dragons : un par état du modèle « un Homme Dragon, plusieurs aventures » (AD-23) ───
 * Un Homme Dragon n'est plus rattaché à UNE partie : le lien vit sur `Partie.hommeDragonId`. Les
 * trois fiches sont donc créées AVANT les parties, sans `partieId`, puis liées à la création de
 * chaque partie. Niveau = scénarios `PASSE` cumulés sur toutes les aventures (seuils 1/3/7/12
 * scénarios → niveaux 2/3/4/5, cf. `packages/game-rules/src/ryuutama/homme-dragon-derived.ts`).
 * · Suisen (DRAGON_VERT, MJ `MaitreJeu`) : « Le Naufrage de l'Aurore » (clôturée) ET « Chroniques de la
 *   Guilde » → 1 + 1 = 2 scénarios `PASSE` → niveau 2, éveil du niveau 2 EN ATTENTE (aucun
 *   `eveilPowers`), réserve d'un emplacement (['route']), voyageurs partagés (Alice, Bob) entre
 *   ses deux aventures.
 * · Kaien (DRAGON_BLEU, MJ `MaitreJeu`) : « La Route des Lanternes » ET « Les Annales de Brume » → 1 + 11
 *   = 12 scénarios `PASSE` → niveau 5 ATTEINT PAR CUMUL (aucune aventure seule n'y arrive), PS 10 ;
 *   éveils des niveaux 2, 3 et 4 choisis (le 5 en attente), artefact cadeau (race ≠ bleu), réserve
 *   de 4 emplacements dont un souffle d'une autre race sur un seul emplacement et un rituel.
 * · Braise (DRAGON_ROUGE, MJ `MaitreJeu`) : AUCUNE aventure (état atteignable par dissociation ou
 *   suppression de partie) → niveau 1, aucune réserve ; cible des tests d'association.
 * · Aucun Homme Dragon pour Diane : ses parties Ryuutama (« Les Veilleurs du Pont », « La Marée du
 *   Lendemain », « La Veillée des Absents ») gardent le signal HOMME_DRAGON_A_CREER et l'entrée
 *   « Créer un Homme Dragon pour… » de « Personnages ».
 * Les valeurs de niveau et de réserve ci-dessus sont écrites en dur (voir plus bas) : ce script est
 * CJS et ne peut pas importer `@master-jdr/game-rules` (ESM) — à resynchroniser avec les règles
 * (`homme-dragon-derived.ts`, `homme-dragon-reserve.ts`) si elles bougent.
 *
 * Cas de test documenté : dissocier « Les Annales de Brume » de Kaien ramène son niveau de 5 à 2
 * (1 scénario `PASSE` restant) SANS rien purger — réserve de 4 emplacements, éveils des niveaux 3
 * et 4 et artefact cadeau persistent au-dessus du niveau, lisibles, seuls les nouveaux choix sont
 * refusés (retirer un souffle reste permis). Dissocier aussi « La Route des Lanternes » le ramène à
 * 1. Les niveaux 3 et 4 ne sont pas figés par le seed mais se reproduisent par dissociation.
 *
 * ─── Cas limites délibérés ───
 * · une séance A_VENIR dont `inscriptionMax` est atteint (fermée) et une autre avec de la place ;
 * · un membre d'une Partie sans aucun personnage (état de départ réel) ;
 * · un compte `mustResetPassword` (parcours de réinitialisation imposée) ;
 * · un lien d'invitation valide, un à usage unique déjà consommé, un expiré, un révoqué, un ciblé
 *   par e-mail ;
 * · une Partie sans aucun membre (signal AUCUN_MEMBRE_INVITE) ;
 * · une Partie sur un système SANS module de création de personnage (« Les Cendres de Nacre »,
 *   Draconis). ⚠ Ce n'est PAS un état créable via l'API : `PartiesService.create()` refuse tout
 *   système fermé à la création (story 29.17, `isOpenForCreation()` depuis la story 37.5). Il
 *   est semé directement en base pour représenter une partie héritée d'avant cette règle (AC3 de la story : consultable et
 *   modifiable sans changer de système, aucun signal PERSONNAGE_A_CREER). Sans ligne
 *   `GameSystem` « draconis » : `Partie.gameSystemId` est un simple texte, sans FK ;
 * · une prochaine séance à moins de 24 h (rappel e-mail, visible dans Mailpit au prochain passage
 *   du cron horaire de `NotificationsService`) et un vote OUVERT dont l'expiration est passée.
 *
 * Écarts connus, non comblés ici :
 * · le contenu Ryuutama enrichi des Epics 23-26 (profils d'attributs, armes libres,
 *   équipement de départ) n'a pas de scénario de seed dédié — les fiches restent sur la forme
 *   minimale classe/type/attributs/arme (seule la magie des types Magie est renseignée) ;
 * · aucune couverture de Partie ni aucun portrait de personnage : ce sont des fichiers à écrire
 *   dans `uploads/`, que ce script n'écrit pas ;
 * · aucune fenêtre de l'automate masquée (`SlotWindowHidden`, Story 46.4) : sa clé doit recopier
 *   une fenêtre réellement servie par l'automate, que ce script ne calcule pas — à tester à la main ;
 * · aucun Homme Dragon n'a d'avatar : il suppose un fichier téléversé, que ce script n'écrit pas ;
 * · les niveaux 3 et 4 d'un Homme Dragon ne sont pas figés (voir ci-dessus : reproductibles par
 *   dissociation).
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL manquant');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEMO_PASSWORD = '12345Demo';

/** Système sans module de création de personnage (cf. `GAME_SYSTEMS` de `@master-jdr/shared`).
 *  Littéral local : ce script CJS n'importe pas les valeurs runtime du package partagé (ESM). */
const DRACONIS_ID = 'draconis';

/** Origine du front pour les liens affichés — première origine de `WEB_ORIGIN` (liste CORS). */
const WEB_ORIGIN = (process.env.WEB_ORIGIN ?? 'http://localhost:4200').split(',')[0].trim();

// ─────────────────────────────────────────────────────────────────────────────
// Horloge relative
// ─────────────────────────────────────────────────────────────────────────────

/** Capturé une seule fois : toutes les dates du seed sont cohérentes entre elles. */
const NOW = new Date();

/** Jour J+`dayOffset` à `hour`:00:00 UTC. Négatif = passé. */
function at(dayOffset: number, hour = 14): Date {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

/** Jour J+`dayOffset` à minuit UTC — pour les dates à granularité jour (options de vote, dispos). */
function day(dayOffset: number): Date {
  return at(dayOffset, 0);
}

// ─────────────────────────────────────────────────────────────────────────────

const ATTRIBUTE_SETS: RyuutamaSheetData['attributes'][] = [
  { AGI: 6, ESP: 6, INT: 4, VIG: 8 },
  { AGI: 4, ESP: 8, INT: 6, VIG: 6 },
  { AGI: 8, ESP: 4, INT: 6, VIG: 6 },
];

function makeSheetData(
  name: string,
  classId: string,
  typeId: string,
  weaponId: string,
  attributeSet: number,
  specialtyTypeId?: string,
  equipment?: RyuutamaSheetData['equipment'],
  levelUps?: LevelUpEntry[],
  magic?: MagicChoice,
): RyuutamaSheetData {
  return {
    classId,
    typeId,
    weaponId,
    attributes: ATTRIBUTE_SETS[attributeSet],
    equipment: equipment ?? { individual: [], contenants: [], animaux: [] },
    narrative: { name },
    ...(specialtyTypeId ? { specialtyTypeId } : {}),
    ...(levelUps ? { levelUps } : {}),
    ...magic,
  };
}

/** Préférences d'affichage — variées d'un compte à l'autre pour ne laisser aucun défaut inexploré. */
interface UserPrefs {
  theme?: string | null;
  partiesSort?: string;
  hideFinishedParties?: boolean;
  partiesViewMode?: string;
  charactersViewMode?: string;
  charactersSort?: string;
  mustResetPassword?: boolean;
  calendarLayersSetAt?: Date | null;
  availabilityReminder?: boolean;
}

/**
 * Secret + hash d'un jeton à usage unique, comme `AuthService` : le secret (aléatoire, base64url)
 * n'est JAMAIS stocké, seul son hash argon2 va en base ; le lien affiché est `<id>.<secret>`.
 */
async function createTokenSecret() {
  const secret = randomBytes(32).toString('base64url');
  return { secret, tokenHash: await argon2.hash(secret) };
}

/**
 * Story 37.3 — un scénario est l'extension JDR d'un `Event` (même identifiant) : l'événement porte
 * `partieId`, `title`, `description` ; son propriétaire est celui de la partie. Même forme d'appel
 * que l'ancien `prisma.scenario.create({ data })`, pour garder le seed lisible.
 */
async function createScenario(args: {
  data: { partieId: string; title: string; description?: string } & Omit<
    Prisma.ScenarioCreateWithoutEventInput,
    'id'
  >;
}): Promise<{ id: string }> {
  const { partieId, title, description, ...extension } = args.data;
  const partie = await prisma.partie.findUniqueOrThrow({
    where: { id: partieId },
    select: { ownerId: true },
  });
  const event = await prisma.event.create({
    data: {
      partieId,
      title,
      description: description ?? null,
      ownerId: partie.ownerId,
      scenario: { create: extension },
    },
  });
  return { id: event.id };
}

async function createUser(email: string, pseudo: string, prefs: UserPrefs = {}) {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  return prisma.user.create({
    data: { email, pseudo, passwordHash, displayName: pseudo, ...prefs },
  });
}

async function createCharacter(
  userId: string,
  partieId: string,
  sheetData: RyuutamaSheetData,
  journalAutoAssociate = false,
  xp = 0,
) {
  const derived = computeDerived(sheetData);
  return prisma.character.create({
    data: {
      userId,
      partieId,
      gameSystemId: RYUUTAMA_ID,
      sheetData: sheetData as unknown as Prisma.InputJsonValue,
      derived,
      journalAutoAssociate,
      xp,
    },
  });
}

/**
 * Crée un Homme Dragon SANS aucune partie (AD-23) : le lien est posé ensuite, par
 * `Partie.hommeDragonId`, à la création de chaque aventure.
 */
async function createHommeDragon(userId: string, sheetData: HommeDragonSheetData) {
  return prisma.hommeDragon.create({
    data: {
      userId,
      gameSystemId: RYUUTAMA_ID,
      sheetData: sheetData as unknown as Prisma.InputJsonObject,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Copies locales de règles de `@master-jdr/shared` (package ESM, non importable par ce script CJS)
// — à resynchroniser si elles bougent là-bas.
// ─────────────────────────────────────────────────────────────────────────────

type Slot = 'MORNING' | 'AFTERNOON' | 'EVENING';
const SLOT_CHAIN: readonly Slot[] = ['MORNING', 'AFTERNOON', 'EVENING'];

/** Copie de `spanEnd()` (Story 47.1) : fin d'une plage de `durationSlots` créneaux enchaînés
 *  (`MORNING → AFTERNOON → EVENING → MORNING` du lendemain), départ compris. */
function spanEnd(start: Date, slot: Slot, durationSlots: number): { endDate: Date; endSlot: Slot } {
  const index = SLOT_CHAIN.indexOf(slot) + durationSlots - 1;
  const endDate = new Date(start);
  endDate.setUTCDate(endDate.getUTCDate() + Math.floor(index / SLOT_CHAIN.length));
  return { endDate, endSlot: SLOT_CHAIN[index % SLOT_CHAIN.length] };
}

/** Champs de plage d'une séance datée : début, fin calculée, durée. */
function plage(start: Date, slot: Slot, durationSlots = 1) {
  return {
    startDate: start,
    startSlot: slot,
    ...spanEnd(start, slot, durationSlots),
    durationSlots,
  };
}

/** Copie de `boardGameNameKey()` (Story 48.1) : clé normalisée d'un nom de jeu. */
function boardGameNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\p{Cf}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Premier jour J+n (n ≥ `fromOffset`) qui tombe un `weekday` (0 = dimanche … 6 = samedi). */
function nextWeekdayOffset(weekday: number, fromOffset: number): number {
  let offset = fromOffset;
  while (day(offset).getUTCDay() !== weekday) offset++;
  return offset;
}

/**
 * Miroir de `EventsService.recomputeNextSession()` (Story 37.8 / 47.2) : `nextSession*` d'une partie =
 * la séance visible la plus proche dont la FIN n'est pas passée — brouillons cachés et événements
 * annulés exclus. Appelé pour chaque partie à la fin du seed : aucune valeur posée à la main.
 */
async function recalculerProchaineSeance(partieId: string): Promise<void> {
  const seances = await prisma.seance.findMany({
    where: {
      AND: [
        { event: { partieId, cancelledAt: null } },
        {
          NOT: {
            event: {
              scenario: {
                is: { status: 'BROUILLON', event: { partie: { kind: { not: 'ONE_SHOT' } } } },
              },
            },
          },
        },
      ],
    },
    select: { startDate: true, startSlot: true, endDate: true, endSlot: true },
  });
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const nearest =
    seances
      .filter((s) => s.startDate !== null)
      .map((s) => ({
        date: s.startDate!,
        slot: s.startSlot ?? null,
        end: s.endDate ?? s.startDate!,
        endSlot: s.endDate ? (s.endSlot ?? null) : (s.startSlot ?? null),
      }))
      .filter((c) => c.end.getTime() >= startOfToday.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;
  await prisma.partie.update({
    where: { id: partieId },
    data: {
      nextSessionDate: nearest?.date ?? null,
      nextSessionSlot: nearest?.slot ?? null,
      nextSessionEndDate: nearest?.end ?? null,
      nextSessionEndSlot: nearest?.endSlot ?? null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode soirée (famille `ralliement`) et Ludothèque
// ─────────────────────────────────────────────────────────────────────────────

/** Identifiant du système de la famille `ralliement` (registre `GAME_SYSTEMS`, sans ligne `GameSystem`). */
const RALLIEMENT_ID = 'ralliement';

/**
 * Crée un ralliement comme `PartiesService.create()` : le créateur est propriétaire ET membre `ADMIN` ;
 * les autres membres sont `MEMBER` sauf ceux listés dans `admins` (admins multiples, épic 39). Une
 * rencontre isolée (`ONE_SHOT`) reçoit son événement unique (titre = nom de la partie, hôte = créateur)
 * et une séance non datée, SANS `Scenario` ; un groupe (`CAMPAGNE_EPISODIQUE`) n'a aucun événement.
 */
async function createRalliement(args: {
  name: string;
  kind: 'ONE_SHOT' | 'CAMPAGNE_EPISODIQUE';
  description?: string;
  ownerId: string;
  members: string[];
  admins?: string[];
  createdAt: Date;
}): Promise<{ partieId: string; eventId: string | null; seanceId: string | null }> {
  const partie = await prisma.partie.create({
    data: {
      name: args.name,
      kind: args.kind,
      gameSystemId: RALLIEMENT_ID,
      description: args.description ?? null,
      ownerId: args.ownerId,
      createdAt: args.createdAt,
    },
  });
  const admins = new Set(args.admins ?? []);
  await prisma.membership.createMany({
    data: [
      { userId: args.ownerId, partieId: partie.id, role: 'ADMIN', joinedAt: args.createdAt },
      ...args.members.map((userId, i) => ({
        userId,
        partieId: partie.id,
        role: admins.has(userId) ? ('ADMIN' as const) : ('MEMBER' as const),
        joinedAt: new Date(args.createdAt.getTime() + (i + 1) * 3_600_000),
      })),
    ],
  });
  if (args.kind !== 'ONE_SHOT') return { partieId: partie.id, eventId: null, seanceId: null };
  const event = await prisma.event.create({
    data: {
      partieId: partie.id,
      title: args.name,
      ownerId: args.ownerId,
      createdAt: args.createdAt,
      seances: { create: {} },
    },
    include: { seances: true },
  });
  return { partieId: partie.id, eventId: event.id, seanceId: event.seances[0].id };
}

/** Sondage de dates d'un événement de ralliement, écrit comme `PollService.createInTx` : ouvert,
 *  échéance à la fin du jour `deadlineOffset` (UTC), au moins deux créneaux. Renvoie les options
 *  dans l'ordre fourni. */
async function createGroupPoll(
  partieId: string,
  hostId: string,
  options: { offset: number; slot: Slot }[],
  deadlineOffset: number,
) {
  const poll = await prisma.sessionPoll.create({
    data: {
      partieId,
      createdById: hostId,
      status: 'OPEN',
      expiresAt: new Date(day(deadlineOffset + 1).getTime() - 1),
      createdAt: at(-3, 10),
    },
  });
  const created: { id: string }[] = [];
  for (const o of options) {
    created.push(
      await prisma.pollOption.create({
        data: { pollId: poll.id, date: day(o.offset), slot: o.slot },
      }),
    );
  }
  return { poll, options: created };
}

/**
 * Conjonction d'un groupe (épic 40) écrite comme `EventsService.createInTx` : l'hôte est le
 * propriétaire de l'événement (il occupe une place SANS ligne d'inscription), `capacity` null =
 * « Tous les membres ». Soit `date` (date fixée, plage de `durationSlots` créneaux), soit `poll`
 * (sondage : séance sans date). Les inscriptions sont `CONFIRMED`, `reserved` sont `RESERVED`.
 */
async function createConjonction(args: {
  partieId: string;
  hostId: string;
  title: string;
  date?: { offset: number; slot: Slot };
  durationSlots?: number;
  pollId?: string;
  capacity?: number | null;
  lieu?: string;
  heureRdv?: string;
  notePratique?: string;
  confirmed?: string[];
  reserved?: string[];
  createdAt: Date;
  cancelledAt?: Date;
}): Promise<{ eventId: string; seanceId: string }> {
  const durationSlots = args.durationSlots ?? 1;
  const event = await prisma.event.create({
    data: {
      partieId: args.partieId,
      title: args.title,
      ownerId: args.hostId,
      createdAt: args.createdAt,
      cancelledAt: args.cancelledAt ?? null,
    },
  });
  const seance = await prisma.seance.create({
    data: {
      eventId: event.id,
      ...(args.pollId ? { pollId: args.pollId } : {}),
      ...(args.date
        ? plage(day(args.date.offset), args.date.slot, durationSlots)
        : { durationSlots }),
      inscriptionMax: args.capacity ?? null,
      lieu: args.lieu ?? null,
      heureRdv: args.heureRdv ?? null,
      notePratique: args.notePratique ?? null,
      createdAt: args.createdAt,
    },
  });
  const rows = [
    ...(args.confirmed ?? []).map((userId) => ({ userId, status: 'CONFIRMED' as const })),
    ...(args.reserved ?? []).map((userId) => ({ userId, status: 'RESERVED' as const })),
  ];
  if (rows.length > 0) {
    await prisma.inscription.createMany({
      data: rows.map((r, i) => ({
        seanceId: seance.id,
        userId: r.userId,
        status: r.status,
        createdAt: new Date(args.createdAt.getTime() + (i + 1) * 60_000),
      })),
    });
  }
  return { eventId: event.id, seanceId: seance.id };
}

/** Ludothèque d'une personne (Story 48.1) : renvoie les jeux par nom, pour les apports et écarts. */
async function createLudotheque(
  ownerId: string,
  games: { name: string; minPlayers?: number; maxPlayers?: number; durationMin?: number }[],
): Promise<Map<string, { id: string; nameKey: string }>> {
  const byName = new Map<string, { id: string; nameKey: string }>();
  for (const g of games) {
    const nameKey = boardGameNameKey(g.name);
    const created = await prisma.boardGame.create({
      data: {
        ownerId,
        name: g.name,
        nameKey,
        minPlayers: g.minPlayers ?? null,
        maxPlayers: g.maxPlayers ?? null,
        durationMin: g.durationMin ?? null,
      },
    });
    byName.set(g.name, { id: created.id, nameKey });
  }
  return byName;
}

/** Séquence de remise à zéro complète, répétée dans chaque message d'abandon du script. */
const SEQUENCE_REMISE_A_ZERO = [
  '    1. docker compose exec api pnpm exec prisma migrate reset --force',
  '    2. docker compose exec api pnpm seed          (compte admin ; Prisma 7 ne le lance plus après le reset)',
  '    3. docker compose restart api                 (puis attendre « Nest application successfully started » :',
  '                                                   le démarrage seede les systèmes de jeu)',
  '    4. docker compose exec api pnpm seed:demo',
].join('\n');

/** Types de contenu Ryuutama que ce seed référence par clé (classes, types, armes, saisons, sorts,
 *  artefacts, éveils, souffles) : chacun doit exister ET être peuplé. */
const CONTENU_RYUUTAMA_REQUIS = [
  'class',
  'type',
  'weaponItem',
  'season',
  'spell',
  'hommeDragonArtefact',
  'eveilPower',
  'souffle',
  'souffleRituel',
];

/**
 * Garde de pré-requis, exécutée AVANT toute écriture (et avant la garde d'idempotence) : le seed ne
 * crée jamais de `GameSystem` — la ligne et son contenu sont posés par
 * `GameSystemService.onApplicationBootstrap` au DÉMARRAGE de l'API. Sans elle (base fraîchement
 * remise à zéro, API pas encore redémarrée), `HommeDragon.gameSystemId` et `Character.gameSystemId`
 * échouent en P2003 au milieu du script et laissent un état partiel. Renvoie `true` si on peut
 * continuer.
 */
async function verifierPrerequis(): Promise<boolean> {
  const manquants: string[] = [];
  const systeme = await prisma.gameSystem.findUnique({ where: { id: RYUUTAMA_ID } });
  if (!systeme) {
    manquants.push(`le système de jeu « ${RYUUTAMA_ID} » est absent de la table GameSystem`);
  } else {
    const types = await prisma.contentType.findMany({
      where: { gameSystemId: RYUUTAMA_ID, key: { in: CONTENU_RYUUTAMA_REQUIS } },
      select: { key: true, _count: { select: { entries: true } } },
    });
    for (const cle of CONTENU_RYUUTAMA_REQUIS) {
      const type = types.find((t) => t.key === cle);
      if (!type || type._count.entries === 0) {
        manquants.push(`le contenu Ryuutama « ${cle} » est absent ou vide`);
      }
    }
  }
  if (manquants.length === 0) return true;

  console.error('✗ Pré-requis manquants — aucune donnée écrite :');
  for (const m of manquants) console.error(`    - ${m}`);
  console.error(
    "\n  Les systèmes de jeu sont créés au démarrage de l'API : démarrer l'API et attendre " +
      '« Nest application successfully started » avant de relancer `pnpm seed:demo`.' +
      '\n  Séquence complète de remise à zéro :\n' +
      SEQUENCE_REMISE_A_ZERO,
  );
  return false;
}

async function main() {
  if (!(await verifierPrerequis())) {
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email: 'mj-demo@example.com' },
  });
  if (existing) {
    console.log(
      '✗ Données de démo déjà présentes (mj-demo@example.com existe) — rien à faire. ' +
        'Pour repartir de zéro, séquence complète :\n' +
        SEQUENCE_REMISE_A_ZERO,
    );
    return;
  }

  // ─── Comptes ────────────────────────────────────────────────────────────────
  // Chaque compte porte une combinaison de préférences différente : aucun réglage ne reste à sa
  // valeur par défaut sur l'ensemble du jeu de données, et Chloe garde `theme: null` (jamais
  // choisi) pour exercer l'adoption du thème local au premier réglage (AD-13).
  console.log('→ Création des comptes...');
  const mj = await createUser('mj-demo@example.com', 'MaitreJeu', {
    theme: 'grimoire-emeraude',
    partiesSort: 'urgence',
    partiesViewMode: 'large',
    charactersSort: 'partie',
  });
  const alice = await createUser('alice@example.com', 'Alice', {
    theme: 'foret-ancienne',
    partiesSort: 'nom',
    hideFinishedParties: true, // masque la ONE_SHOT clôturée dans sa liste
    partiesViewMode: 'large',
    charactersViewMode: 'large',
    charactersSort: 'niveau',
    calendarLayersSetAt: at(-5, 9),
  });
  const bob = await createUser('bob@example.com', 'Bob', {
    theme: 'atelier-cuivre',
    partiesSort: 'date',
    partiesViewMode: 'compact',
    charactersViewMode: 'compact',
    charactersSort: 'nom',
    calendarLayersSetAt: at(-2, 18),
  });
  const chloe = await createUser('chloe@example.com', 'Chloe', {
    theme: null, // jamais choisi — le thème local sera adopté une fois (AD-13)
    partiesSort: 'statut',
    charactersViewMode: 'medium',
    // calendarLayersSetAt volontairement null : le jeu de couches par défaut s'applique (AD-16)
  });
  // Compte mixte MJ + joueur : MJ des « Veilleurs du Pont » et joueuse de l'épisodique.
  const diane = await createUser('diane@example.com', 'Diane', {
    theme: 'grimoire-emeraude',
    partiesSort: 'type',
    partiesViewMode: 'medium',
    charactersViewMode: 'large',
    charactersSort: 'nom',
    calendarLayersSetAt: at(-9, 11),
  });
  // Cas limite : réinitialisation de mot de passe imposée (Story 28.6). Se connecter avec ce
  // compte doit forcer le parcours de reset — l'e-mail est capté par Mailpit (http://localhost:8025).
  const erwan = await createUser('erwan@example.com', 'Erwan', {
    theme: 'foret-ancienne',
    mustResetPassword: true,
  });
  // Cas limite : membre d'une Partie SANS aucun personnage — état de départ réel qu'aucun compte
  // n'exerçait, la vue « Mes personnages » et l'invitation à créer une fiche restaient intestables.
  const faustine = await createUser('faustine@example.com', 'Faustine', {
    theme: 'atelier-cuivre',
    partiesSort: 'urgence',
  });
  // Mode soirée seulement (aucune partie de JDR) : administrateur du second groupe, Ludothèque fournie.
  // Rappel « Dispos à déclarer » coupé (Story 52.4) : il n'a aucune déclaration, il le verrait sinon —
  // contrepoint à MaitreJeu, sans déclaration non plus, qui le voit.
  const gaspard = await createUser('gaspard@example.com', 'Gaspard', {
    theme: 'atelier-cuivre',
    partiesSort: 'date',
    availabilityReminder: false,
  });
  // Mode soirée seulement : invitée (en attente) dans le premier groupe, hôte d'une soirée à dater,
  // Ludothèque VIDE.
  const helene = await createUser('helene@example.com', 'Hélène', {
    theme: 'foret-ancienne',
    partiesViewMode: 'compact',
  });

  // ─── Couches de calendrier (AD-16) ──────────────────────────────────────────
  // Alice et Bob ont réglé des sous-ensembles distincts ; Diane a tout activé ; Chloe n'y a
  // jamais touché (aucune ligne + calendarLayersSetAt null) → jeu par défaut appliqué.
  console.log('→ Couches de calendrier...');
  await prisma.userCalendarLayer.createMany({
    data: [
      { userId: alice.id, layerKey: 'mes-indisponibilites' },
      { userId: alice.id, layerKey: 'mes-seances' },
      { userId: alice.id, layerKey: 'votes-en-cours' },
      { userId: bob.id, layerKey: 'mes-seances' },
      { userId: bob.id, layerKey: 'disponibilite-groupe' },
      { userId: diane.id, layerKey: 'mes-indisponibilites' },
      { userId: diane.id, layerKey: 'mes-disponibilites' },
      { userId: diane.id, layerKey: 'mes-seances' },
      { userId: diane.id, layerKey: 'votes-en-cours' },
      { userId: diane.id, layerKey: 'inscriptions-ouvertes' },
      { userId: diane.id, layerKey: 'disponibilite-groupe' },
    ],
  });

  // ─── Disponibilités / indisponibilités (Epic 1) ──────────────────────────────
  // Absentes du seed jusqu'ici : tout le calendrier s'affichait vide. Les récurrentes portent un
  // `dayOfWeek` (0=dim…6=sam) et pas de dates ; les ponctuelles l'inverse. La dernière est déjà
  // expirée (`expiresAt` dans le passé) pour peupler la vue « archivées ».
  console.log('→ Disponibilités...');
  await prisma.availabilityDeclaration.createMany({
    data: [
      {
        userId: alice.id,
        kind: 'UNAVAILABLE',
        recurKind: 'RECURRING',
        dayOfWeek: 1, // lundi soir : cours de musique
        slot: 'EVENING',
        expiresAt: at(90),
      },
      {
        userId: alice.id,
        kind: 'UNAVAILABLE',
        recurKind: 'PUNCTUAL',
        slot: 'FULL_DAY',
        startDate: day(20), // vacances
        endDate: day(27),
        expiresAt: at(28),
      },
      {
        userId: bob.id,
        kind: 'AVAILABLE',
        recurKind: 'RECURRING',
        dayOfWeek: 6, // toujours dispo le samedi
        slot: 'FULL_DAY',
        expiresAt: at(90),
      },
      {
        userId: chloe.id,
        kind: 'UNAVAILABLE',
        recurKind: 'RECURRING',
        dayOfWeek: 3, // mercredi après-midi
        slot: 'AFTERNOON',
        expiresAt: at(90),
      },
      {
        // Recoupe volontairement les options du vote ouvert ci-dessous → la couche
        // « disponibilité-groupe » a enfin quelque chose à croiser.
        userId: diane.id,
        kind: 'AVAILABLE',
        recurKind: 'PUNCTUAL',
        slot: 'AFTERNOON',
        startDate: day(3),
        endDate: day(5),
        expiresAt: at(6),
      },
      {
        // Créneau MATIN (jamais exercé jusque-là : les autres déclarations sont après-midi, soir
        // ou journée entière) — Faustine est libre le dimanche matin.
        userId: faustine.id,
        kind: 'AVAILABLE',
        recurKind: 'RECURRING',
        dayOfWeek: 0,
        slot: 'MORNING',
        expiresAt: at(90),
      },
      {
        // Déjà expirée → archivée. Sans elle, l'état « archivé » restait invisible.
        userId: bob.id,
        kind: 'UNAVAILABLE',
        recurKind: 'PUNCTUAL',
        slot: 'FULL_DAY',
        startDate: day(-20),
        endDate: day(-15),
        expiresAt: at(-14),
      },
    ],
  });

  // ─── Hommes Dragons du MJ (Epic 10, 33 ; AD-23) ─────────────────────────────
  // Créés AVANT les parties, sans `partieId` : chaque partie les rejoint par `hommeDragonId`. Fiches
  // valides (clés de catalogue existantes, réserve conforme aux règles de `game-rules`, éveils et
  // cadeau cohérents avec le niveau — voir l'en-tête pour les niveaux visés). Pas d'avatar.
  console.log('→ Hommes Dragons...');
  // Suisen — niveau 2 (1 scénario PASSE dans « Le Naufrage de l'Aurore » + 1 dans « Chroniques de
  // la Guilde »). Éveil du niveau 2 EN ATTENTE : aucun `eveilPowers`. Réserve : capacité 1 au
  // niveau 2 (niveau − 1) ; « route » est un souffle de sa race (DRAGON_VERT), admis.
  const suisen = await createHommeDragon(mj.id, {
    race: 'DRAGON_VERT',
    artefact: { key: 'lanterne', nom: 'Lanterne des embruns' },
    nom: 'Suisen',
    apparence: 'Une brume verdâtre en forme de lanterne suspendue.',
    caractere: 'Patient, mais implacable avec les naufrageurs.',
    vocation: 'Guider les naufragés vers la bonne route.',
    demeure: "Les criques de l'Aurore",
    mondesProteges: 'Les côtes du Sud et leurs récifs.',
    reserve: ['route'],
  });
  // Kaien — niveau 5 PAR CUMUL : 1 scénario PASSE (« La Route des Lanternes ») + 11 (« Les Annales
  // de Brume ») = 12 ≥ seuil 12. Éveils 2, 3 et 4 choisis (le 5 en attente), cadeau d'une autre race
  // (lanterne = DRAGON_VERT, Kaien est DRAGON_BLEU), réserve pleine de 4 emplacements (niveau 5 :
  // 5 − 1) : « amour » (sa race, plusieurs emplacements permis), « courage » (DRAGON_ROUGE : l'UNIQUE
  // souffle d'une autre race, sur un seul emplacement) et « rituel-du-sommeil » (rituel, admis dès
  // le niveau 5, jamais compté comme « autre race »).
  const kaien = await createHommeDragon(mj.id, {
    race: 'DRAGON_BLEU',
    artefact: { key: 'anneau', nom: 'Anneau des routes liées' },
    nom: 'Kaien',
    apparence: 'Un anneau de brume bleutée qui suit la caravane à distance.',
    vocation: 'Tisser des liens entre les voyageurs du Nord.',
    mondesProteges: 'Les routes marchandes du Nord et les brumes des Annales.',
    eveilPowers: [
      { level: 2, key: 'escorte-du-dragon' },
      { level: 3, key: 'protection-du-dragon' },
      { level: 4, key: 'rugissement-du-dragon' },
    ],
    artefactCadeau: { key: 'lanterne' },
    reserve: ['amour', 'amour', 'courage', 'rituel-du-sommeil'],
  });
  // Braise — AUCUNE aventure : niveau 1, aucune réserve (capacité 0 au niveau 1), ni éveil ni cadeau.
  // État atteignable par dissociation ou suppression de partie ; cible des tests d'association.
  await createHommeDragon(mj.id, {
    race: 'DRAGON_ROUGE',
    artefact: { key: 'grande-epee', nom: 'Grande épée des braises' },
    nom: 'Braise',
    apparence: 'Une flamme basse qui attend, couchée dans la cendre.',
    caractere: 'Prête à suivre une nouvelle aventure dès qu’on la lui confie.',
    vocation: 'Veiller sur les voyageurs qui n’ont pas encore de dragon.',
  });

  // ─── Partie 1 : ONE_SHOT, déjà jouée (PASSE) — clôturée par le MJ (Story 29.6) ────
  console.log('→ Partie ONE_SHOT...');
  const oneShot = await prisma.partie.create({
    data: {
      name: "Le Naufrage de l'Aurore",
      kind: 'ONE_SHOT',
      gameSystemId: RYUUTAMA_ID,
      description: 'Un one-shot maritime : un navire échoué, des secrets à la dérive.',
      ownerId: mj.id,
      // AD-23 : première aventure de Suisen. `createdAt` explicite : l'ordre des aventures d'un
      // Homme Dragon (`createdAt` puis `id`) ne doit pas dépendre de l'horloge d'insertion.
      hommeDragonId: suisen.id,
      createdAt: at(-80),
      // Story 29.6 (AD-8) : one-shot rejouée et bouclée, le MJ l'a explicitement déclarée
      // terminée — status: 'TERMINEE' dans PartieDto, seule Partie du seed dans cet état.
      // C'est aussi celle que masque `hideFinishedParties: true` chez Alice.
      closedAt: at(-70, 20),
    },
  });
  await prisma.membership.createMany({
    data: [
      { userId: alice.id, partieId: oneShot.id },
      { userId: bob.id, partieId: oneShot.id },
    ],
  });
  const fenn = await createCharacter(
    alice.id,
    oneShot.id,
    makeSheetData('Fenn', 'chasseur', 'attaque', 'arc-de-chasse', 0, undefined, {
      individual: [
        { id: randomUUID(), name: 'Corde (10m)', weight: 1, price: '5 po', addedBy: 'player' },
        { id: randomUUID(), name: 'Torche', weight: 0.5, price: '2 po', addedBy: 'player' },
      ],
      contenants: [
        { id: randomUUID(), name: 'Sac à dos', weight: 1, price: '10 po', addedBy: 'player' },
      ],
      animaux: [{ id: randomUUID(), name: 'Faucon messager', addedBy: 'player' }],
    }),
    false,
    60,
  );
  // Roland est à 100 xp SANS `levelUps` → une montée de niveau en attente, pour explorer
  // l'écran de choix de montée (Story 6.3).
  const roland = await createCharacter(
    bob.id,
    oneShot.id,
    makeSheetData('Roland', 'guerisseur', 'technique', 'dague', 1),
    true, // journalAutoAssociate — pour démontrer l'association automatique
    100,
  );

  const oneShotPoll = await prisma.sessionPoll.create({
    data: {
      partieId: oneShot.id,
      createdById: mj.id,
      status: 'CLOSED',
      chosenDate: at(-70),
      chosenSlot: 'AFTERNOON',
    },
  });
  const oneShotScenario = await createScenario({
    data: {
      partieId: oneShot.id,
      title: "Le Naufrage de l'Aurore",
      description: "L'équipage de l'Aurore a disparu. Ses cales regorgent d'indices.",
      status: 'PASSE',
      dureeHeures: 4,
      dureeSeances: 1,
      closedAt: at(-70, 19),
      resumeFin:
        'Fenn et Roland ont découvert que le naufrage était un coup monté par le marchand ' +
        'Ossian pour toucher une assurance. Roland a soigné les rescapés cachés dans la cale ' +
        "avant qu'Ossian ne les fasse taire — moment fort de la séance.",
    },
  });
  await prisma.seance.create({
    data: {
      eventId: oneShotScenario.id,
      pollId: oneShotPoll.id,
      // Story 37.4 : plage de la séance = option choisie du vote (seule source de la date).
      startDate: at(-70),
      startSlot: 'AFTERNOON',
      endDate: at(-70),
      endSlot: 'AFTERNOON',
      // Infos pratiques (jusqu'ici jamais peuplées par le seed).
      heureRdv: '14:00',
      lieu: 'Chez le MJ',
      notePratique: 'Prévoir de quoi grignoter, la séance est longue.',
      compteRendu:
        "Belle séance, l'énigme du journal de bord codé a bien fonctionné. À refaire : plus " +
        'de temps pour la scène finale de confrontation avec Ossian.',
    },
  });
  await prisma.characterNote.createMany({
    data: [
      {
        characterId: fenn.id,
        text: "Note privée de Fenn : se méfier d'Ossian dès la prochaine fois.",
        shared: false,
      },
      {
        characterId: fenn.id,
        text: "Fenn a retrouvé la trace du journal de bord dans la cale inondée — moment marquant de l'enquête.",
        shared: true,
        scenarioId: oneShotScenario.id, // association manuelle
      },
      {
        characterId: roland.id,
        text: 'Roland a soigné les rescapés cachés par Ossian, in extremis.',
        shared: true,
        createdAt: at(-70, 18), // dans la fenêtre → association auto (journalAutoAssociate=true)
      },
    ],
  });

  // XP distribuée après la clôture du scénario (Story 6.2).
  const oneShotXp = await prisma.xpDistribution.create({
    data: {
      partieId: oneShot.id,
      mjId: mj.id,
      note: "Naufrage de l'Aurore : enquête bouclée, bonus pour la scène de confrontation.",
    },
  });
  await prisma.xpDistributionEntry.createMany({
    data: [
      { distributionId: oneShotXp.id, characterId: fenn.id, amount: 60 },
      { distributionId: oneShotXp.id, characterId: roland.id, amount: 80 },
      { distributionId: oneShotXp.id, characterId: roland.id, amount: 20, isBonus: true },
    ],
  });

  // Document de scénario (Story 7.2) — visible une fois le scénario COURANT/PASSE (anti-spoil).
  const oneShotDocText =
    "Journal de bord de l'Aurore (transcription) : \"...le chargement d'assurance " +
    'doit disparaître avant l\'inspection du port..." — signé Ossian.';
  const oneShotDocFilename = await writeDocumentFile(
    Buffer.from(oneShotDocText, 'utf-8'),
    'text/plain',
  );
  await prisma.scenarioDocument.create({
    data: {
      partieId: oneShot.id,
      scenarioId: oneShotScenario.id,
      filename: oneShotDocFilename,
      originalName: 'journal-de-bord-aurore.txt',
      sizeBytes: Buffer.byteLength(oneShotDocText, 'utf-8'),
    },
  });

  // ─── Partie 2 : CAMPAGNE_LINEAIRE, en cours ───────────────────────────────
  console.log('→ Partie CAMPAGNE_LINEAIRE...');
  const lineaire = await prisma.partie.create({
    data: {
      name: 'La Route des Lanternes',
      kind: 'CAMPAGNE_LINEAIRE',
      gameSystemId: RYUUTAMA_ID,
      description: 'Une campagne itinérante sur les routes marchandes du Nord.',
      ownerId: mj.id,
      // AD-23 : l'une des deux aventures de Kaien (l'autre : « Les Annales de Brume », plus bas,
      // créée plus tôt dans l'histoire du jeu de données).
      hommeDragonId: kaien.id,
      createdAt: at(-60),
    },
  });
  await prisma.membership.createMany({
    data: [
      { userId: alice.id, partieId: lineaire.id },
      { userId: bob.id, partieId: lineaire.id },
      { userId: chloe.id, partieId: lineaire.id },
      // Cas limite : membre sans personnage. Faustine rejoint la campagne mais n'a pas encore
      // créé sa fiche — la vue « Mes personnages » vide et l'invitation à créer sont testables.
      { userId: faustine.id, partieId: lineaire.id },
    ],
  });
  // Liora a DÉJÀ appliqué sa montée au niveau 2 (`levelUps` renseigné) : 2 PV + 1 PE alloués et
  // un attribut amélioré. Ses dérivées en tiennent compte via `computeDerived` — contrepoint à
  // Roland, resté en attente.
  // Type Magie : fiche valide au regard de la Règle 7 de `validate.ts` — une saison du catalogue
  // `season` et 2 sorts rituels DÉBUTANTS distincts du catalogue `spell` (magicType « rituelle »,
  // tier « debutant »). Même fiche pour le personnage et ses instantanés ci-dessous.
  const lioraSheet = makeSheetData(
    'Liora',
    'marchand',
    'magie',
    'epee-large',
    2,
    undefined,
    undefined,
    [
      {
        level: 2,
        pvAllocated: 2,
        peAllocated: 1,
        capabilities: [{ type: 'attribute', params: { attribute: 'INT' } }],
      },
    ],
    { magicSeason: 'automne', knownRitualSpells: ['cloche-alarme', 'fleche-boussole'] },
  );
  const liora = await createCharacter(alice.id, lineaire.id, lioraSheet, false, 150);
  const garrick = await createCharacter(
    bob.id,
    lineaire.id,
    makeSheetData('Garrick', 'noble', 'attaque', 'epee-large', 0),
    false,
    80,
  );
  const mira = await createCharacter(
    chloe.id,
    lineaire.id,
    makeSheetData('Mira', 'menestrel', 'technique', 'arc-de-chasse', 1),
    false,
    80,
  );

  // Instantanés de Liora (Epic 6) : jamais peuplés jusqu'ici. La sémantique reproduit celle de
  // `CharacterService` — la fiche stockée est l'état APRÈS le changement, et
  // `level = 1 + levelUps.length`. (`lioraSheet` : définie plus haut, avec son choix de magie.)
  await prisma.characterSnapshot.createMany({
    data: [
      {
        characterId: liora.id,
        sheetData: lioraSheet as unknown as Prisma.InputJsonValue,
        derived: computeDerived(lioraSheet) as unknown as Prisma.InputJsonValue,
        level: 2,
        trigger: 'LEVEL_UP',
        createdAt: at(-40, 21),
      },
      {
        characterId: liora.id,
        sheetData: lioraSheet as unknown as Prisma.InputJsonValue,
        derived: computeDerived(lioraSheet) as unknown as Prisma.InputJsonValue,
        level: 2,
        trigger: 'MJ_EDIT',
        note: "Correction d'une faute de frappe sur le nom de la ville d'origine.",
        createdAt: at(-38, 10),
      },
    ],
  });

  // Distributions d'XP de la campagne (Story 6.2) : la somme des entrées de chaque personnage
  // égale exactement son `Character.xp` (Liora 150, Garrick 80, Mira 80) — l'historique ne
  // contredit jamais le total. Dates postérieures à la clôture du Chapitre 1 (J−45, 18 h).
  const lineaireXp1 = await prisma.xpDistribution.create({
    data: {
      partieId: lineaire.id,
      mjId: mj.id,
      note: 'Chapitre 1 : les marchands libérés, la carte des routes secrètes.',
      createdAt: at(-45, 19),
    },
  });
  await prisma.xpDistributionEntry.createMany({
    data: [
      { distributionId: lineaireXp1.id, characterId: liora.id, amount: 100 },
      { distributionId: lineaireXp1.id, characterId: liora.id, amount: 20, isBonus: true },
      { distributionId: lineaireXp1.id, characterId: garrick.id, amount: 60 },
      { distributionId: lineaireXp1.id, characterId: mira.id, amount: 60 },
    ],
  });
  const lineaireXp2 = await prisma.xpDistribution.create({
    data: {
      partieId: lineaire.id,
      mjId: mj.id,
      note: 'Bonus de jeu de rôle : la négociation de Liora et le chant de Mira.',
      createdAt: at(-20, 21),
    },
  });
  await prisma.xpDistributionEntry.createMany({
    data: [
      { distributionId: lineaireXp2.id, characterId: liora.id, amount: 30, isBonus: true },
      { distributionId: lineaireXp2.id, characterId: garrick.id, amount: 20 },
      { distributionId: lineaireXp2.id, characterId: mira.id, amount: 20, isBonus: true },
    ],
  });

  const chap1Poll = await prisma.sessionPoll.create({
    data: {
      partieId: lineaire.id,
      createdById: mj.id,
      status: 'CLOSED',
      chosenDate: at(-45),
      chosenSlot: 'AFTERNOON',
    },
  });
  const chap1 = await createScenario({
    data: {
      partieId: lineaire.id,
      title: 'Chapitre 1 : Les Ombres du Marché',
      description: 'Une caravane marchande disparaît sans laisser de trace.',
      status: 'PASSE',
      dureeHeures: 3,
      dureeSeances: 1,
      closedAt: at(-45, 18),
      resumeFin:
        "Liora a négocié la libération des marchands capturés en échange d'une carte des " +
        'routes secrètes — un choix qui pèsera sur la suite de la campagne.',
    },
  });
  await prisma.seance.create({
    data: {
      eventId: chap1.id,
      pollId: chap1Poll.id,
      // Story 37.4 : plage de la séance = option choisie du vote (seule source de la date).
      startDate: at(-45),
      startSlot: 'AFTERNOON',
      endDate: at(-45),
      endSlot: 'AFTERNOON',
      heureRdv: '14:00',
      lieu: 'Chez Alice',
      compteRendu: 'Bonne mise en place de la campagne, les joueurs ont accroché sur le mystère.',
    },
  });

  // ─── Vote de date OUVERT, avec de vrais bulletins ──────────────────────────
  // Le cœur de ce qui manquait : trois options FUTURES, une expiration future, et des `PollVote`.
  // Alice et Bob ont voté ; Chloe et Faustine pas encore → 2 répondants sur 4 membres, et J+4 se
  // dégage comme consensus (deux OUI) tandis que J+5 est écarté (deux NON).
  const chap2Poll = await prisma.sessionPoll.create({
    data: {
      partieId: lineaire.id,
      createdById: mj.id,
      status: 'OPEN',
      expiresAt: at(7, 23),
    },
  });
  const chap2Options = await Promise.all(
    [3, 4, 5].map((offset) =>
      prisma.pollOption.create({
        data: { pollId: chap2Poll.id, date: day(offset), slot: 'AFTERNOON' },
      }),
    ),
  );
  await prisma.pollVote.createMany({
    data: [
      { pollId: chap2Poll.id, optionId: chap2Options[0].id, userId: alice.id, answer: 'YES' },
      { pollId: chap2Poll.id, optionId: chap2Options[1].id, userId: alice.id, answer: 'YES' },
      { pollId: chap2Poll.id, optionId: chap2Options[2].id, userId: alice.id, answer: 'NO' },
      { pollId: chap2Poll.id, optionId: chap2Options[0].id, userId: bob.id, answer: 'MAYBE' },
      { pollId: chap2Poll.id, optionId: chap2Options[1].id, userId: bob.id, answer: 'YES' },
      { pollId: chap2Poll.id, optionId: chap2Options[2].id, userId: bob.id, answer: 'NO' },
      // Chloe ne vote pas : réponse partielle du groupe, cas le plus fréquent en vrai.
    ],
  });
  const chap2 = await createScenario({
    data: {
      partieId: lineaire.id,
      title: 'Chapitre 2 : Le Sceau Brisé',
      description: 'Le sceau protégeant la ville de Verchamp a été brisé pendant la nuit.',
      status: 'COURANT',
      dureeHeures: 3,
      dureeSeances: 2,
    },
  });
  await prisma.seance.create({ data: { eventId: chap2.id, pollId: chap2Poll.id } });

  const chap3 = await createScenario({
    data: {
      partieId: lineaire.id,
      title: "Chapitre 3 : L'Appel du Nord",
      status: 'BROUILLON',
    },
  });
  // Invariant « tout scénario a au moins une séance » (cf. `PartiesService.create`) : un brouillon
  // porte une séance vide, sans date ni vote — le MJ la planifiera plus tard.
  await prisma.seance.create({ data: { eventId: chap3.id } });
  await prisma.characterNote.createMany({
    data: [
      {
        characterId: liora.id,
        text: "Le marchand qu'on a relâché savait déjà nos noms...",
        shared: false,
      },
      {
        characterId: garrick.id,
        text: 'La carte trouvée mène plus loin au nord que prévu.',
        shared: true,
      },
    ],
  });

  // Document de bibliothèque de Partie (Story 7.2) — scenarioId null = toujours visible.
  const lineaireLibDocText =
    'Carte des routes marchandes du Nord — repères, relais et distances entre villes.';
  const lineaireLibDocFilename = await writeDocumentFile(
    Buffer.from(lineaireLibDocText, 'utf-8'),
    'text/plain',
  );
  await prisma.scenarioDocument.create({
    data: {
      partieId: lineaire.id,
      scenarioId: null,
      filename: lineaireLibDocFilename,
      originalName: 'carte-routes-du-nord.txt',
      sizeBytes: Buffer.byteLength(lineaireLibDocText, 'utf-8'),
    },
  });

  // Annonces MJ à portée variable (Epic 9) : une pour toute la Partie, une pour le scénario courant.
  const annoncePartie = await prisma.announcement.create({
    data: {
      partieId: lineaire.id,
      text: "Prochaine séance décalée d'une semaine, merci de répondre au sondage en cours.",
      createdAt: at(-3, 9),
    },
  });
  const annonceScenario = await prisma.announcement.create({
    data: {
      partieId: lineaire.id,
      scenarioId: chap2.id,
      text: 'Pensez à préparer vos fiches : le Chapitre 2 démarre par une scène de combat.',
      createdAt: at(-1, 20),
    },
  });
  // Accusés de lecture (jamais peuplés) : Alice a lu l'annonce de Partie, Bob et Chloe non ; Bob a
  // lu l'annonce du scénario courant (lue pour lui, non lue pour les autres) → le badge « non lu »
  // est observable dans les deux états, pour les deux portées, selon le compte connecté.
  await prisma.announcementRead.createMany({
    data: [
      { userId: alice.id, announcementId: annoncePartie.id, readAt: at(-2, 8) },
      { userId: bob.id, announcementId: annonceScenario.id, readAt: at(-1, 21) },
    ],
  });

  // Favoris (jamais peuplés) — Alice et Bob épinglent des Parties différentes : Alice la campagne
  // linéaire ici, Bob la campagne épisodique (sa ligne est créée avec elle, plus bas).
  await prisma.partieFavorite.create({ data: { userId: alice.id, partieId: lineaire.id } });

  // Cadenas de visibilité anti-spoil (Story 31.6) : le MJ retire certaines clés de fiche à tout
  // lecteur qui n'est ni le propriétaire du personnage ni le MJ. `fieldKey`/`subField` respectent
  // `set-visibility-locks.dto.ts` : clés `lockable` du `sheetSchema`, sous-champ uniquement pour
  // `attributes` (AGI/ESP/INT/VIG). Ici : deux attributs masqués, l'arme favorite et l'équipement.
  await prisma.partieVisibilityLock.createMany({
    data: [
      { partieId: lineaire.id, fieldKey: 'attributes', subField: 'AGI' },
      { partieId: lineaire.id, fieldKey: 'attributes', subField: 'INT' },
      { partieId: lineaire.id, fieldKey: 'weaponId', subField: null },
      { partieId: lineaire.id, fieldKey: 'equipment', subField: null },
    ],
  });

  // ─── Partie 3 : CAMPAGNE_EPISODIQUE, mixte ────────────────────────────────
  console.log('→ Partie CAMPAGNE_EPISODIQUE...');
  const episodique = await prisma.partie.create({
    data: {
      name: 'Chroniques de la Guilde',
      kind: 'CAMPAGNE_EPISODIQUE',
      gameSystemId: RYUUTAMA_ID,
      description: "Chaque enquête est indépendante, résolue par qui s'y inscrit.",
      ownerId: mj.id,
      // AD-23 : seconde aventure de Suisen — Alice et Bob y retrouvent les voyageurs du Naufrage.
      hommeDragonId: suisen.id,
      createdAt: at(-50),
      // Prochaine séance : recalculée en fin de script (`recalculerProchaineSeance`) → « Le Mystère
      // de l'Auberge » (J+10) ; « Le Secret du Phare » (J+12) vient après. Ces plages n'ont pas de
      // créneau → `nextSessionSlot` null. Le rappel de la veille est porté par chaque séance
      // (`Seance.reminderSentAt`, null ici) : il n'est dû que dans les 24 h précédant la séance.
    },
  });
  await prisma.membership.createMany({
    data: [
      { userId: alice.id, partieId: episodique.id },
      { userId: bob.id, partieId: episodique.id },
      { userId: chloe.id, partieId: episodique.id },
      // Diane : joueuse ici, MJ de sa propre Partie plus bas — compte mixte.
      { userId: diane.id, partieId: episodique.id },
    ],
  });
  const yuna = await createCharacter(
    alice.id,
    episodique.id,
    makeSheetData('Yuna', 'chasseur', 'attaque', 'arc-de-chasse', 1),
    false,
    40,
  );
  const theo = await createCharacter(
    bob.id,
    episodique.id,
    makeSheetData('Theo', 'artisan', 'technique', 'dague', 2, 'Forgeron'),
    false,
    40,
  );
  const sable = await createCharacter(
    chloe.id,
    episodique.id,
    makeSheetData(
      'Sable',
      'guerisseur',
      'magie',
      'arc-de-chasse',
      0,
      undefined,
      undefined,
      undefined,
      // Magie valide (Règle 7) : affinité printemps (soins) + deux sorts rituels débutants.
      { magicSeason: 'printemps', knownRitualSpells: ['imposition-mains', 'sphere-protection'] },
    ),
    false,
    95, // juste sous le seuil de 100 : contrepoint à Roland, aucune montée en attente
  );
  const orla = await createCharacter(
    diane.id,
    episodique.id,
    makeSheetData('Orla', 'chasseur', 'attaque', 'arc-de-chasse', 1),
    false,
    40,
  );

  // Favori de Bob : la campagne épisodique (Alice épingle la linéaire — Parties différentes).
  await prisma.partieFavorite.create({ data: { userId: bob.id, partieId: episodique.id } });

  // Distributions d'XP (Story 6.2) : la somme des entrées de chaque personnage égale son
  // `Character.xp` (Yuna 40, Theo 40, Sable 95, Orla 40). La première suit la clôture de
  // « L'Affaire du Bijou Volé » (J−30, 18 h), la seconde est une prime de guilde pour tous.
  const guildeXp1 = await prisma.xpDistribution.create({
    data: {
      partieId: episodique.id,
      mjId: mj.id,
      note: "L'Affaire du Bijou Volé : la servante démasquée, bonus pour son témoignage.",
      createdAt: at(-30, 19),
    },
  });
  await prisma.xpDistributionEntry.createMany({
    data: [
      { distributionId: guildeXp1.id, characterId: yuna.id, amount: 30 },
      { distributionId: guildeXp1.id, characterId: sable.id, amount: 35 },
      { distributionId: guildeXp1.id, characterId: sable.id, amount: 20, isBonus: true },
    ],
  });
  const guildeXp2 = await prisma.xpDistribution.create({
    data: {
      partieId: episodique.id,
      mjId: mj.id,
      note: 'Prime de guilde : tous les membres inscrits au registre.',
      createdAt: at(-29, 10),
    },
  });
  await prisma.xpDistributionEntry.createMany({
    data: [
      { distributionId: guildeXp2.id, characterId: yuna.id, amount: 10 },
      { distributionId: guildeXp2.id, characterId: theo.id, amount: 40 },
      { distributionId: guildeXp2.id, characterId: sable.id, amount: 40 },
      { distributionId: guildeXp2.id, characterId: orla.id, amount: 40 },
    ],
  });

  // Rôles de groupe (Epic 27) — les 4 rôles de contenu couverts.
  await prisma.characterGroupRole.createMany({
    data: [
      { characterId: yuna.id, partieId: episodique.id, roleKey: 'chef' },
      { characterId: theo.id, partieId: episodique.id, roleKey: 'intendant' },
      { characterId: sable.id, partieId: episodique.id, roleKey: 'chroniqueur' },
      { characterId: orla.id, partieId: episodique.id, roleKey: 'cartographe' },
    ],
  });

  const bijou = await createScenario({
    data: {
      partieId: episodique.id,
      title: "L'Affaire du Bijou Volé",
      description: 'Un bijou de famille disparaît la veille des noces du gouverneur.',
      status: 'PASSE',
      dureeHeures: 3,
      dureeSeances: 1,
      closedAt: at(-30, 18),
      resumeFin:
        'Yuna et Sable ont démasqué la servante infidèle — mais ont choisi de la couvrir en ' +
        'échange de son témoignage sur un trafic plus vaste. Ce choix reviendra les hanter.',
    },
  });
  await prisma.scenarioParticipant.createMany({
    data: [
      { scenarioId: bijou.id, userId: alice.id },
      { scenarioId: bijou.id, userId: chloe.id },
    ],
  });
  const bijouSeance = await prisma.seance.create({
    data: {
      eventId: bijou.id,
      inscriptionMin: 2,
      inscriptionMax: 4,
      // Story 37.4 : date posée hors vote → plage sans créneau, `end = start`.
      startDate: at(-30),
      endDate: at(-30),
      heureRdv: '14:30',
      lieu: 'Taverne du Griffon',
      compteRendu: 'Enquête bouclée en une séance, bon rythme, twist final apprécié.',
    },
  });
  await prisma.inscription.createMany({
    data: [
      { seanceId: bijouSeance.id, userId: alice.id },
      { seanceId: bijouSeance.id, userId: chloe.id },
    ],
  });
  await prisma.characterNote.createMany({
    data: [
      {
        characterId: yuna.id,
        text: 'Yuna a repéré les traces de pas menant aux quartiers des domestiques.',
        shared: true,
        scenarioId: bijou.id,
      },
      {
        characterId: sable.id,
        text: 'Sable garde le silence sur ce que la servante lui a confié.',
        shared: false,
      },
    ],
  });

  // ─── Cas limite : séance A_VENIR COMPLÈTE (inscriptionMax atteint) ─────────
  // 3 inscrits pour un maximum de 3 → le bouton d'inscription doit être fermé aux autres.
  const auberge = await createScenario({
    data: {
      partieId: episodique.id,
      title: "Le Mystère de l'Auberge",
      description: "Des voyageurs disparaissent près d'une auberge isolée.",
      status: 'A_VENIR',
      dureeHeures: 3,
    },
  });
  await prisma.scenarioParticipant.createMany({
    data: [
      { scenarioId: auberge.id, userId: alice.id },
      { scenarioId: auberge.id, userId: bob.id },
      { scenarioId: auberge.id, userId: chloe.id },
    ],
  });
  const aubergeSeance = await prisma.seance.create({
    data: {
      eventId: auberge.id,
      inscriptionMin: 2,
      inscriptionMax: 3,
      startDate: at(10), // = Partie.nextSessionDate (voir plus haut)
      endDate: at(10),
      heureRdv: '20:30',
      lieu: 'Chez Bob',
      notePratique: 'Code de la porte : 1234B. Sonner deux fois.',
    },
  });
  await prisma.inscription.createMany({
    data: [
      { seanceId: aubergeSeance.id, userId: alice.id },
      { seanceId: aubergeSeance.id, userId: bob.id },
      { seanceId: aubergeSeance.id, userId: chloe.id },
    ],
  });

  // ─── Cas limite : séance A_VENIR avec de la PLACE ──────────────────────────
  // 1 inscrit pour un maximum de 5 → le bouton d'inscription reste ouvert. Diane et les autres
  // peuvent s'inscrire depuis l'interface.
  const phare = await createScenario({
    data: {
      partieId: episodique.id,
      title: 'Le Secret du Phare',
      description: 'Le gardien du phare de Roche-Pâle ne répond plus depuis trois nuits.',
      status: 'A_VENIR',
      dureeHeures: 4,
    },
  });
  const phareSeance = await prisma.seance.create({
    data: {
      eventId: phare.id,
      inscriptionMin: 2,
      inscriptionMax: 5,
      startDate: at(12),
      endDate: at(12),
      heureRdv: '20:00',
      lieu: 'En visio',
    },
  });
  await prisma.inscription.create({
    data: { seanceId: phareSeance.id, userId: diane.id },
  });

  // Second vote OUVERT, en parallèle de celui de la campagne linéaire — exerce le message agrégé
  // « N votes de date en cours » (comportement couvert par les specs front, sans donnée jusqu'ici).
  const guildePoll = await prisma.sessionPoll.create({
    data: {
      partieId: episodique.id,
      createdById: mj.id,
      status: 'OPEN',
      expiresAt: at(9, 23),
    },
  });
  const guildeOptions = await Promise.all(
    [8, 9].map((offset) =>
      prisma.pollOption.create({
        data: { pollId: guildePoll.id, date: day(offset), slot: 'EVENING' },
      }),
    ),
  );
  await prisma.pollVote.createMany({
    data: [
      { pollId: guildePoll.id, optionId: guildeOptions[0].id, userId: alice.id, answer: 'YES' },
      { pollId: guildePoll.id, optionId: guildeOptions[1].id, userId: alice.id, answer: 'NO' },
      { pollId: guildePoll.id, optionId: guildeOptions[0].id, userId: diane.id, answer: 'YES' },
      { pollId: guildePoll.id, optionId: guildeOptions[1].id, userId: diane.id, answer: 'YES' },
    ],
  });

  const dette = await createScenario({
    data: { partieId: episodique.id, title: 'La Dette du Passeur', status: 'BROUILLON' },
  });
  // Brouillon : séance vide, comme pour le Chapitre 3.
  await prisma.seance.create({ data: { eventId: dette.id } });

  // ─── Partie 4 : CAMPAGNE_LINEAIRE MJ'd par Diane, jamais commencée ────────
  // Aucun scénario volontairement : status: 'A_VENIR' (« pas encore commencée », AD-8) —
  // troisième valeur de PartieStatus, absente du reste du seed sans cet ajout.
  console.log('→ Partie CAMPAGNE_LINEAIRE (MJ : Diane)...');
  const dianeCampagne = await prisma.partie.create({
    data: {
      name: 'Les Veilleurs du Pont',
      kind: 'CAMPAGNE_LINEAIRE',
      gameSystemId: RYUUTAMA_ID,
      description: 'Une garnison isolée surveille un pont que plus personne ne devrait franchir.',
      ownerId: diane.id,
    },
  });
  await prisma.membership.create({ data: { userId: alice.id, partieId: dianeCampagne.id } });

  // ─── Partie 5 : CAMPAGNE_LINEAIRE très avancée — « Les Annales de Brume » ─────
  // Aventure de Kaien : ses onze scénarios `PASSE`, ajoutés à celui de « La Route des
  // Lanternes », font 12 → niveau 5 PAR CUMUL (aucune des deux aventures n'y arrive seule).
  // Chaque scénario porte une séance minimale (`eventId` + plage sans créneau), tous dans
  // le passé et sans scénario COURANT ; le chapitre 12, à venir, est une journée JDR (plage longue).
  console.log('→ Partie CAMPAGNE_LINEAIRE (Les Annales de Brume)...');
  const annales = await prisma.partie.create({
    data: {
      name: 'Les Annales de Brume',
      kind: 'CAMPAGNE_LINEAIRE',
      gameSystemId: RYUUTAMA_ID,
      description:
        'Une longue chronique en brume : onze chapitres déjà racontés, une légende en suspens.',
      ownerId: mj.id,
      hommeDragonId: kaien.id, // l'une des deux aventures de Kaien (AD-23)
      // Créée AVANT son premier chapitre (J−216) : une partie ne peut pas avoir joué avant d'exister.
      // C'est donc la PREMIÈRE aventure de Kaien (`createdAt`), « La Route des Lanternes » la seconde.
      createdAt: at(-240),
    },
  });
  await prisma.membership.createMany({
    data: [
      { userId: alice.id, partieId: annales.id },
      { userId: diane.id, partieId: annales.id },
      { userId: faustine.id, partieId: annales.id },
    ],
  });
  for (let chapitre = 1; chapitre <= 11; chapitre++) {
    const jour = -230 + chapitre * 14; // du chapitre 1 (J−216) au chapitre 11 (J−76), toujours passé
    const scenario = await createScenario({
      data: {
        partieId: annales.id,
        title: `Annales de Brume — Chapitre ${chapitre}`,
        status: 'PASSE',
        dureeHeures: 3,
        dureeSeances: 1,
        closedAt: at(jour, 19),
      },
    });
    await prisma.seance.create({
      data: { eventId: scenario.id, startDate: at(jour), endDate: at(jour) },
    });
  }
  // Chapitre 12 : une JOURNÉE JDR (Palier 10.4, épic 47 — plages longues). Le vote, clos, portait
  // une durée de 3 créneaux : chaque option couvrait matin → soir ; l'option choisie (J+30) fixe la
  // séance sur toute la plage. A_VENIR, pas PASSE : le niveau de Kaien n'en dépend pas.
  const annalesPoll = await prisma.sessionPoll.create({
    data: {
      partieId: annales.id,
      createdById: mj.id,
      status: 'CLOSED',
      chosenDate: day(30),
      chosenSlot: 'MORNING',
      createdAt: at(-15),
    },
  });
  const annalesOptions = await Promise.all(
    [30, 37].map((offset) =>
      prisma.pollOption.create({
        data: { pollId: annalesPoll.id, date: day(offset), slot: 'MORNING' },
      }),
    ),
  );
  await prisma.pollVote.createMany({
    data: [
      { pollId: annalesPoll.id, optionId: annalesOptions[0].id, userId: alice.id, answer: 'YES' },
      { pollId: annalesPoll.id, optionId: annalesOptions[1].id, userId: alice.id, answer: 'NO' },
      { pollId: annalesPoll.id, optionId: annalesOptions[0].id, userId: diane.id, answer: 'YES' },
      { pollId: annalesPoll.id, optionId: annalesOptions[1].id, userId: diane.id, answer: 'YES' },
      {
        pollId: annalesPoll.id,
        optionId: annalesOptions[0].id,
        userId: faustine.id,
        answer: 'MAYBE',
      },
      {
        pollId: annalesPoll.id,
        optionId: annalesOptions[1].id,
        userId: faustine.id,
        answer: 'YES',
      },
    ],
  });
  const annales12 = await createScenario({
    data: {
      partieId: annales.id,
      title: 'Annales de Brume — Chapitre 12 : La Journée des Brumes',
      description: 'Une journée entière pour traverser la brume, du lever au coucher.',
      status: 'A_VENIR',
      dureeHeures: 9,
      dureeSeances: 1,
    },
  });
  await prisma.seance.create({
    data: {
      eventId: annales12.id,
      pollId: annalesPoll.id,
      ...plage(day(30), 'MORNING', 3),
      heureRdv: '10:00',
      lieu: 'Salle des fêtes de Verchamp',
      notePratique: 'Repas tiré du sac à midi, pause goûter vers 16 h.',
    },
  });

  // ─── Partie 6 : ONE_SHOT dont la séance tombe dans moins de 24 h (MJ : Diane) ──────
  // Sert à tester le rappel e-mail (`NotificationsService`, cron horaire) : le premier passage après
  // ce seed envoie « session-reminder » au MJ et aux membres (visible dans Mailpit,
  // http://localhost:8025) puis pose `reminderSentAt` sur la séance. La date est MINUIT UTC de
  // demain (`day(1)`) : quelle que soit l'heure du seed, elle est strictement dans les 24 h à venir
  // (`now ≤ date ≤ now + 24 h`). `nextSession*` est recalculé en fin de script ;
  // `Seance.reminderSentAt` reste null (Story 37.9) = rappel pas encore envoyé.
  console.log('→ Partie ONE_SHOT (séance dans moins de 24 h)...');
  const maree = await prisma.partie.create({
    data: {
      name: 'La Marée du Lendemain',
      kind: 'ONE_SHOT',
      gameSystemId: RYUUTAMA_ID,
      description: 'Un one-shot de bord de mer : la marée monte demain soir.',
      ownerId: diane.id,
      createdAt: at(-12),
    },
  });
  await prisma.membership.createMany({
    data: [
      { userId: bob.id, partieId: maree.id },
      { userId: chloe.id, partieId: maree.id },
    ],
  });
  const mareePoll = await prisma.sessionPoll.create({
    data: {
      partieId: maree.id,
      createdById: diane.id,
      status: 'CLOSED',
      chosenDate: day(1),
      chosenSlot: 'EVENING',
      createdAt: at(-6),
    },
  });
  const mareeOptions = await Promise.all(
    [1, 2].map((offset) =>
      prisma.pollOption.create({
        data: { pollId: mareePoll.id, date: day(offset), slot: 'EVENING' },
      }),
    ),
  );
  await prisma.pollVote.createMany({
    data: [
      { pollId: mareePoll.id, optionId: mareeOptions[0].id, userId: bob.id, answer: 'YES' },
      { pollId: mareePoll.id, optionId: mareeOptions[1].id, userId: bob.id, answer: 'MAYBE' },
      { pollId: mareePoll.id, optionId: mareeOptions[0].id, userId: chloe.id, answer: 'YES' },
      { pollId: mareePoll.id, optionId: mareeOptions[1].id, userId: chloe.id, answer: 'NO' },
    ],
  });
  // Un one-shot porte son scénario unique (AD-7), ici ouvert aux joueurs (A_VENIR).
  const mareeScenario = await createScenario({
    data: {
      partieId: maree.id,
      title: 'La Marée du Lendemain',
      description: 'Une marée exceptionnelle découvre une épave que personne ne devait revoir.',
      status: 'A_VENIR',
      dureeHeures: 3,
      dureeSeances: 1,
    },
  });
  await prisma.seance.create({
    data: {
      eventId: mareeScenario.id,
      pollId: mareePoll.id,
      // Story 37.4 : plage de la séance = option choisie du vote (seule source de la date).
      startDate: day(1),
      startSlot: 'EVENING',
      endDate: day(1),
      endSlot: 'EVENING',
      heureRdv: '20:30',
      lieu: 'En visio',
      notePratique: 'Se connecter dix minutes avant, micro et caméra testés.',
    },
  });

  // ─── Partie 7 : ONE_SHOT SANS AUCUN MEMBRE (MJ : Diane) ─────────────────────
  // Signal AUCUN_MEMBRE_INVITE (`party-signals.service.ts`) : aucun `Membership`, aucune invitation.
  // Son vote de date est OUVERT mais son expiration est PASSÉE (J−5, avant ses deux options) — rien
  // ne le ferme automatiquement, c'est l'état « vote périmé » à afficher. Options matin et journée
  // entière : les deux créneaux que les autres votes du seed n'utilisent pas.
  console.log('→ Partie ONE_SHOT (sans aucun membre)...');
  const veillee = await prisma.partie.create({
    data: {
      name: 'La Veillée des Absents',
      kind: 'ONE_SHOT',
      gameSystemId: RYUUTAMA_ID,
      description: "Un one-shot prêt à jouer, mais dont personne n'a encore été invité.",
      ownerId: diane.id,
      createdAt: at(-9),
    },
  });
  const veilleePoll = await prisma.sessionPoll.create({
    data: {
      partieId: veillee.id,
      createdById: diane.id,
      status: 'OPEN',
      expiresAt: at(-5, 23),
      createdAt: at(-8),
    },
  });
  await prisma.pollOption.createMany({
    data: [
      { pollId: veilleePoll.id, date: day(-4), slot: 'MORNING' },
      { pollId: veilleePoll.id, date: day(-3), slot: 'FULL_DAY' },
    ],
  });
  const veilleeScenario = await createScenario({
    data: {
      partieId: veillee.id,
      title: 'La Veillée des Absents',
      description: "Une veillée funèbre où manquent tous ceux qu'on attendait.",
      status: 'A_VENIR',
      dureeHeures: 3,
      dureeSeances: 1,
    },
  });
  await prisma.seance.create({ data: { eventId: veilleeScenario.id, pollId: veilleePoll.id } });

  // ─── Partie 8 : CAMPAGNE_LINEAIRE sur un système SANS module (Draconis, MJ : Diane) ──────
  // ⚠ État HÉRITÉ, non créable via l'API : `PartiesService.create()` refuse un système sans module
  // de personnage (story 29.17). On l'insère directement pour exercer ce que la story garantit pour
  // les parties déjà existantes (AC3) : consultable, modifiable sans changer de système, pas de
  // bouton de création de personnage ni de signal PERSONNAGE_A_CREER. Aucune ligne `GameSystem`
  // « draconis » n'est nécessaire (`Partie.gameSystemId` n'a pas de FK) ; pas d'Homme Dragon (Ryuutama).
  console.log('→ Partie CAMPAGNE_LINEAIRE (Draconis, système sans module)...');
  const cendres = await prisma.partie.create({
    data: {
      name: 'Les Cendres de Nacre',
      kind: 'CAMPAGNE_LINEAIRE',
      gameSystemId: DRACONIS_ID,
      description: 'Une campagne Draconis héritée : le système ne propose pas encore de fiche.',
      ownerId: diane.id,
      createdAt: at(-20),
    },
  });
  await prisma.membership.createMany({
    data: [
      // Faustine est arrivée par le lien d'invitation (révoqué depuis, voir plus bas) ; Chloe par
      // l'invitation nominative ACCEPTED ci-dessous — `joinedAt` = date de la réponse.
      { userId: faustine.id, partieId: cendres.id, joinedAt: at(-18, 12) },
      { userId: chloe.id, partieId: cendres.id, joinedAt: at(-5, 10) },
    ],
  });
  const cendresPoll = await prisma.sessionPoll.create({
    data: {
      partieId: cendres.id,
      createdById: diane.id,
      status: 'CLOSED',
      chosenDate: day(21),
      chosenSlot: 'EVENING',
      createdAt: at(-4),
    },
  });
  await prisma.pollOption.create({
    data: { pollId: cendresPoll.id, date: day(21), slot: 'EVENING' },
  });
  const cendresScenario = await createScenario({
    data: {
      partieId: cendres.id,
      title: 'Prologue : Le Pacte de Cendres',
      description: 'Les premiers serments, avant que le feu ne prenne.',
      status: 'A_VENIR',
      dureeHeures: 3,
      dureeSeances: 1,
    },
  });
  await prisma.seance.create({
    data: {
      eventId: cendresScenario.id,
      pollId: cendresPoll.id,
      // Story 37.4 : plage de la séance = option choisie du vote (seule source de la date).
      startDate: day(21),
      startSlot: 'EVENING',
      endDate: day(21),
      endSlot: 'EVENING',
      heureRdv: '19:00',
      lieu: 'Chez Diane',
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE SOIRÉE (famille `ralliement`, paliers 10 à 10.5)
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Ludothèques (épic 48) ──────────────────────────────────────────────────
  // Doublons volontaires entre personnes (Codenames : Alice et Bob ; Dixit : Alice et Diane) pour le
  // « ×N » des jeux d'une soirée et la vue agrégée du groupe ; noms accentués (clé normalisée) ; un jeu
  // sans aucun champ facultatif (MaitreJeu) ; Faustine et Hélène n'ont AUCUN jeu (état vide).
  console.log('→ Ludothèques...');
  const ludoAlice = await createLudotheque(alice.id, [
    { name: 'Codenames', minPlayers: 2, maxPlayers: 8, durationMin: 15 },
    { name: 'Dixit', minPlayers: 3, maxPlayers: 6, durationMin: 30 },
    { name: 'Les Aventuriers du Rail', minPlayers: 2, maxPlayers: 5, durationMin: 45 },
    { name: 'Patchwork', minPlayers: 2, maxPlayers: 2, durationMin: 30 },
  ]);
  const ludoBob = await createLudotheque(bob.id, [
    { name: 'Codenames', minPlayers: 4, maxPlayers: 8, durationMin: 15 },
    { name: '7 Wonders', minPlayers: 3, maxPlayers: 7, durationMin: 30 },
    { name: 'Skull', minPlayers: 3, maxPlayers: 6, durationMin: 20 },
  ]);
  const ludoChloe = await createLudotheque(chloe.id, [
    { name: 'Azul', minPlayers: 2, maxPlayers: 4, durationMin: 40 },
    { name: 'Wingspan', minPlayers: 1, maxPlayers: 5, durationMin: 70 },
    { name: "Time's Up", minPlayers: 4, maxPlayers: 12, durationMin: 45 },
  ]);
  const ludoDiane = await createLudotheque(diane.id, [
    { name: 'Les Loups-Garous de Thiercelieux', minPlayers: 8, maxPlayers: 18, durationMin: 30 },
    { name: 'Unlock!', minPlayers: 1, maxPlayers: 6, durationMin: 60 },
    { name: 'Dixit', minPlayers: 3, maxPlayers: 8 },
  ]);
  await createLudotheque(mj.id, [
    { name: 'Gloomhaven', minPlayers: 1, maxPlayers: 4, durationMin: 120 },
    { name: 'Le Jeu de la Ficelle' }, // aucun champ facultatif
  ]);
  await createLudotheque(gaspard.id, [
    { name: 'Catan', minPlayers: 3, maxPlayers: 4, durationMin: 75 },
    { name: 'Carcassonne', minPlayers: 2, maxPlayers: 5, durationMin: 35 },
    { name: 'Splendor', minPlayers: 2, maxPlayers: 4, durationMin: 30 },
  ]);
  const game = (ludo: Map<string, { id: string; nameKey: string }>, name: string) => {
    const g = ludo.get(name);
    if (!g) throw new Error(`Jeu de démo introuvable : ${name}`);
    return g;
  };

  // ─── Groupe 1 : « Les Joueurs du Jeudi » (épics 39, 40, 42, 49, 50) ──────────
  // Bob l'a créé (ADMIN), Alice est aussi ADMIN (admins multiples), MaitreJeu y est simple membre :
  // le même compte est MJ ailleurs. Conjonctions dans tous les états : trois passées (compteur « Qui
  // reçoit » : Bob 2, Alice 1), une à venir avec places limitées + place réservée en attente + jeux
  // apportés/écartés/envies, une COMPLÈTE, un sondage ouvert dont l'échéance est DEMAIN (relance de la
  // veille, Story 40.7), un week-end en plage longue et une annulée.
  console.log('→ Mode soirée : groupe « Les Joueurs du Jeudi »...');
  const jeudi = await createRalliement({
    name: 'Les Joueurs du Jeudi',
    kind: 'CAMPAGNE_EPISODIQUE',
    description: 'Le groupe de jeux de société du jeudi soir — et des week-ends quand on peut.',
    ownerId: bob.id,
    members: [alice.id, chloe.id, diane.id, faustine.id, mj.id],
    admins: [alice.id],
    createdAt: at(-90),
  });
  await createConjonction({
    partieId: jeudi.partieId,
    hostId: bob.id,
    title: 'Soirée de rentrée',
    date: { offset: -56, slot: 'EVENING' },
    lieu: 'Chez Bob',
    heureRdv: '20:00',
    confirmed: [alice.id, diane.id],
    createdAt: at(-63),
  });
  await createConjonction({
    partieId: jeudi.partieId,
    hostId: alice.id,
    title: 'Tournoi de Codenames',
    date: { offset: -35, slot: 'EVENING' },
    lieu: 'Chez Alice',
    heureRdv: '20:30',
    confirmed: [bob.id, diane.id, mj.id],
    createdAt: at(-45),
  });
  await createConjonction({
    partieId: jeudi.partieId,
    hostId: bob.id,
    title: "Soirée jeux d'ambiance",
    date: { offset: -14, slot: 'EVENING' },
    capacity: 4,
    lieu: 'Chez Bob',
    confirmed: [alice.id, chloe.id],
    createdAt: at(-20),
  });
  // À venir, 5 places : l'hôte + 2 confirmés + 1 réservée (Diane, en attente d'acceptation) → une
  // place libre. Une place réservée n'est PAS une participation : Diane n'apporte rien.
  const soireeAlice = await createConjonction({
    partieId: jeudi.partieId,
    hostId: alice.id,
    title: 'Soirée jeux chez Alice',
    date: { offset: 6, slot: 'EVENING' },
    capacity: 5,
    lieu: 'Chez Alice, 3e étage',
    heureRdv: '20:00',
    notePratique: 'Chacun apporte une boisson, Alice s’occupe des pizzas.',
    confirmed: [bob.id, chloe.id],
    reserved: [diane.id],
    createdAt: at(-4, 18),
  });
  await prisma.eventGameBring.createMany({
    data: [
      // Codenames de Bob = doublon de celui d'Alice (hôte) → « ×2 » dans les jeux de la soirée.
      { eventId: soireeAlice.eventId, boardGameId: game(ludoBob, 'Codenames').id, userId: bob.id },
      { eventId: soireeAlice.eventId, boardGameId: game(ludoBob, '7 Wonders').id, userId: bob.id },
      { eventId: soireeAlice.eventId, boardGameId: game(ludoChloe, 'Azul').id, userId: chloe.id },
    ],
  });
  // L'hôte écarte un de ses jeux pour ce soir seulement (Story 49.4) : il reste dans sa Ludothèque.
  await prisma.eventGameExcluded.create({
    data: {
      eventId: soireeAlice.eventId,
      boardGameId: game(ludoAlice, 'Les Aventuriers du Rail').id,
    },
  });
  // Envies (Story 49.5) : par NOM, uniquement sur des jeux présents sur place (jeux de l'hôte non
  // écartés + jeux apportés). Deux personnes sur « codenames » → envie partagée.
  await prisma.eventGameEnvy.createMany({
    data: [
      {
        eventId: soireeAlice.eventId,
        userId: chloe.id,
        nameKey: game(ludoAlice, 'Codenames').nameKey,
      },
      {
        eventId: soireeAlice.eventId,
        userId: bob.id,
        nameKey: game(ludoAlice, 'Codenames').nameKey,
      },
      { eventId: soireeAlice.eventId, userId: chloe.id, nameKey: game(ludoAlice, 'Dixit').nameKey },
      {
        eventId: soireeAlice.eventId,
        userId: alice.id,
        nameKey: game(ludoBob, '7 Wonders').nameKey,
      },
    ],
  });
  // COMPLÈTE : 3 places = l'hôte (MaitreJeu) + 2 confirmés → le bouton « Je viens » est fermé. Plage
  // de 2 créneaux (après-midi + soir).
  await createConjonction({
    partieId: jeudi.partieId,
    hostId: mj.id,
    title: 'Campagne Gloomhaven — scénario 3',
    date: { offset: 13, slot: 'AFTERNOON' },
    durationSlots: 2,
    capacity: 3,
    lieu: 'Chez MaitreJeu',
    heureRdv: '15:00',
    confirmed: [alice.id, diane.id],
    createdAt: at(-6, 21),
  });
  // Sondage OUVERT, « Tous les membres » (votants = tous les membres) : réponses partielles — Diane
  // (hôte) et Bob ont tout rempli, Alice une seule option, Chloe/Faustine/MaitreJeu rien. Échéance =
  // fin de DEMAIN → la relance de la veille (`relanceSentAt` null) part au prochain passage du cron.
  const jeudiPoll = await createGroupPoll(
    jeudi.partieId,
    diane.id,
    [
      { offset: 8, slot: 'EVENING' },
      { offset: 9, slot: 'EVENING' },
      { offset: 15, slot: 'AFTERNOON' },
    ],
    1,
  );
  await createConjonction({
    partieId: jeudi.partieId,
    hostId: diane.id,
    title: 'Soirée Loups-Garous — on choisit la date',
    pollId: jeudiPoll.poll.id,
    lieu: 'Chez Diane',
    createdAt: at(-3, 10),
  });
  const [jo1, jo2, jo3] = jeudiPoll.options;
  await prisma.pollVote.createMany({
    data: [
      { pollId: jeudiPoll.poll.id, optionId: jo1.id, userId: diane.id, answer: 'YES' },
      { pollId: jeudiPoll.poll.id, optionId: jo2.id, userId: diane.id, answer: 'YES' },
      { pollId: jeudiPoll.poll.id, optionId: jo3.id, userId: diane.id, answer: 'MAYBE' },
      { pollId: jeudiPoll.poll.id, optionId: jo1.id, userId: bob.id, answer: 'YES' },
      { pollId: jeudiPoll.poll.id, optionId: jo2.id, userId: bob.id, answer: 'NO' },
      { pollId: jeudiPoll.poll.id, optionId: jo3.id, userId: bob.id, answer: 'YES' },
      { pollId: jeudiPoll.poll.id, optionId: jo1.id, userId: alice.id, answer: 'MAYBE' },
    ],
  });
  // Week-end au gîte : PLAGE LONGUE (épic 47) du vendredi soir au dimanche après-midi = 6 créneaux.
  const vendredi = nextWeekdayOffset(5, 18);
  const gite = await createConjonction({
    partieId: jeudi.partieId,
    hostId: chloe.id,
    title: 'Week-end jeux au gîte',
    date: { offset: vendredi, slot: 'EVENING' },
    durationSlots: 6,
    capacity: 6,
    lieu: 'Gîte des Trois Chênes',
    heureRdv: '19:00',
    notePratique: 'Draps fournis. Covoiturage depuis la gare à 18 h.',
    confirmed: [bob.id, alice.id],
    reserved: [faustine.id],
    createdAt: at(-8, 12),
  });
  await prisma.eventGameBring.createMany({
    data: [
      { eventId: gite.eventId, boardGameId: game(ludoAlice, 'Patchwork').id, userId: alice.id },
      { eventId: gite.eventId, boardGameId: game(ludoBob, 'Skull').id, userId: bob.id },
    ],
  });
  // ANNULÉE (Story 42.1) : définitive, hors prochaine date et hors calendriers.
  await createConjonction({
    partieId: jeudi.partieId,
    hostId: faustine.id,
    title: 'Soirée Unlock (annulée)',
    date: { offset: 3, slot: 'EVENING' },
    lieu: 'Chez Faustine',
    confirmed: [chloe.id],
    createdAt: at(-10),
    cancelledAt: at(-1, 18),
  });

  // ─── Groupe 2 : « Ludo du Quartier » — aucun événement (état vide) ───────────
  console.log('→ Mode soirée : groupe « Ludo du Quartier »...');
  const quartier = await createRalliement({
    name: 'Ludo du Quartier',
    kind: 'CAMPAGNE_EPISODIQUE',
    description: 'Tout juste créé : personne n’a encore proposé de conjonction.',
    ownerId: gaspard.id,
    members: [helene.id, faustine.id],
    createdAt: at(-7),
  });

  // ─── Rencontres isolées (« soirées », épic 41) ──────────────────────────────
  console.log('→ Mode soirée : rencontres isolées...');
  // À venir, date fixée, plage de 2 créneaux. Participants = tous les membres (l'hôte compris).
  const anniv = await createRalliement({
    name: 'Anniversaire de Chloe',
    kind: 'ONE_SHOT',
    description: 'Soirée jeux surprise pour les 30 ans de Chloe — chut !',
    ownerId: chloe.id,
    members: [alice.id, bob.id, diane.id],
    createdAt: at(-10),
  });
  await prisma.seance.update({
    where: { id: anniv.seanceId! },
    data: {
      ...plage(day(4), 'AFTERNOON', 2),
      lieu: 'Chez Chloe',
      heureRdv: '16:00',
      notePratique: 'Gâteau prévu, venez avec vos jeux préférés.',
    },
  });
  await prisma.eventGameBring.createMany({
    data: [
      // Dixit apporté par Alice ET par Diane → doublon de deux apporteurs.
      { eventId: anniv.eventId!, boardGameId: game(ludoAlice, 'Dixit').id, userId: alice.id },
      { eventId: anniv.eventId!, boardGameId: game(ludoDiane, 'Dixit').id, userId: diane.id },
      {
        eventId: anniv.eventId!,
        boardGameId: game(ludoDiane, 'Les Loups-Garous de Thiercelieux').id,
        userId: diane.id,
      },
    ],
  });
  await prisma.eventGameEnvy.createMany({
    data: [
      { eventId: anniv.eventId!, userId: bob.id, nameKey: game(ludoAlice, 'Dixit').nameKey },
      { eventId: anniv.eventId!, userId: bob.id, nameKey: game(ludoChloe, "Time's Up").nameKey },
    ],
  });

  // Sondage OUVERT sur une soirée isolée (date pas encore fixée) : Bob n'a pas répondu.
  const raclette = await createRalliement({
    name: 'Soirée raclette',
    kind: 'ONE_SHOT',
    ownerId: alice.id,
    members: [bob.id, gaspard.id, mj.id],
    createdAt: at(-5),
  });
  const raclettePoll = await createGroupPoll(
    raclette.partieId,
    alice.id,
    [
      { offset: 11, slot: 'EVENING' },
      { offset: 12, slot: 'EVENING' },
      { offset: 18, slot: 'EVENING' },
    ],
    9,
  );
  await prisma.seance.update({
    where: { id: raclette.seanceId! },
    data: { pollId: raclettePoll.poll.id, lieu: 'Chez Alice' },
  });
  const [ro1, ro2, ro3] = raclettePoll.options;
  await prisma.pollVote.createMany({
    data: [
      { pollId: raclettePoll.poll.id, optionId: ro1.id, userId: alice.id, answer: 'YES' },
      { pollId: raclettePoll.poll.id, optionId: ro2.id, userId: alice.id, answer: 'YES' },
      { pollId: raclettePoll.poll.id, optionId: ro3.id, userId: alice.id, answer: 'NO' },
      { pollId: raclettePoll.poll.id, optionId: ro1.id, userId: gaspard.id, answer: 'NO' },
      { pollId: raclettePoll.poll.id, optionId: ro2.id, userId: gaspard.id, answer: 'YES' },
      { pollId: raclettePoll.poll.id, optionId: ro3.id, userId: gaspard.id, answer: 'YES' },
      { pollId: raclettePoll.poll.id, optionId: ro1.id, userId: mj.id, answer: 'YES' },
      { pollId: raclettePoll.poll.id, optionId: ro2.id, userId: mj.id, answer: 'MAYBE' },
      { pollId: raclettePoll.poll.id, optionId: ro3.id, userId: mj.id, answer: 'NO' },
    ],
  });

  // « À dater » : ni date ni sondage (`isDatableSeance`) — l'hôte doit la compléter.
  const aDater = await createRalliement({
    name: 'Soirée jeux à organiser',
    kind: 'ONE_SHOT',
    ownerId: helene.id,
    members: [gaspard.id],
    createdAt: at(-1, 9),
  });

  // TERMINÉE (date passée, Story 41.4), retirée de sa liste par Alice (Story 42.5) — Bob et Chloe la
  // voient encore.
  const crepes = await createRalliement({
    name: 'Soirée crêpes',
    kind: 'ONE_SHOT',
    ownerId: bob.id,
    members: [alice.id, chloe.id],
    createdAt: at(-20),
  });
  await prisma.seance.update({
    where: { id: crepes.seanceId! },
    data: { ...plage(day(-10), 'EVENING'), lieu: 'Chez Bob', heureRdv: '19:30' },
  });
  await prisma.partieHidden.create({ data: { userId: alice.id, partieId: crepes.partieId } });

  // ANNULÉE (Story 42.2) : son événement unique porte `cancelledAt`.
  const karaoke = await createRalliement({
    name: 'Soirée karaoké',
    kind: 'ONE_SHOT',
    ownerId: diane.id,
    members: [bob.id, helene.id],
    createdAt: at(-9),
  });
  await prisma.seance.update({
    where: { id: karaoke.seanceId! },
    data: { ...plage(day(7), 'EVENING'), lieu: 'Bar Le Micro' },
  });
  await prisma.event.update({
    where: { id: karaoke.eventId! },
    data: { cancelledAt: at(-2, 21) },
  });

  // Favoris côté soirée.
  await prisma.partieFavorite.createMany({
    data: [
      { userId: bob.id, partieId: jeudi.partieId },
      { userId: gaspard.id, partieId: quartier.partieId },
    ],
  });

  // Invitations et lien côté soirée : Hélène invitée (en attente) dans le groupe 1, Diane invitée à
  // la soirée à dater d'Hélène ; lien ouvert du groupe 1 créé par Alice (admin).
  await prisma.invitation.createMany({
    data: [
      {
        partieId: jeudi.partieId,
        inviterId: bob.id,
        inviteeUserId: helene.id,
        status: 'PENDING',
        createdAt: at(-1, 20),
      },
      {
        partieId: aDater.partieId,
        inviterId: helene.id,
        inviteeUserId: diane.id,
        status: 'PENDING',
        createdAt: at(-1, 8),
      },
    ],
  });
  const groupLinkToken = randomUUID();
  await prisma.inviteLink.create({
    data: {
      token: groupLinkToken,
      partieId: jeudi.partieId,
      createdById: alice.id,
      maxUses: 3,
      expiresAt: at(7, 23),
    },
  });

  // ─── Invitations nominatives (Epic 5) : les quatre statuts ──────────────────────
  console.log('→ Invitations et liens...');
  await prisma.invitation.createMany({
    data: [
      {
        // En attente : Erwan doit voir cette invitation et pouvoir l'accepter ou la refuser.
        partieId: dianeCampagne.id,
        inviterId: diane.id,
        inviteeUserId: erwan.id,
        status: 'PENDING',
        createdAt: at(-2, 15),
      },
      {
        // Déjà refusée → exerce l'affichage côté MJ d'une invitation déclinée.
        partieId: oneShot.id,
        inviterId: mj.id,
        inviteeUserId: faustine.id,
        status: 'DECLINED',
        createdAt: at(-75, 10),
        respondedAt: at(-74, 9),
      },
      {
        // Acceptée → le `Membership` correspondant existe (Chloe dans « Les Cendres de Nacre »,
        // `joinedAt` = `respondedAt`), comme le crée `InvitationsService.accept()`.
        partieId: cendres.id,
        inviterId: diane.id,
        inviteeUserId: chloe.id,
        status: 'ACCEPTED',
        createdAt: at(-6, 15),
        respondedAt: at(-5, 10),
      },
      {
        // Révoquée par le MJ avant toute réponse : aucun Membership, l'invitation n'est plus
        // listée côté destinataire (seules les PENDING le sont).
        partieId: annales.id,
        inviterId: mj.id,
        inviteeUserId: erwan.id,
        status: 'REVOKED',
        createdAt: at(-30, 10),
        respondedAt: at(-28, 16),
      },
    ],
  });

  // ─── Liens d'invitation : tous les états (Story 5.2) ────────────────────────
  // Couvre tous les chemins de la page de jonction : lien valide, quota épuisé, expiré, révoqué,
  // ciblé.
  const validToken = randomUUID();
  const consumedToken = randomUUID();
  const expiredToken = randomUUID();
  const targetedToken = randomUUID();
  const revokedToken = randomUUID();
  await prisma.inviteLink.createMany({
    data: [
      {
        // Valide, partageable, sans limite d'usage.
        token: validToken,
        partieId: dianeCampagne.id,
        createdById: diane.id,
        maxUses: null,
        expiresAt: at(7, 23),
      },
      {
        // Usage unique DÉJÀ consommé → doit être refusé avec le bon message.
        token: consumedToken,
        partieId: episodique.id,
        createdById: mj.id,
        maxUses: 1,
        usesCount: 1,
        expiresAt: at(7, 23),
      },
      {
        // Expiré.
        token: expiredToken,
        partieId: lineaire.id,
        createdById: mj.id,
        maxUses: 5,
        expiresAt: at(-2, 23),
      },
      {
        // Ciblé par e-mail (généré via l'invitation par e-mail) — pas un lien ouvert.
        token: targetedToken,
        partieId: lineaire.id,
        createdById: mj.id,
        maxUses: 1,
        expiresAt: at(5, 23),
        targetEmail: 'nouveau-venu@example.com',
      },
      {
        // Révoqué par le MJ alors qu'il n'est ni expiré ni épuisé (`revoked: true`) — Faustine
        // l'avait utilisé pour rejoindre « Les Cendres de Nacre » (`usesCount: 1`).
        token: revokedToken,
        partieId: cendres.id,
        createdById: diane.id,
        maxUses: 3,
        usesCount: 1,
        expiresAt: at(14, 23),
        revoked: true,
        createdAt: at(-19, 9),
      },
    ],
  });

  // ─── Jetons à usage unique : réinitialisation de mot de passe et changement d'e-mail ───────
  // Format du lien : `<id>.<secret>` ; seul `argon2(secret)` est stocké (`AuthService`). Seuls des
  // jetons VALIDES sont semés : la purge horaire supprime les expirés. Aucun e-mail n'est envoyé
  // ici — les liens sont affichés à la fin du script.
  const resetToken = await createTokenSecret();
  const resetTokenId = randomUUID();
  await prisma.passwordResetToken.create({
    data: {
      id: resetTokenId,
      userId: erwan.id, // le compte `mustResetPassword`
      tokenHash: resetToken.tokenHash,
      expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000), // +24 h (FR-6)
    },
  });
  const emailChangeToken = await createTokenSecret();
  const emailChangeTokenId = randomUUID();
  const emailChangeNewEmail = 'chloe.nouvelle@example.com';
  await prisma.emailChangeToken.create({
    data: {
      id: emailChangeTokenId,
      userId: chloe.id,
      newEmail: emailChangeNewEmail, // aucune autre ligne `User` ne l'utilise
      tokenHash: emailChangeToken.tokenHash,
      expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000), // +24 h (Story 28.6)
    },
  });
  // Retour arrière : émis par une confirmation de changement d'e-mail déjà faite il y a 2 jours
  // (l'adresse actuelle de Faustine est la « nouvelle »), valable 1 mois à partir de là. Le
  // consommer restaure `faustine.ancienne@…`, coupe ses sessions et impose un reset de mot de passe.
  const rollbackToken = await createTokenSecret();
  const rollbackTokenId = randomUUID();
  await prisma.emailChangeRollbackToken.create({
    data: {
      id: rollbackTokenId,
      userId: faustine.id,
      oldEmail: 'faustine.ancienne@example.com',
      tokenHash: rollbackToken.tokenHash,
      createdAt: at(-2, 9),
      expiresAt: at(28, 9), // créé + 30 jours
    },
  });

  // ─── Prochaine séance de chaque partie (miroir d'`EventsService`, jamais posée à la main) ───
  console.log('→ Prochaines séances...');
  const toutes = await prisma.partie.findMany({ select: { id: true } });
  for (const p of toutes) await recalculerProchaineSeance(p.id);

  console.log('✓ Données de démo créées.');
  console.log(`\n  Comptes (mot de passe commun) : ${DEMO_PASSWORD}`);
  console.log(
    '    - mj-demo@example.com   pseudo « MaitreJeu » · MJ de 4 Parties · 3 Hommes Dragons',
  );
  console.log(
    '                            membre du groupe « Les Joueurs du Jeudi » · rappel « Dispos à déclarer » visible',
  );
  console.log(
    '    - alice@example.com     masque les Parties terminées · admin du groupe · hôte d’une soirée',
  );
  console.log(
    '    - bob@example.com       indisponibilité archivée · créateur du groupe « Les Joueurs du Jeudi »',
  );
  console.log("    - chloe@example.com     thème jamais choisi · n'a pas voté au sondage ouvert");
  console.log('                            hôte du week-end au gîte et de son anniversaire');
  console.log(
    '    - diane@example.com     MJ de 4 Parties (2 ONE_SHOT dont 1 sans membre, 1 Draconis)',
  );
  console.log('                            ET joueuse ailleurs · place réservée en attente');
  console.log('    - erwan@example.com     ⚠ mustResetPassword · invitation en attente');
  console.log('    - faustine@example.com  membre sans personnage · invitation refusée');
  console.log(
    '    - gaspard@example.com   mode soirée seul · admin « Ludo du Quartier » · rappel coupé',
  );
  console.log('    - helene@example.com    mode soirée seul · invitée au groupe · Ludothèque vide');
  console.log(
    '\n  Parties JDR : 8 (dont « Les Annales de Brume », 11 scénarios joués + une journée JDR à venir)',
  );
  console.log('    - La Marée du Lendemain : séance dans moins de 24 h → rappel e-mail (Mailpit)');
  console.log('    - La Veillée des Absents : aucun membre · vote OUVERT expiré');
  console.log(
    '    - Les Cendres de Nacre : Draconis, système sans module (état hérité, non créable)',
  );
  console.log('  Mode soirée : 2 groupes, 5 rencontres isolées, 6 Ludothèques');
  console.log(
    '    - Les Joueurs du Jeudi : 3 conjonctions passées, 1 avec place réservée + jeux, 1 complète,',
  );
  console.log('      1 sondage à échéance DEMAIN (relance), 1 week-end en plage longue, 1 annulée');
  console.log('    - Ludo du Quartier : aucun événement');
  console.log(
    '    - Soirées : anniversaire (à venir), raclette (sondage), à organiser, crêpes (terminée), karaoké (annulée)',
  );
  console.log(`    - Lien d'invitation du groupe : ${WEB_ORIGIN}/join/${groupLinkToken}`);
  console.log('  Hommes Dragons (compte MaitreJeu) :');
  console.log(
    "    - Suisen  niveau 2 · 2 aventures (Naufrage de l'Aurore, Chroniques de la Guilde)",
  );
  console.log(
    '    - Kaien   niveau 5 par cumul · 2 aventures (Route des Lanternes, Annales de Brume)',
  );
  console.log('    - Braise  niveau 1 · aucune aventure (cible des tests d’association)');
  console.log(`\n  Liens d'invitation (${WEB_ORIGIN}/join/<token>) :`);
  console.log(`    valide    ${validToken}`);
  console.log(`    consommé  ${consumedToken}`);
  console.log(`    expiré    ${expiredToken}`);
  console.log(`    ciblé     ${targetedToken}  (nouveau-venu@example.com)`);
  console.log(`    révoqué   ${revokedToken}`);
  console.log('\n  Jetons à usage unique (valides ~24 h, rollback ~28 j) :');
  console.log(
    `    reset mdp     ${WEB_ORIGIN}/reset-password/${resetTokenId}.${resetToken.secret}  (erwan@example.com)`,
  );
  console.log(
    `    e-mail (conf) ${WEB_ORIGIN}/confirm-email-change/${emailChangeTokenId}.${emailChangeToken.secret}  (chloe@ → ${emailChangeNewEmail})`,
  );
  console.log(
    `    e-mail (rollback) ${WEB_ORIGIN}/rollback-email-change/${rollbackTokenId}.${rollbackToken.secret}  (faustine@ → faustine.ancienne@example.com)`,
  );
  console.log('\n  E-mails (rappel de séance, réinitialisation…) : Mailpit, http://localhost:8025');

  // Rappel : le compte admin n'est PAS créé par ce script mais par `pnpm seed`. Ses identifiants
  // sont ceux de `.env` (ADMIN_EMAIL / ADMIN_PSEUDO / ADMIN_PASSWORD) — volontairement non affichés.
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  console.log(
    admins > 0
      ? '\n  Compte admin : créé par `pnpm seed`, identifiants ADMIN_EMAIL / ADMIN_PASSWORD de .env.'
      : '\n  ⚠ Aucun compte admin : lancer `docker compose exec api pnpm seed` (identifiants ADMIN_* de .env).',
  );
  console.log(`\n  Toutes les dates sont relatives au ${NOW.toISOString()}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
