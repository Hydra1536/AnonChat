import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DatabaseBootstrapService } from './database-bootstrap.service';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    {
      provide: 'PG_POOL',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool => {
        return new Pool({
          connectionString: configService.getOrThrow<string>('DATABASE_URL'),
        });
      },
    },
    DatabaseService,
    DatabaseBootstrapService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
