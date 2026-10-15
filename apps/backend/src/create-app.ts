import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

/**
 * Límite global conservador para el JSON body parser (1 MB).
 *
 * El parser global se registra aquí (antes de `init()`) mediante
 * `useBodyParser`, de modo que el adaptador NO vuelve a registrar el suyo por
 * defecto y el límite sí aplica. Al crear la app con `rawBody: true`, Nest añade
 * internamente un `verify` que deja el cuerpo crudo disponible en `req.rawBody`.
 *
 * Para el webhook de Wompi (M9) se necesitará verificar la firma sobre el
 * **raw body** (Buffer) con un límite mayor (`WEBHOOK_RAW_BODY_LIMIT`, 5 MB,
 * exportado desde `zod.dto.ts`). En M9 se decidirá si registrar un parser
 * dedicado en esa ruta en lugar de reutilizar este límite global.
 *
 * NO se monta aquí porque el webhook no existe en M3.
 */
const GLOBAL_BODY_LIMIT = '1mb';

/**
 * Construye la aplicación NestExpress SIN escuchar en ningún puerto.
 *
 * Se separa de `bootstrap()` (en `main.ts`) para que los tests puedan importar
 * esta fábrica y montar la app real sin arrancar el servidor HTTP.
 */
export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');

  // Body parser global con límite conservador.
  app.useBodyParser('json', { limit: GLOBAL_BODY_LIMIT });

  return app;
}
