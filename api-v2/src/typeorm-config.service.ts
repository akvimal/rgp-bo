import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor() {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const logSql = process.env.LOG_SQL === 'true';

    return {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      dropSchema: false,
      keepConnectionAlive: true,
      logging: logSql ? 'all' : false,
      logger: logSql ? 'advanced-console' : 'simple-console',
      entities: ['**/*.entity.js'],
      cli: {
        entitiesDir: 'src',
        subscribersDir: 'subscriber',
      },
      extra: {
        // based on https://node-postgres.com/api/pool
        // max connection pool size
        max: 100,
        ssl: false,
        // Log all queries at the pg driver level (including manager.query())
        ...(logSql && {
          log: (msg: string) => console.log('[PG]', msg),
        }),
      },
    } as TypeOrmModuleOptions;
  }
}
