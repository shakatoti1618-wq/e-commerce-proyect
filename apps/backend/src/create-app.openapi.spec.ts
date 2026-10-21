import 'reflect-metadata';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Documentación OpenAPI montada CON el flag `ENABLE_SWAGGER=true`.
 *
 * Este caso vive en su PROPIO archivo por el motivo documentado en
 * `create-app.security.spec.ts`: `ConfigModule.forRoot()` valida y congela la
 * configuración al importar el módulo (con `cache: true`), por lo que la
 * variable debe fijarse ANTES de importar `./create-app`. Como los `import`
 * estáticos se hoistean, se usa un `import()` dinámico dentro de `beforeAll`
 * y el valor no puede cambiar entre tests del mismo archivo.
 */
const previousEnableSwagger = process.env.ENABLE_SWAGGER;

process.env.ENABLE_SWAGGER = 'true';

type CreateAppFn = (typeof import('./create-app'))['createApp'];

const SWAGGER_UI_PATH = '/api/docs';

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
  if (previousEnableSwagger === undefined) {
    delete process.env.ENABLE_SWAGGER;
  } else {
    process.env.ENABLE_SWAGGER = previousEnableSwagger;
  }
});

describe('createApp OpenAPI documentation', () => {
  it('serves the Swagger UI with 200 when ENABLE_SWAGGER is true', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    // OBSERVACIÓN (verificado empíricamente): `@nestjs/swagger` con el adaptador
    // Express responde 200 directamente en `/api/docs` (sin redirección 301/302
    // a la versión con barra final).
    const response = await request(startedApp.getHttpServer()).get(SWAGGER_UI_PATH);

    expect(response.status).toBe(200);
  });
});
