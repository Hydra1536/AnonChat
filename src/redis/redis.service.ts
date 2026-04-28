import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') readonly client: Redis) {}

  duplicate(): Redis {
    return this.client.duplicate();
  }
}
