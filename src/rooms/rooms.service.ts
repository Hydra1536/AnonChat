import { HttpStatus, Injectable } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import { AuthenticatedUser } from '../shared/authenticated-request';
import { AppException } from '../shared/app-exception';
import { ERROR_CODES } from '../shared/error-codes';
import { prefixedId } from '../shared/prefixed-id';
import { toIsoString } from '../shared/to-iso-string';
import { DatabaseService } from '../database/database.service';
import { messagesTable, roomsTable, usersTable } from '../database/schema';
import { RedisService } from '../redis/redis.service';
import { RealtimeEventsService } from '../websocket/realtime-events.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async listRooms(): Promise<{
    rooms: Array<{
      id: string;
      name: string;
      createdBy: string;
      activeUsers: number;
      createdAt: string;
    }>;
  }> {
    const rows = await this.databaseService.db
      .select({
        id: roomsTable.id,
        name: roomsTable.name,
        createdBy: usersTable.username,
        createdAt: roomsTable.createdAt,
      })
      .from(roomsTable)
      .innerJoin(usersTable, eq(roomsTable.createdByUserId, usersTable.id))
      .orderBy(roomsTable.createdAt);

    const rooms = await Promise.all(
      rows.map(async (row) => {
        const activeUsers = await this.redisService.client.scard(this.getActiveUsersKey(row.id));
        return {
          id: row.id,
          name: row.name,
          createdBy: row.createdBy,
          activeUsers,
          createdAt: toIsoString(row.createdAt),
        };
      }),
    );

    return { rooms };
  }

  async createRoom(name: string, user: AuthenticatedUser): Promise<{
    id: string;
    name: string;
    createdBy: string;
    createdAt: string;
  }> {
    const normalizedName = name.trim();
    const existing = await this.databaseService.db.query.roomsTable.findFirst({
      where: eq(roomsTable.name, normalizedName),
    });

    if (existing) {
      throw new AppException(HttpStatus.CONFLICT, ERROR_CODES.ROOM_NAME_TAKEN, 'A room with this name already exists');
    }

    const [created] = await this.databaseService.db
      .insert(roomsTable)
      .values({
        id: prefixedId('room'),
        name: normalizedName,
        createdByUserId: user.id,
      })
      .returning();

    return {
      id: created.id,
      name: created.name,
      createdBy: user.username,
      createdAt: toIsoString(created.createdAt),
    };
  }

  async getRoom(roomId: string): Promise<{
    id: string;
    name: string;
    createdBy: string;
    activeUsers: number;
    createdAt: string;
  }> {
    const room = await this.findRoomWithCreator(roomId);
    const activeUsers = await this.redisService.client.scard(this.getActiveUsersKey(room.id));
    return {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      activeUsers,
      createdAt: toIsoString(room.createdAt),
    };
  }

  async deleteRoom(roomId: string, requester: AuthenticatedUser): Promise<{ deleted: true }> {
    const room = await this.findRoomWithCreator(roomId);
    if (room.createdByUserId !== requester.id) {
      throw new AppException(HttpStatus.FORBIDDEN, ERROR_CODES.FORBIDDEN, 'Only the room creator can delete this room');
    }

    await this.realtimeEventsService.publishRoomDeleted({ roomId });
    await this.databaseService.db.delete(roomsTable).where(eq(roomsTable.id, roomId));

    await this.redisService.client.del(
      this.getActiveUsersKey(roomId),
      this.getRoomSocketsKey(roomId),
    );

    return { deleted: true };
  }

  async listMessages(
    roomId: string,
    limit = 50,
    before?: string,
  ): Promise<{
    messages: Array<{
      id: string;
      roomId: string;
      username: string;
      content: string;
      createdAt: string;
    }>;
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    await this.assertRoomExists(roomId);

    const sanitizedLimit = Math.min(Math.max(limit, 1), 100);
    let cursorDate: Date | undefined;

    if (before) {
      const cursor = await this.databaseService.db.query.messagesTable.findFirst({
        where: and(eq(messagesTable.id, before), eq(messagesTable.roomId, roomId)),
      });
      if (cursor) {
        cursorDate = cursor.createdAt;
      }
    }

    const whereCondition = cursorDate
      ? and(eq(messagesTable.roomId, roomId), lt(messagesTable.createdAt, cursorDate))
      : eq(messagesTable.roomId, roomId);

    const rows = await this.databaseService.db
      .select({
        id: messagesTable.id,
        roomId: messagesTable.roomId,
        username: usersTable.username,
        content: messagesTable.content,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .innerJoin(usersTable, eq(messagesTable.userId, usersTable.id))
      .where(whereCondition)
      .orderBy(desc(messagesTable.createdAt))
      .limit(sanitizedLimit + 1);

    const hasMore = rows.length > sanitizedLimit;
    const sliced = hasMore ? rows.slice(0, sanitizedLimit) : rows;

    const messages = sliced.map((row) => ({
      id: row.id,
      roomId: row.roomId,
      username: row.username,
      content: row.content,
      createdAt: toIsoString(row.createdAt),
    }));

    const nextCursor = hasMore ? messages[messages.length - 1]?.id ?? null : null;

    return {
      messages,
      hasMore,
      nextCursor,
    };
  }

  async createMessage(roomId: string, content: string, user: AuthenticatedUser): Promise<{
    id: string;
    roomId: string;
    username: string;
    content: string;
    createdAt: string;
  }> {
    await this.assertRoomExists(roomId);
    const normalizedContent = content.trim();

    if (normalizedContent.length < 1) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODES.MESSAGE_EMPTY, 'Message content cannot be empty');
    }
    if (normalizedContent.length > 1000) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ERROR_CODES.MESSAGE_TOO_LONG,
        'Message content must not exceed 1000 characters',
      );
    }

    const [created] = await this.databaseService.db
      .insert(messagesTable)
      .values({
        id: prefixedId('msg'),
        roomId,
        userId: user.id,
        content: normalizedContent,
      })
      .returning();

    const payload = {
      id: created.id,
      roomId: created.roomId,
      username: user.username,
      content: created.content,
      createdAt: toIsoString(created.createdAt),
    };

    await this.realtimeEventsService.publishMessageNew(payload);

    return payload;
  }

  private async findRoomWithCreator(roomId: string): Promise<{
    id: string;
    name: string;
    createdBy: string;
    createdByUserId: string;
    createdAt: Date;
  }> {
    const row = await this.databaseService.db
      .select({
        id: roomsTable.id,
        name: roomsTable.name,
        createdBy: usersTable.username,
        createdByUserId: roomsTable.createdByUserId,
        createdAt: roomsTable.createdAt,
      })
      .from(roomsTable)
      .innerJoin(usersTable, eq(roomsTable.createdByUserId, usersTable.id))
      .where(eq(roomsTable.id, roomId))
      .limit(1);

    const room = row[0];
    if (!room) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ROOM_NOT_FOUND,
        `Room with id ${roomId} does not exist`,
      );
    }
    return room;
  }

  async assertRoomExists(roomId: string): Promise<void> {
    const room = await this.databaseService.db.query.roomsTable.findFirst({
      where: eq(roomsTable.id, roomId),
      columns: { id: true },
    });
    if (!room) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ROOM_NOT_FOUND,
        `Room with id ${roomId} does not exist`,
      );
    }
  }

  private getActiveUsersKey(roomId: string): string {
    return `room:${roomId}:active_users`;
  }

  private getRoomSocketsKey(roomId: string): string {
    return `room:${roomId}:sockets`;
  }
}
