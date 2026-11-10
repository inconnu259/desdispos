import { Global, Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { RealtimeEventsService } from './realtime-events.service';
import { RealtimeController } from './realtime.controller';

@Global()
@Module({
  imports: [PermissionsModule],
  controllers: [RealtimeController],
  providers: [RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeModule {}
