import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

interface ConnectionState {
  roomId: string;
  username: string;
  removedFromActiveUsers: boolean;
}

@Injectable()
export class PresenceService {
  constructor(private readonly redisService: RedisService) {}

  async addConnection(
    socketId: string,
    roomId: string,
    username: string,
  ): Promise<{ addedToActiveUsers: boolean }> {
    const tx = await this.redisService.client
      .multi()
      .sadd(this.roomSocketsKey(roomId), socketId)
      .hset(this.socketKey(socketId), {
        roomId,
        username,
      })
      .sadd(this.roomUserSocketsKey(roomId, username), socketId)
      .sadd(this.activeUsersKey(roomId), username)
      .exec();

    const addedToActiveUsers = Number(tx?.[3]?.[1] ?? 0) === 1;
    return { addedToActiveUsers };
  }

  async removeConnection(socketId: string): Promise<ConnectionState | null> {
    const state = await this.redisService.client.hgetall(this.socketKey(socketId));
    if (!state.roomId || !state.username) {
      return null;
    }

    const { roomId, username } = state;
    const userSocketsKey = this.roomUserSocketsKey(roomId, username);

    await this.redisService.client
      .multi()
      .del(this.socketKey(socketId))
      .srem(this.roomSocketsKey(roomId), socketId)
      .srem(userSocketsKey, socketId)
      .exec();

    const remaining = await this.redisService.client.scard(userSocketsKey);
    let removedFromActiveUsers = false;
    if (remaining === 0) {
      await this.redisService.client.multi().del(userSocketsKey).srem(this.activeUsersKey(roomId), username).exec();
      removedFromActiveUsers = true;
    }

    return {
      roomId,
      username,
      removedFromActiveUsers,
    };
  }

  async getActiveUsers(roomId: string): Promise<string[]> {
    const members = await this.redisService.client.smembers(this.activeUsersKey(roomId));
    return members.sort();
  }

  private socketKey(socketId: string): string {
    return `socket:${socketId}`;
  }

  private activeUsersKey(roomId: string): string {
    return `room:${roomId}:active_users`;
  }

  private roomSocketsKey(roomId: string): string {
    return `room:${roomId}:sockets`;
  }

  private roomUserSocketsKey(roomId: string, username: string): string {
    return `room:${roomId}:user:${username}:sockets`;
  }
}
