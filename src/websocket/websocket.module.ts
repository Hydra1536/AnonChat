import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatGateway } from './chat.gateway';
import { PresenceService } from './presence.service';
import { RealtimeEventsService } from './realtime-events.service';

@Module({
  imports: [AuthModule],
  providers: [ChatGateway, PresenceService, RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class WebsocketModule {}
