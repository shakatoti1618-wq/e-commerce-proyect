import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, get as httpGet, request as httpRequest } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';

import pino from 'pino';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { describe, expect, it, vi } from 'vitest';

import {
  LOG_CENSOR,
  LOG_REDACT_PATHS,
  buildPinoHttpOptions,
  genReqId,
  serializeRequest,
} from './logger.config';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEAK_SENTINEL = 'super-secret-leak';

const CLIENT_SUPPLIED_REQUEST_ID = 'client-supplied';

const BODY_SENTINEL = 'BODY_SENTINEL';

const NESTED_SENTINEL = 'nested-two-levels';

const ARRAY_SENTINEL = 'nested-in-array';

const CIRCULAR_SENTINEL = 'circular-secret';

interface RedactedLogRecord {
  req: { headers: { authorization: string; cookie: string } };
  body: { password: string; cardNumber: string; cvv: string; token: string };
}

interface SerializedRequestInLog {
  id: string | undefined;
  method: string;
  url: string;
  headers: Record<string, string>;
  remoteAddress?: string;
  remotePort?: number;
}

interface HttpLogRecord {
  req: SerializedRequestInLog;
}

interface LogCapture {
  destination: Writable;
  nextLine: () => Promise<string>;
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

function createCaptureStream(): { destination: Writable; read: () => string } {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });

  return { destination, read: () => chunks.join('') };
}

function createLogCapture(): LogCapture {
  const bufferedLines: string[] = [];
  const lineWaiters: Array<(line: string) => void> = [];

  const destination = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of String(chunk).split('\n')) {
        if (line.length === 0) {
          continue;
        }

        const waiter = lineWaiters.shift();
        if (waiter) {
          waiter(line);
        } else {
          bufferedLines.push(line);
        }
      }

      callback();
    },
  });

  function nextLine(): Promise<string> {
    const buffered = bufferedLines.shift();

    if (buffered !== undefined) {
      return Promise.resolve(buffered);
    }

    return new Promise<string>((resolve) => {
      lineWaiters.push(resolve);
    });
  }

  return { destination, nextLine };
}

function buildTestLogger(destination: Writable): Logger {
  return pino(buildPinoHttpOptions('info'), destination);
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  return (server.address() as AddressInfo).port;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function httpGetUrl(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    httpGet(url, (response) => {
      response.resume();
      response.on('end', () => resolve());
    }).on('error', reject);
  });
}

