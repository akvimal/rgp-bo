import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      // host: process.env.DATABASE_HOST,
      // port: process.env.DATABASE_PORT,
      // username: process.env.DATABASE_USERNAME,
      // password: process.env.DATABASE_PASSWORD,
      // database: process.env.DATABASE_NAME,
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
