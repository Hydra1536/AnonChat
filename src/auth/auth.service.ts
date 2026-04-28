import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { usersTable } from '../database/schema';
import { prefixedId } from '../shared/prefixed-id';
import { toIsoString } from '../shared/to-iso-string';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly sessionService: SessionService,
  ) {}

  async login(username: string): Promise<{
    sessionToken: string;
    user: {
      id: string;
      username: string;
      createdAt: string;
    };
  }> {
    const normalizedUsername = username.trim();
    let user = await this.databaseService.db.query.usersTable.findFirst({
      where: eq(usersTable.username, normalizedUsername),
    });

    if (!user) {
      const [created] = await this.databaseService.db
        .insert(usersTable)
        .values({
          id: prefixedId('usr'),
          username: normalizedUsername,
        })
        .returning();
      user = created;
    }

    const sessionToken = await this.sessionService.createSession({
      userId: user.id,
      username: user.username,
    });

    return {
      sessionToken,
      user: {
        id: user.id,
        username: user.username,
        createdAt: toIsoString(user.createdAt),
      },
    };
  }
}
