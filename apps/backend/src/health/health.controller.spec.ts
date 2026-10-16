import 'reflect-metadata';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { createApp } from '../create-app';

const HEALTH_PATH = '/api/health';

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

describe('HealthController', () => {
  it('responds 200 with exactly { status: "ok" } on GET /api/health', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const response = await request(startedApp.getHttpServer()).get(HEALTH_PATH);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });

    // `body` está tipado como `unknown` en la declaración local de supertest;
    // se estrecha aquí para comprobar que no llegan claves extra.
    const parsedBody = response.body as Record<string, unknown>;

    expect(Object.keys(parsedBody)).toEqual(['status']);
  });
});
