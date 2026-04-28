import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export const REALTIME_CHANNELS = {
  MESSAGE_NEW: 'chat:message_new',
  ROOM_DELETED: 'chat:room_deleted',
} as const;

export interface MessageNewEvent {
  id: string;
  roomId: string;
  username: string;
  content: string;
  createdAt: string;
}

export interface RoomDeletedEvent {
  roomId: string;
}

@Injectable()
export class RealtimeEventsService {
  constructor(private readonly redisService: RedisService) {}

  async publishMessageNew(payload: MessageNewEvent): Promise<void> {
    await this.redisService.client.publish(REALTIME_CHANNELS.MESSAGE_NEW, JSON.stringify(payload));
  }

  async publishRoomDeleted(payload: RoomDeletedEvent): Promise<void> {
    await this.redisService.client.publish(REALTIME_CHANNELS.ROOM_DELETED, JSON.stringify(payload));
  }
}
