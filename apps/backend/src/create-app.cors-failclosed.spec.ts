import 'reflect-metadata';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Fail-closed de CORS cuando NO queda ningún origen válido.
 *
 * Este caso vive en su PROPIO archivo por el mismo motivo documentado en
 * `create-app.security.spec.ts`: `ConfigModule.forRoot()` valida y congela la
 * configuración al importar el módulo (con `cache: true`), por lo que cambiar
 * `CORS_ORIGINS` entre apps del mismo archivo no surte efecto. Cada archivo de
 * spec corre aislado y puede fijar sus propias variables antes del import.
 *
 * Aquí `CORS_ORIGINS` contiene SOLO ruido: el wildcard `'*'` y entradas vacías.
 * Tras normalizar la lista queda vacía, así que se debe denegar todo origen.
 */
const CORS_ORIGINS_VALUE = '   , *  ,';

const previousCorsOrigins = process.env.CORS_ORIGINS;

process.env.CORS_ORIGINS = CORS_ORIGINS_VALUE;

type CreateAppFn = (typeof import('./create-app'))['createApp'];

const ARBITRARY_ORIGIN = 'https://any.example';
const HEALTH_PATH = '/api/health';

let createApp: CreateAppFn;
let app: NestExpressApplication | undefined;

async function startApp(): Promise<NestExpressApplication> {
  const createdApp = await createApp();

  app = createdApp;

  return createdApp;
}

beforeAll(async () => {
  ({ createApp } = await import('./create-app'));
});

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

afterAll(() => {
  if (previousCorsOrigins === undefined) {
    delete process.env.CORS_ORIGINS;
  } else {
    process.env.CORS_ORIGINS = previousCorsOrigins;
  }
});

describe('createApp CORS fail-closed', () => {
  it('denies every origin when the allowlist normalizes to empty', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const response = await request(startedApp.getHttpServer())
      .get(HEALTH_PATH)
      .set('Origin', ARBITRARY_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
