import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';

export interface SessionData {
  userId: string;
  username: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async createSession(payload: SessionData): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const ttlSeconds = this.configService.get<number>('SESSION_TTL_SECONDS', 86400);
    const key = this.getSessionKey(token);
    await this.redisService.client.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
    return token;
  }

  async getSession(token: string): Promise<SessionData | null> {
    const key = this.getSessionKey(token);
    const raw = await this.redisService.client.get(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  private getSessionKey(token: string): string {
    return `session:${token}`;
  }
}
