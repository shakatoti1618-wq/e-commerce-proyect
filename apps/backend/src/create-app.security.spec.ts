import 'reflect-metadata';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * OBSERVACIÓN sobre el orden de carga de la configuración.
 *
 * `ConfigModule.forRoot()` (en `app.module.ts`) se evalúa UNA sola vez, al
 * importar el módulo. En ese instante lee `process.env`, valida con el schema y
 * congela el resultado en una closure (`validatedEnvConfig`). Con `cache: true`,
 * recrear la app NO vuelve a leer `process.env`: cada `ConfigService` recibe el
 * mismo objeto validado.
 *
 * Consecuencia práctica: las variables deben fijarse ANTES de importar
 * `./create-app`. Como los `import` estáticos se hoistean por encima de
 * cualquier sentencia, aquí se usa un `import()` dinámico dentro de `beforeAll`
 * (después de fijar las variables) y NO se puede cambiar su valor entre tests
 * del mismo archivo.
 */
const CORS_ORIGINS_VALUE =
  '  HTTPS://Allowed.Example/ , https://allowed.example, * , ,https://second.example ';
const TRUST_PROXY_HOPS_VALUE = '1';

const previousCorsOrigins = process.env.CORS_ORIGINS;
const previousTrustProxyHops = process.env.TRUST_PROXY_HOPS;

process.env.CORS_ORIGINS = CORS_ORIGINS_VALUE;
process.env.TRUST_PROXY_HOPS = TRUST_PROXY_HOPS_VALUE;

type CreateAppFn = (typeof import('./create-app'))['createApp'];

const ALLOWED_ORIGIN = 'https://allowed.example';
const SECOND_ALLOWED_ORIGIN = 'https://second.example';
const DISALLOWED_ORIGIN = 'https://evil.example';
const HEALTH_PATH = '/api/health';
const NOT_FOUND_PATH = '/api/nope';
const EXPECTED_TRUST_PROXY_HOPS = 1;

let createApp: CreateAppFn;
let app: NestExpressApplication | undefined;

function restoreEnvVariable(name: string, previousValue: string | undefined): void {
  if (previousValue === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previousValue;
  }
}

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
  restoreEnvVariable('CORS_ORIGINS', previousCorsOrigins);
  restoreEnvVariable('TRUST_PROXY_HOPS', previousTrustProxyHops);
});

describe('createApp security baseline', () => {
  it('hides X-Powered-By on both success and error responses', async () => {
    const startedApp = await startApp();
    await startedApp.init();
    const server = startedApp.getHttpServer();

    const successResponse = await request(server).get(HEALTH_PATH);
    const errorResponse = await request(server).get(NOT_FOUND_PATH);

    expect(successResponse.status).toBe(200);
    expect(successResponse.headers['x-powered-by']).toBeUndefined();
    expect(errorResponse.status).toBe(404);
    expect(errorResponse.headers['x-powered-by']).toBeUndefined();
  });

  it('sets the baseline security headers on every response', async () => {
    const startedApp = await startApp();
    await startedApp.init();
    const server = startedApp.getHttpServer();

    const successResponse = await request(server).get(HEALTH_PATH);
    const errorResponse = await request(server).get(NOT_FOUND_PATH);

    for (const response of [successResponse, errorResponse]) {
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
    }
  });

  it('allows normalized configured origins and reflects Vary: Origin', async () => {
    const startedApp = await startApp();
    await startedApp.init();
    const server = startedApp.getHttpServer();

    const allowedResponse = await request(server).get(HEALTH_PATH).set('Origin', ALLOWED_ORIGIN);
    const normalizedResponse = await request(server)
      .get(HEALTH_PATH)
      .set('Origin', SECOND_ALLOWED_ORIGIN);

    expect(allowedResponse.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(allowedResponse.headers['vary']).toContain('Origin');
    expect(normalizedResponse.headers['access-control-allow-origin']).toBe(SECOND_ALLOWED_ORIGIN);
  });

  it('rejects origins that are not in the allowlist', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const rejectedResponse = await request(startedApp.getHttpServer())
      .get(HEALTH_PATH)
      .set('Origin', DISALLOWED_ORIGIN);

    expect(rejectedResponse.headers['access-control-allow-origin']).toBeUndefined();
    expect(rejectedResponse.headers['vary']).toContain('Origin');
  });

  it('applies the configured number of trust proxy hops', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const expressInstance = startedApp.getHttpAdapter().getInstance() as {
      get(setting: string): unknown;
    };

    expect(expressInstance.get('trust proxy')).toBe(EXPECTED_TRUST_PROXY_HOPS);
  });
});
