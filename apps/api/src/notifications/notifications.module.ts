import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { EventsModule } from '../events/events.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [EmailModule, EventsModule],
  providers: [NotificationsService],
})
export class NotificationsModule {}
