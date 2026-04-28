import { Inject, Injectable } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

@Injectable()
export class DatabaseService {
  readonly db: NodePgDatabase<typeof schema>;

  constructor(@Inject('PG_POOL') private readonly pool: Pool) {
    this.db = drizzle(this.pool, { schema });
  }
}
