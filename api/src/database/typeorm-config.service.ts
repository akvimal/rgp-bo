import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      dropSchema: false,
      keepConnectionAlive: true,
      logging: this.configService.get('NODE_ENV') !== 'production',
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
          ? {
            rejectUnauthorized: false,
            ca: this.configService.get('database.ca')
              ? this.configService.get('database.ca')
              : null,
            key: this.configService.get('database.key')
              ? this.configService.get('database.key')
              : null,
            cert: this.configService.get('database.cert')
              ? this.configService.get('database.cert')
              : null,
          }
          : false,
      },
    } as TypeOrmModuleOptions;
  }
}
