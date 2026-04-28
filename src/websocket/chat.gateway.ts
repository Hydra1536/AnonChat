import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { eq } from 'drizzle-orm';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { SessionService } from '../auth/session.service';
import { DatabaseService } from '../database/database.service';
import { roomsTable } from '../database/schema';
import { RedisService } from '../redis/redis.service';
import {
  MessageNewEvent,
  REALTIME_CHANNELS,
  RoomDeletedEvent,
} from './realtime-events.service';
import { PresenceService } from './presence.service';

interface ChatSocketData {
  roomId: string;
  username: string;
}

@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private subscriber?: Redis;

  constructor(
    private readonly sessionService: SessionService,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly presenceService: PresenceService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redisService.duplicate();
    await this.connectRedisClient(this.subscriber);

    await this.subscriber.subscribe(REALTIME_CHANNELS.MESSAGE_NEW, REALTIME_CHANNELS.ROOM_DELETED);
    this.subscriber.on('message', (channel: string, payload: string) => {
      void this.handleRealtimeMessage(channel, payload);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) {
      return;
    }
    if (
      this.subscriber.status === 'ready' ||
      this.subscriber.status === 'connect' ||
      this.subscriber.status === 'connecting'
    ) {
      await this.subscriber.quit();
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.queryParam(client, 'token');
    const roomId = this.queryParam(client, 'roomId');

    if (!token) {
      this.disconnectWithCode(client, 401, 'Missing or expired session token');
      return;
    }

    if (!roomId) {
      this.disconnectWithCode(client, 404, 'Room does not exist');
      return;
    }

    const session = await this.sessionService.getSession(token);
    if (!session) {
      this.disconnectWithCode(client, 401, 'Missing or expired session token');
      return;
    }

    const room = await this.databaseService.db.query.roomsTable.findFirst({
      where: eq(roomsTable.id, roomId),
      columns: { id: true },
    });
    if (!room) {
      this.disconnectWithCode(client, 404, `Room with id ${roomId} does not exist`);
      return;
    }

    const data: ChatSocketData = {
      roomId,
      username: session.username,
    };
    client.data = data;

    await client.join(roomId);
    const presenceResult = await this.presenceService.addConnection(client.id, roomId, session.username);
    const activeUsers = await this.presenceService.getActiveUsers(roomId);

    client.emit('room:joined', { activeUsers });
    if (presenceResult.addedToActiveUsers) {
      client.to(roomId).emit('room:user_joined', {
        username: session.username,
        activeUsers,
      });
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const removed = await this.presenceService.removeConnection(client.id);
    if (!removed) {
      return;
    }
    if (removed.removedFromActiveUsers) {
      const activeUsers = await this.presenceService.getActiveUsers(removed.roomId);
      client.to(removed.roomId).emit('room:user_left', {
        username: removed.username,
        activeUsers,
      });
    }
  }

  @SubscribeMessage('room:leave')
  async onRoomLeave(@ConnectedSocket() client: Socket, @MessageBody() _body: unknown): Promise<void> {
    client.disconnect(true);
  }

  private queryParam(client: Socket, key: string): string | undefined {
    const raw = client.handshake.query[key];
    if (typeof raw === 'string') {
      return raw;
    }
    if (Array.isArray(raw)) {
      return raw[0];
    }
    return undefined;
  }

  private disconnectWithCode(client: Socket, code: 401 | 404, message: string): void {
    client.emit('error', { code, message });
    client.disconnect(true);
  }

  private async handleRealtimeMessage(channel: string, rawPayload: string): Promise<void> {
    if (channel === REALTIME_CHANNELS.MESSAGE_NEW) {
      const payload = JSON.parse(rawPayload) as MessageNewEvent;
      this.server.to(payload.roomId).emit('message:new', {
        id: payload.id,
        username: payload.username,
        content: payload.content,
        createdAt: payload.createdAt,
      });
      return;
    }

    if (channel === REALTIME_CHANNELS.ROOM_DELETED) {
      const payload = JSON.parse(rawPayload) as RoomDeletedEvent;
      this.server.to(payload.roomId).emit('room:deleted', { roomId: payload.roomId });
      this.server.in(payload.roomId).disconnectSockets(true);
    }
  }

  private async connectRedisClient(client: Redis): Promise<void> {
    if (client.status === 'ready') {
      return;
    }
    if (client.status === 'connect' || client.status === 'connecting') {
      await new Promise<void>((resolve) => client.once('ready', () => resolve()));
      return;
    }
    await client.connect();
  }
}
