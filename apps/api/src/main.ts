import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.enableCors({ origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()), credentials: true });

  const config = new DocumentBuilder()
    .setTitle('Pilotage API')
    .setDescription('Operator console API (M1–M12). Auth: Cognito JWT or dev bypass.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc); // Swagger UI + /docs-json (feeds api-client)

  await app.listen(env.API_PORT);
  new Logger('Bootstrap').log(`Pilotage API on http://localhost:${env.API_PORT} (docs: /docs)`);
}

void bootstrap();