async function httpPostJson(url: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload);

  await new Promise<void>((resolve, reject) => {
    const request = httpRequest(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve());
      },
    );

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function captureRedactedLogLine(): string {
  const { destination, read } = createCaptureStream();

  const logger = pino(
    { level: 'info', redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_CENSOR } },
    destination,
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

  return read();
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

  it('wires the request serializer and the recursive censor hook', () => {
    const options = buildPinoHttpOptions();

    expect(options.serializers?.req).toBe(serializeRequest);
    expect(typeof options.hooks?.logMethod).toBe('function');
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

describe('serializeRequest', () => {
  function createIncomingMessage(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
    return {
      url: '/search?token=abc&email=x',
      method: 'GET',
      headers: {
        host: 'lume.test',
        'user-agent': 'vitest-agent',
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: LEAK_SENTINEL,
        cookie: LEAK_SENTINEL,
        'x-api-key': LEAK_SENTINEL,
        'x-custom': LEAK_SENTINEL,
      },
      id: 'request-id',
      socket: { remoteAddress: '127.0.0.1', remotePort: 4321 },
      ...overrides,
    } as unknown as IncomingMessage;
  }

  it('keeps method and id, strips the query string and drops query/params', () => {
    const serialized = serializeRequest(createIncomingMessage());
    const rawSerialized = JSON.stringify(serialized);

    expect(serialized.url).toBe('/search');
    expect(serialized.url).not.toContain('?');
    expect(serialized.method).toBe('GET');
    expect(serialized.id).toBe('request-id');
    expect(serialized.remoteAddress).toBe('127.0.0.1');
    expect(serialized.remotePort).toBe(4321);
    expect('query' in serialized).toBe(false);
    expect('params' in serialized).toBe(false);
    expect(rawSerialized).not.toContain('abc');
    expect(rawSerialized).not.toContain('token=');
    expect(rawSerialized).not.toContain('email=x');
  });

  it('keeps the allowlisted headers with their values', () => {
    const serialized = serializeRequest(createIncomingMessage());

    expect(serialized.headers.host).toBe('lume.test');
    expect(serialized.headers['user-agent']).toBe('vitest-agent');
    expect(serialized.headers.accept).toBe('application/json');
    expect(serialized.headers['content-type']).toBe('application/json');
  });

  it('drops non-allowlisted and sensitive headers entirely (key and value)', () => {
    const serialized = serializeRequest(createIncomingMessage());
    const rawSerialized = JSON.stringify(serialized);

    for (const headerName of ['authorization', 'cookie', 'x-api-key', 'x-custom']) {
      expect(serialized.headers).not.toHaveProperty(headerName);
      expect(rawSerialized).not.toContain(headerName);
    }

    expect(rawSerialized).not.toContain(LEAK_SENTINEL);
  });
});

describe('recursive censor', () => {
  it('censures a sensitive key nested two levels deep', async () => {
    const capture = createLogCapture();
    const logger = buildTestLogger(capture.destination);

    logger.info({ body: { user: { password: NESTED_SENTINEL } } });

    const rawLogLine = await capture.nextLine();
    const parsed = JSON.parse(rawLogLine) as { body: { user: { password: string } } };

    expect(parsed.body.user.password).toBe(LOG_CENSOR);
    expect(rawLogLine).not.toContain(NESTED_SENTINEL);
  });

  it('censures sensitive keys inside arrays of nested objects', async () => {
    const capture = createLogCapture();
    const logger = buildTestLogger(capture.destination);

    logger.info({ body: { items: [{ cardNumber: ARRAY_SENTINEL, cvv: ARRAY_SENTINEL }] } });

    const rawLogLine = await capture.nextLine();
    const parsed = JSON.parse(rawLogLine) as {
      body: { items: Array<{ cardNumber: string; cvv: string }> };
    };
    const firstItem = parsed.body.items[0];

    expect(firstItem).toBeDefined();
    expect(firstItem?.cardNumber).toBe(LOG_CENSOR);
    expect(firstItem?.cvv).toBe(LOG_CENSOR);
    expect(rawLogLine).not.toContain(ARRAY_SENTINEL);
  });

  it('handles circular references without throwing or leaking the secret', async () => {
    const capture = createLogCapture();
    const logger = buildTestLogger(capture.destination);

    interface SelfReferencingNode {
      password: string;
      self?: SelfReferencingNode;
    }

    const node: SelfReferencingNode = { password: CIRCULAR_SENTINEL };
    node.self = node;

    expect(() => logger.info({ body: node })).not.toThrow();

    const rawLogLine = await capture.nextLine();

    expect(rawLogLine).not.toContain(CIRCULAR_SENTINEL);
  });
});

describe('http integration', () => {
  it('does not leak the query string of the request into any log field', async () => {
    const capture = createLogCapture();
    const httpLogger = pinoHttp(buildPinoHttpOptions('info'), capture.destination);
    const server = createServer((request, response) => {
      httpLogger(request, response);
      response.end('ok');
    });

    const port = await listen(server);

    try {
      await httpGetUrl(`http://127.0.0.1:${port}/search?token=abc&email=x`);

      const rawLogLine = await capture.nextLine();
      const parsed = JSON.parse(rawLogLine) as HttpLogRecord;

      expect(parsed.req.url).toBe('/search');
      expect(parsed.req).not.toHaveProperty('query');
      expect(parsed.req).not.toHaveProperty('params');
      expect(rawLogLine).not.toContain('abc');
      expect(rawLogLine).not.toContain('token=');
      expect(rawLogLine).not.toContain('email=x');
      expect(rawLogLine).not.toContain('?');
    } finally {
      await closeServer(server);
    }
  });

  it('never logs the request body', async () => {
    const capture = createLogCapture();
    const httpLogger = pinoHttp(buildPinoHttpOptions('info'), capture.destination);
    const server = createServer((request, response) => {
      httpLogger(request, response);
      request.resume();
      response.end('ok');
    });

    const port = await listen(server);

    try {
      await httpPostJson(`http://127.0.0.1:${port}/checkout`, { secret: BODY_SENTINEL });

      const rawLogLine = await capture.nextLine();

      expect(rawLogLine).not.toContain(BODY_SENTINEL);
    } finally {
      await closeServer(server);
    }
  });
});
