import 'reflect-metadata';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Orden de carga de configuración.
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
 * (después de fijar las variables).
 */
const CORS_ORIGINS_VALUE = 'https://shop.example';

const previousCorsOrigins = process.env.CORS_ORIGINS;

process.env.CORS_ORIGINS = CORS_ORIGINS_VALUE;

type CreateAppFn = (typeof import('./create-app'))['createApp'];

const ALLOWED_ORIGIN = 'https://shop.example';
const DISALLOWED_ORIGIN = 'https://evil.example';
const HEALTH_PATH_API = '/api/health';
const HEALTH_PATH_NO_PREFIX = '/health';
const NOT_FOUND_PATH_API = '/api/nope';
const CORS_VARY_HEADER = 'Origin';
const SECRET_SENTINEL = 'XYZ';
const E2E_SENTINEL = 'E2E_SENTINEL';
const PAYLOAD_LARGE_SIZE_BYTES = 2 * 1024 * 1024; // > 1MB
const LARGE_PAYLOAD_BUFFER = Buffer.alloc(PAYLOAD_LARGE_SIZE_BYTES, 'a');

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
  const startedApp = await startApp();
  await startedApp.init();
});

afterAll(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
  restoreEnvVariable('CORS_ORIGINS', previousCorsOrigins);
});

describe('createApp end-to-end baseline', () => {
  it('responds 200 with the health payload and no X-Powered-By header', async () => {
    if (!app) {
      throw new Error('App not initialized');
    }
    const server = app.getHttpServer();
    const response = await request(server).get(HEALTH_PATH_API);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('does not serve routes outside the global prefix', async () => {
    if (!app) {
      throw new Error('App not initialized');
    }
    const server = app.getHttpServer();
    const response = await request(server).get(HEALTH_PATH_NO_PREFIX);

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('returns 404 problem+json without leaking the query secret', async () => {
    if (!app) {
      throw new Error('App not initialized');
    }
    const server = app.getHttpServer();
    const response = await request(server).get(`${NOT_FOUND_PATH_API}?secret=${SECRET_SENTINEL}`);

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const responseText = response.text ?? '';
    const responseBodyString = JSON.stringify(response.body ?? {});

    expect(responseText).not.toContain(SECRET_SENTINEL);
    expect(responseBodyString).not.toContain(SECRET_SENTINEL);
  });

  it('sets baseline security headers on success and error responses', async () => {
    if (!app) {
      throw new Error('App not initialized');
    }
    const server = app.getHttpServer();

    const successResponse = await request(server).get(HEALTH_PATH_API);
    const errorResponse = await request(server).get(NOT_FOUND_PATH_API);

    expect(successResponse.status).toBe(200);
    expect(successResponse.headers['x-content-type-options']).toBe('nosniff');
    expect(successResponse.headers['referrer-policy']).toBe('no-referrer');

    expect(errorResponse.status).toBe(404);
    expect(errorResponse.headers['content-type']).toContain('application/problem+json');
    expect(errorResponse.headers['x-content-type-options']).toBe('nosniff');
    expect(errorResponse.headers['referrer-policy']).toBe('no-referrer');
  });

  it('reflects the allowed origin and Vary: Origin', async () => {
    if (!app) {
      throw new Error('App not initialized');
    }
    const server = app.getHttpServer();
    const response = await request(server).get(HEALTH_PATH_API).set('Origin', ALLOWED_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(response.headers['vary']).toContain(CORS_VARY_HEADER);
  });

  it('omits the allow-origin header for a disallowed origin while responding 200', async () => {
    if (!app) {
      throw new Error('App not initialized');
    }
    const server = app.getHttpServer();
    const response = await request(server).get(HEALTH_PATH_API).set('Origin', DISALLOWED_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['vary']).toContain(CORS_VARY_HEADER);
  });

  it('maps an oversized body to 413 problem+json', async () => {
    if (!app) {
      throw new Error('App not initialized');
    }
    const server = app.getHttpServer();
    const response = await request(server)
      .post(NOT_FOUND_PATH_API)
      .set('Content-Type', 'application/json')
      .send(LARGE_PAYLOAD_BUFFER);

    expect(response.status).toBe(413);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('maps malformed JSON to 400 problem+json without echoing the body', async () => {
    if (!app) {
      throw new Error('App not initialized');
    }
    const server = app.getHttpServer();
    const malformedJson = `{ ${E2E_SENTINEL} :`;
    const response = await request(server)
      .post(NOT_FOUND_PATH_API)
      .set('Content-Type', 'application/json')
      .set('Content-Length', String(Buffer.byteLength(malformedJson, 'utf8')))
      .send(malformedJson);

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const responseText = response.text ?? '';
    const responseBodyString = JSON.stringify(response.body ?? {});

    expect(responseText).not.toContain(E2E_SENTINEL);
    expect(responseBodyString).not.toContain(E2E_SENTINEL);
  });
});
