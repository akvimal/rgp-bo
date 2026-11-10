// Crypto polyfill for Node.js 16 compatibility
// Node 16 doesn't have global crypto, so we need to polyfill it
import { webcrypto } from 'crypto';
if (!global.crypto) {
  (global as any).crypto = webcrypto;
}

import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './core/http-exception.filter';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  // Nest's own body parsers are switched off and set up again here, because a parser added by hand makes Nest skip its defaults.
  // A business setup file (many stores and logins) is larger than the default 100 kb body: only that route takes more.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use('/config-profile', json({ limit: '5mb' }));
  // WhatsApp (Meta) signs the exact bytes it sends, so that one route keeps the raw body beside the parsed one
  app.use('/whatsapp/webhook', json({ verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf; } }));
  app.use(json());
  app.use(urlencoded({ extended: true }));
  const logger = new Logger('Bootstrap');

  // Enable CORS and allow the frontend to inspect response timing data.
  app.enableCors({
    exposedHeaders: [
      'x-request-id',
      'x-api-duration-ms',
      'x-db-duration-ms',
      'x-db-query-count',
      'server-timing',
    ],
  });

  // Global exception filter for consistent error handling
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('API V2')
    .setDescription('API Project')
    .setVersion('2.0')
    .addTag('api')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api`);
}
bootstrap();
