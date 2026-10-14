import 'reflect-metadata';

import { json } from 'express';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { reportBootstrapFailure } from './bootstrap-failure';

/**
 * Límite global conservador para JSON body parser (1 MB).
 *
 * Para el webhook de Wompi (M9) se necesitará acceso al **raw body** (Buffer)
 * ANTES de que el JSON parser lo consuma, con un límite mayor (5 MB).
 * El patrón estándar en Nest/Express es:
 *
 *   app.use(
 *     '/api/webhooks/wompi',
 *     express.raw({
 *       type: 'application/json',
 *       limit: '5mb',
 *       verify: (req, _res, buf) => { req.rawBody = buf; },
 *     }),
 *   );
 *
 * NO se monta aquí porque el webhook no existe en M3.
 * La constante `WEBHOOK_RAW_BODY_LIMIT` se exporta desde `zod.dto.ts`
 * para que M9 la use sin buscar valores mágicos.
 */
const GLOBAL_BODY_LIMIT = '1mb';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');

  // Body parser global con límite conservador
  app.use(json({ limit: GLOBAL_BODY_LIMIT }));

  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port);
}

bootstrap().catch((error: unknown) =>
  reportBootstrapFailure(
    error,
    (m) => process.stderr.write(m),
    (code) => process.exit(code),
  ),
);
