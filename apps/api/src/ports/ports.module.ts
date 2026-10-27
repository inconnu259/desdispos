import { Global, Module } from '@nestjs/common';
import { OCCUPIED_SPANS_PORT } from '../availability/ports/occupied-spans.port';
import { OWN_EVENTS_PORT } from '../availability/ports/own-events.port';
import { EventsModule } from '../events/events.module';
import { EventsService } from '../events/events.service';
import { DATABLE_SEANCE_FILTER } from '../events/ports/datable-seance-filter.port';
import { PartiesModule } from '../parties/parties.module';
import { PartiesService } from '../parties/parties.service';
import { ScenarioDatableSeanceFilter } from '../scenarios/datable-seance-filter.service';
import { ScenariosModule } from '../scenarios/scenarios.module';
import { OpenPollContextService } from '../events/open-poll-context.service';
import { GroupPollChoiceService } from '../events/group-poll-choice.service';
import { GroupPollExtensionService } from '../events/group-poll-extension.service';
import { GROUP_POLL_CHOOSE_PORT } from '../poll/ports/group-poll-choose.port';
import { GROUP_POLL_EXTEND_PORT } from '../poll/ports/group-poll-extend.port';
import { GROUP_POLL_VOTE_PORT } from '../poll/ports/group-poll-vote.port';
import { OPEN_POLL_CONTEXT_PORT } from '../poll/ports/open-poll-context.port';
import { PARTIE_SIGNALS_PORT } from '../poll/ports/partie-signals.port';
import { RENDEZ_VOUS_DURATION_PORT } from '../poll/ports/rendez-vous-duration.port';
import { SEANCE_DATE_PORT } from '../poll/ports/seance-date.port';

/**
 * Composition des ports de la couche 1 (Story 37.8, AD-8) — LE seul endroit où la planification
 * (`availability/`, `poll/`) rencontre les couches qui l'implémentent. Les modules de la couche 1
 * ne déclarent que des interfaces + jetons d'injection (dossiers `ports/`) ; ce module global lie
 * chaque jeton à son implémentation (`useExisting` : jamais une seconde instance), de sorte que
 * `AvailabilityModule` et `PollModule` n'importent plus `PartiesModule`, `EventsModule` ni
 * `ScenariosModule`.
 *
 * - `OccupiedSpansPort`, `OwnEventsPort`, `SeanceDatePort`, `GroupPollVotePort` (Story 40.5),
 *   `RendezVousDurationPort` (Story 47.4) → `EventsService` ;
 * - `GroupPollChoosePort` (Story 40.6) → `GroupPollChoiceService` ;
 * - `GroupPollExtendPort` (Story 40.7) → `GroupPollExtensionService` ;
 * - `OpenPollContextPort` (Story 44.2) → `OpenPollContextService` ;
 * - `DatableSeanceFilter` (Story 45.1, déclaré dans `events/ports/`) → `ScenarioDatableSeanceFilter` ;
 * - `PartieSignalsPort` → `PartiesService`.
 */
@Global()
@Module({
  imports: [EventsModule, PartiesModule, ScenariosModule],
  providers: [
    { provide: OCCUPIED_SPANS_PORT, useExisting: EventsService },
    { provide: OWN_EVENTS_PORT, useExisting: EventsService },
    { provide: SEANCE_DATE_PORT, useExisting: EventsService },
    { provide: GROUP_POLL_VOTE_PORT, useExisting: EventsService },
    { provide: RENDEZ_VOUS_DURATION_PORT, useExisting: EventsService },
    { provide: GROUP_POLL_CHOOSE_PORT, useExisting: GroupPollChoiceService },
    { provide: GROUP_POLL_EXTEND_PORT, useExisting: GroupPollExtensionService },
    { provide: OPEN_POLL_CONTEXT_PORT, useExisting: OpenPollContextService },
    { provide: PARTIE_SIGNALS_PORT, useExisting: PartiesService },
    { provide: DATABLE_SEANCE_FILTER, useExisting: ScenarioDatableSeanceFilter },
  ],
  exports: [
    OCCUPIED_SPANS_PORT,
    OWN_EVENTS_PORT,
    SEANCE_DATE_PORT,
    GROUP_POLL_VOTE_PORT,
    RENDEZ_VOUS_DURATION_PORT,
    GROUP_POLL_CHOOSE_PORT,
    GROUP_POLL_EXTEND_PORT,
    OPEN_POLL_CONTEXT_PORT,
    PARTIE_SIGNALS_PORT,
    DATABLE_SEANCE_FILTER,
  ],
})
export class PortsModule {}
