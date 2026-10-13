import type { IncomingMessage, ServerResponse } from 'node:http';
import { Writable } from 'node:stream';

import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { LOG_CENSOR, LOG_REDACT_PATHS, buildPinoHttpOptions, genReqId } from './logger.config';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEAK_SENTINEL = 'super-secret-leak';

const CLIENT_SUPPLIED_REQUEST_ID = 'client-supplied';

interface RedactedLogRecord {
  req: { headers: { authorization: string; cookie: string } };
  body: { password: string; cardNumber: string; cvv: string; token: string };
}

function createRequestMock(): IncomingMessage {
  return { headers: { 'x-request-id': CLIENT_SUPPLIED_REQUEST_ID } } as unknown as IncomingMessage;
}

function createResponseMock(): {
  response: ServerResponse;
  setHeader: ReturnType<typeof vi.fn>;
} {
  const setHeader = vi.fn();
  const response = { setHeader } as unknown as ServerResponse;

  return { response, setHeader };
}

function captureRedactedLogLine(): string {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });

  const logger = pino(
    { level: 'info', redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_CENSOR } },
    stream,
  );

  logger.info({
    req: { headers: { authorization: LEAK_SENTINEL, cookie: LEAK_SENTINEL } },
    body: {
      password: LEAK_SENTINEL,
      cardNumber: LEAK_SENTINEL,
      cvv: LEAK_SENTINEL,
      token: LEAK_SENTINEL,
    },
  });

  return chunks.join('');
}

describe('genReqId', () => {
  it('generates a server-side UUID v4 and ignores the incoming X-Request-Id', () => {
    const request = createRequestMock();
    const { response, setHeader } = createResponseMock();

    const requestId = genReqId(request, response);

    expect(requestId).not.toBe(CLIENT_SUPPLIED_REQUEST_ID);
    expect(requestId).toMatch(UUID_V4_PATTERN);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', requestId);
  });
});

describe('buildPinoHttpOptions', () => {
  it('defaults the level to info', () => {
    expect(buildPinoHttpOptions().level).toBe('info');
  });

  it('honors the provided level', () => {
    expect(buildPinoHttpOptions('warn').level).toBe('warn');
  });

  it('wires the censor and the server-side request id generator', () => {
    const options = buildPinoHttpOptions();
    const redact = options.redact as { censor: string; paths: string[] };

    expect(redact.censor).toBe(LOG_CENSOR);
    expect(options.genReqId).toBe(genReqId);
  });
});

describe('redaction', () => {
  it('redacts authorization, cookies, credentials and card data', () => {
    const rawLogLine = captureRedactedLogLine();
    const parsed = JSON.parse(rawLogLine) as RedactedLogRecord;

    expect(parsed.req.headers.authorization).toBe(LOG_CENSOR);
    expect(parsed.req.headers.cookie).toBe(LOG_CENSOR);
    expect(parsed.body.password).toBe(LOG_CENSOR);
    expect(parsed.body.cardNumber).toBe(LOG_CENSOR);
    expect(parsed.body.cvv).toBe(LOG_CENSOR);
    expect(parsed.body.token).toBe(LOG_CENSOR);
    expect(rawLogLine).not.toContain(LEAK_SENTINEL);
  });
});
