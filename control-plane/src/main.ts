import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  for (const k of ['DATABASE_URL', 'PG_ADMIN_URL', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET']) {
    if (!process.env[k]) throw new Error(`${k} is not set`);
  }
  if (String(process.env.ADMIN_PASSWORD).length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(__dirname, '..', 'public'));
  await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
}
bootstrap();
