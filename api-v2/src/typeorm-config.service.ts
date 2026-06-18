import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor() {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const sslEnabled = ['true', '1', 'require'].includes(
      (process.env.DATABASE_SSL || process.env.PGSSLMODE || '').toLowerCase()
    );

    return {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      dropSchema: false,
      keepConnectionAlive: true,
      logging: process.env.LOG_SQL === 'true',
      entities: ['**/*.entity.js'],
      cli: {
        entitiesDir: 'src',
        subscribersDir: 'subscriber',
      },
      extra: {
        // based on https://node-postgres.com/api/pool
        // max connection pool size
        max: 100,
        ssl: sslEnabled ? { rejectUnauthorized: false } : false
      },
    } as TypeOrmModuleOptions;
  }
}
