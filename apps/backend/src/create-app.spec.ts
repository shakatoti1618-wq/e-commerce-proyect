import 'reflect-metadata';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { createApp } from './create-app';

const NOT_FOUND_PATH = '/api/nope';
const SWAGGER_UI_PATH = '/api/docs';
const LEAK_SENTINEL = 'XYZ';

/**
 * Request con el cuerpo crudo que Nest añade cuando la app se crea con
 * `rawBody: true`. Se tipa localmente porque el proyecto no depende de
 * `@types/express`.
 */
interface RawBodyRequest {
  rawBody?: Buffer;
}

let app: NestExpressApplication | undefined;

async function startApp(): Promise<NestExpressApplication> {
  const createdApp = await createApp();

  app = createdApp;

  return createdApp;
}

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe('createApp', () => {
  it('responds 404 as application/problem+json without leaking the query secret', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const response = await request(startedApp.getHttpServer()).get(
      `${NOT_FOUND_PATH}?secret=${LEAK_SENTINEL}`,
    );

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.text).not.toContain(LEAK_SENTINEL);
    expect(JSON.stringify(response.body)).not.toContain(LEAK_SENTINEL);
  });

  it('does not expose the Swagger UI route when ENABLE_SWAGGER is not set', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const response = await request(startedApp.getHttpServer()).get(SWAGGER_UI_PATH);

    expect(response.status).toBe(404);
  });

  it('exposes the raw body buffer so signatures can be verified', async () => {
    const startedApp = await startApp();

    let capturedRawBody: Buffer | undefined;

    startedApp.use((req: RawBodyRequest, _res: unknown, next: () => void) => {
      capturedRawBody = req.rawBody;
      next();
    });

    await startedApp.init();

    const payload = { message: 'raw-body-check' };
    const expectedRawBody = JSON.stringify(payload);

    await request(startedApp.getHttpServer())
      .post(NOT_FOUND_PATH)
      .set('Content-Type', 'application/json')
      .send(expectedRawBody);

    expect(capturedRawBody).toBeInstanceOf(Buffer);
    expect(capturedRawBody?.toString('utf8')).toBe(expectedRawBody);
  });
});
