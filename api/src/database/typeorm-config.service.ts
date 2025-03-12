import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor() {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
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
        ssl: false
      },
    } as TypeOrmModuleOptions;
  }
}
