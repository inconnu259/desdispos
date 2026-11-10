import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// RealtimeModule importe désormais PartiesModule (Story 18.2, Task 1, AD-9), qui importe
// PartiesController -> create-partie.dto.ts -> import RUNTIME (pas `import type`) de GAME_SYSTEMS
// depuis @master-jdr/shared (ESM, non transformé par ts-jest) — même mécanisme que le piège déjà
// documenté pour @master-jdr/game-rules (mémoire projet "game-rules ESM jest.mock"), jamais
// rencontré avant pour @master-jdr/shared car aucun autre spec n'importe le VRAI PartiesModule.
jest.mock('@master-jdr/shared', () => ({
  // Réduit à ce que lisent les DTO (`id`, `name`) — pas la forme complète du registre (37.5).
  GAME_SYSTEMS: [{ id: 'ryuutama', name: 'Ryuutama' }],
}));

import { RealtimeModule } from './realtime.module';
import { RealtimeEventsService } from './realtime-events.service';
import { PrismaModule } from '../prisma/prisma.module';

// ConsumerModule n'importe PAS RealtimeModule — seul le module de test racine le fait.
// ConsumerService injecte RealtimeEventsService via son constructeur : sans @Global() sur
// RealtimeModule, Nest lèverait une erreur de résolution de dépendance à la compilation
// ("Nest can't resolve dependencies of ConsumerService"), car RealtimeEventsService ne serait
// visible que dans l'injecteur de RealtimeModule, pas dans celui de ConsumerModule (revue de
// code Story 18.1 : la version précédente de ce test réimportait RealtimeModule dans le même
// module racine que ConsumerModule, ce qui aurait fait passer le test même sans @Global()).
@Injectable()
class ConsumerService {
  constructor(public readonly events: RealtimeEventsService) {}
}

@Module({
  providers: [ConsumerService],
  exports: [ConsumerService],
})
class ConsumerModule {}

describe('RealtimeModule', () => {
  it('exporte RealtimeEventsService, injectable dans un module qui ne le réimporte pas (AC3, @Global())', async () => {
    // RealtimeModule importe désormais PartiesModule (Story 18.2, Task 1, AD-9) — PartiesService/
    // AvailabilityService y attendent PrismaService. PrismaModule (@Global()) doit être importé
    // au moins une fois dans le graphe compilé pour que ce statut global prenne effet (Nest ne
    // le propage pas automatiquement à un module de test isolé qui ne l'importe jamais) — même
    // sans connexion réelle établie (.compile() n'appelle pas onModuleInit()/$connect()).
    const moduleRef = await Test.createTestingModule({
      imports: [RealtimeModule, ConsumerModule, PrismaModule],
    }).compile();

    const consumer = moduleRef.get(ConsumerService);

    expect(consumer.events).toBeInstanceOf(RealtimeEventsService);
  });
});
