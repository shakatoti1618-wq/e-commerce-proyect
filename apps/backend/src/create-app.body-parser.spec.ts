import 'reflect-metadata';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { createApp } from './create-app';

const NOT_FOUND_PATH = '/api/nope';
const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';
const NOSNIFF_HEADER_VALUE = 'nosniff';

/**
 * Centinela reconocible dentro del JSON mal formado: si el `detail` reflejara
 * fragmentos del cuerpo enviado, este texto aparecería en la respuesta.
 */
const MALFORMED_BODY_SENTINEL = 'malformed-json-SENTINEL';
const MALFORMED_JSON_BODY = `{ ${MALFORMED_BODY_SENTINEL} :`;

/** Cuerpo JSON válido pero claramente por encima del límite global (1 MB). */
const OVERSIZED_PAYLOAD_BYTES = 1_100_000;
const OVERSIZED_JSON_BODY = JSON.stringify({ padding: 'a'.repeat(OVERSIZED_PAYLOAD_BYTES) });

const EXPECTED_TOO_LARGE_DETAIL = 'Request body too large';
const EXPECTED_MALFORMED_DETAIL = 'Malformed JSON body';

const URLENCODED_CONTENT_TYPE = 'application/x-www-form-urlencoded';

/** Cuerpo urlencoded válido pero muy por encima del límite (100 KB). */
const OVERSIZED_URLENCODED_PADDING = 'b'.repeat(200_000);
const OVERSIZED_URLENCODED_BODY = `a=${OVERSIZED_URLENCODED_PADDING}`;

/** Cuerpo urlencoded pequeño que el parser debe aceptar sin error. */
const SMALL_URLENCODED_BODY = 'a=b';

/** Vista mínima del cuerpo problem+json para inspeccionar `detail` sin `any`. */
interface ProblemBody {
  detail?: unknown;
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

describe('createApp body-parser error handling', () => {
  it('responds 413 as application/problem+json for an oversized JSON body', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const response = await request(startedApp.getHttpServer())
      .post(NOT_FOUND_PATH)
      .set('Content-Type', 'application/json')
      .send(OVERSIZED_JSON_BODY);

    expect(response.status).toBe(413);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(response.headers['x-content-type-options']).toBe(NOSNIFF_HEADER_VALUE);
    expect((response.body as ProblemBody).detail).toBe(EXPECTED_TOO_LARGE_DETAIL);
  });

  it('responds 400 as application/problem+json without echoing the malformed body', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const response = await request(startedApp.getHttpServer())
      .post(NOT_FOUND_PATH)
      .set('Content-Type', 'application/json')
      .send(MALFORMED_JSON_BODY);

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(response.headers['x-content-type-options']).toBe(NOSNIFF_HEADER_VALUE);
    expect(response.text).not.toContain(MALFORMED_BODY_SENTINEL);
    expect(JSON.stringify(response.body)).not.toContain(MALFORMED_BODY_SENTINEL);
    expect((response.body as ProblemBody).detail).toBe(EXPECTED_MALFORMED_DETAIL);
  });

  it('still responds 404 as application/problem+json for unknown routes', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const response = await request(startedApp.getHttpServer()).get(NOT_FOUND_PATH);

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(response.headers['x-content-type-options']).toBe(NOSNIFF_HEADER_VALUE);
  });

  it('responds 413 as application/problem+json for an oversized urlencoded body', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const response = await request(startedApp.getHttpServer())
      .post(NOT_FOUND_PATH)
      .set('Content-Type', URLENCODED_CONTENT_TYPE)
      .send(OVERSIZED_URLENCODED_BODY);

    expect(response.status).toBe(413);
    expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(response.headers['x-content-type-options']).toBe(NOSNIFF_HEADER_VALUE);
    expect((response.body as ProblemBody).detail).toBe(EXPECTED_TOO_LARGE_DETAIL);
  });

  it('accepts a small urlencoded body without a body-parser error', async () => {
    const startedApp = await startApp();
    await startedApp.init();

    const response = await request(startedApp.getHttpServer())
      .post(NOT_FOUND_PATH)
      .set('Content-Type', URLENCODED_CONTENT_TYPE)
      .send(SMALL_URLENCODED_BODY);

    expect(response.status).toBe(404);
  });
});
