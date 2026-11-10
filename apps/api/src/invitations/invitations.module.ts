import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { PartiesModule } from '../parties/parties.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { EmailModule } from '../email/email.module';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { InviteLinksService } from './invite-links.service';
import { InviteLinksController } from './invite-links.controller';

// PrismaService est global ; on réutilise PartiesService (vérifs MJ/appartenance).
@Module({
  imports: [PartiesModule, PermissionsModule, EmailModule, EventsModule],
  controllers: [InvitationsController, InviteLinksController],
  providers: [InvitationsService, InviteLinksService],
  exports: [InviteLinksService], // consommé par AuthService (inscription sur invitation)
})
export class InvitationsModule {}
