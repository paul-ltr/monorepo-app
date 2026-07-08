import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@codegenie/serverless-express';
import express from 'express';
import type { Handler } from 'aws-lambda';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

/**
 * AWS Lambda entrypoint. The same NestJS app runs behind API Gateway HTTP API
 * via serverless-express. Because Nest sits behind a standard HTTP adapter, the
 * identical code can move to ECS Fargate/App Runner later without a rewrite
 * (see ARCHITECTURE.md). The bootstrapped handler is cached across invocations.
 */
let cached: Handler | undefined;

async function bootstrap(): Promise<Handler> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bufferLogs: false });
  const env = loadEnv();
  app.enableCors({ origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()), credentials: true });
  await app.init();
  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (event, context, callback) => {
  cached ??= await bootstrap();
  return cached(event, context, callback);
};
