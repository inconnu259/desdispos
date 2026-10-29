import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PartiesModule } from './parties/parties.module';
import { InvitationsModule } from './invitations/invitations.module';
import { AvailabilityModule } from './availability/availability.module';
import { PollModule } from './poll/poll.module';
import { GameSystemModule } from './game-systems/game-system.module';
import { CharacterModule } from './characters/character.module';
import { HommeDragonModule } from './homme-dragon/homme-dragon.module';
import { XpDistributionsModule } from './xp-distributions/xp-distributions.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ScenariosModule } from './scenarios/scenarios.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { CharacterRolesModule } from './character-roles/character-roles.module';
import { AccountModule } from './account/account.module';
import { BoardGamesModule } from './board-games/board-games.module';
import { PortsModule } from './ports/ports.module';

@Module({
  imports: [
    // Garde-fou global : 300 req/min/IP. Les routes sensibles (login/register/refresh) ont leur
    // propre @Throttle plus strict (auth.controller.ts, 5/min) — ce plafond global protège le
    // reste de l'API sans pénaliser un usage normal : une seule page (ex. calendar-view) émet déjà
    // 5+ GET au chargement, et un événement temps réel (RealtimeService) fait fan-out vers jusqu'à
    // 6 services de domaine, chacun potentiellement rechargé par plusieurs composants montés
    // simultanément — l'ancien plafond de 20/min était atteint en quelques secondes d'usage normal
    // (bug : 429 en boucle sur GET /parties/:id/scenarios, "impossible de charger la chronologie").
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RealtimeModule,
    HealthModule,
    UsersModule,
    AuthModule,
    PartiesModule,
    InvitationsModule,
    AvailabilityModule,
    PollModule,
    GameSystemModule,
    CharacterModule,
    HommeDragonModule,
    XpDistributionsModule,
    EmailModule,
    NotificationsModule,
    ScenariosModule,
    AnnouncementsModule,
    CharacterRolesModule,
    AccountModule,
    // Story 48.1 : la Ludothèque (couche 2, seul écrivain de `BoardGame`).
    BoardGamesModule,
    // Story 37.8 : lie les ports de la couche 1 à leurs implémentations (module global).
    PortsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
