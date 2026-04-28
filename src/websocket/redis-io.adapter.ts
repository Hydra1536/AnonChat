import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';
import { RedisService } from '../redis/redis.service';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisService = this.app.get(RedisService);
    const pubClient = redisService.duplicate();
    const subClient = redisService.duplicate();
    await Promise.all([this.connectRedisClient(pubClient), this.connectRedisClient(subClient)]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  override createIOServer(port: number, options?: ServerOptions): ReturnType<IoAdapter['createIOServer']> {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
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
