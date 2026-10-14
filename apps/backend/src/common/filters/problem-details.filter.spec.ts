import 'reflect-metadata';

import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../app.module';
import { ProblemDetailsFilter } from './problem-details.filter';
import type { ProblemDetails } from './problem-details.filter';

interface FakeRequest {
  id?: string;
  originalUrl: string;
  url: string;
}

class FakeHttpResponse {
  public readonly headers: Record<string, string> = {};
  public statusCode: number | undefined = undefined;
  public body: ProblemDetails | undefined = undefined;

  header(name: string, value: string): this {
    this.headers[name] = value;

    return this;
  }

  status(statusCode: number): this {
    this.statusCode = statusCode;

    return this;
  }

  json(body: ProblemDetails): void {
    this.body = body;
  }
}

interface HostHarness {
  host: ArgumentsHost;
  response: FakeHttpResponse;
}

function createHost(request: FakeRequest): HostHarness {
  const response = new FakeHttpResponse();

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

interface LoggerHarness {
  logger: Logger;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
}

function createLogger(): LoggerHarness {
  const error = vi.fn();
  const warn = vi.fn();

  return { logger: { error, warn } as unknown as Logger, error, warn };
}

function createFilter(): { filter: ProblemDetailsFilter; logger: LoggerHarness } {
  const logger = createLogger();

  return { filter: new ProblemDetailsFilter(logger.logger), logger };
}

describe('ProblemDetailsFilter', () => {
  it('maps a NotFoundException to a 404 problem+json response', () => {
    const { filter } = createFilter();
    const { host, response } = createHost({ originalUrl: '/products/42', url: '/products/42' });

    filter.catch(new NotFoundException('Producto no existe'), host);

    expect(response.statusCode).toBe(404);
    expect(response.headers['Content-Type']).toBe('application/problem+json');
    expect(response.body?.title).toBe('Not Found');
    expect(response.body?.detail).toBe('Producto no existe');
    expect(response.body?.type).toBe('about:blank');
  });

  it('joins the validation message array with a semicolon', () => {
    const { filter } = createFilter();
    const { host, response } = createHost({ originalUrl: '/cart', url: '/cart' });

    filter.catch(
      new BadRequestException({ message: ['campo A invalido', 'campo B invalido'] }),
      host,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body?.detail).toBe('campo A invalido; campo B invalido');
  });

  it('never leaks the message, internals, secrets or stack of an unhandled Error', () => {
    const { filter } = createFilter();
    const { host, response } = createHost({ originalUrl: '/orders', url: '/orders' });

    filter.catch(new Error('boom /internal/path secret=TOP_SECRET'), host);

    const serialized = JSON.stringify(response.body);

    expect(response.statusCode).toBe(500);
    expect(response.body?.detail).toBe('Internal server error');
    expect(serialized).not.toContain('boom');
    expect(serialized).not.toContain('/internal');
    expect(serialized).not.toContain('TOP_SECRET');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('stack');
  });

  it('replaces the internal message of a 5xx HttpException with a generic detail', () => {
    const { filter } = createFilter();
    const { host, response } = createHost({ originalUrl: '/orders', url: '/orders' });

    filter.catch(new InternalServerErrorException('detalle interno filtrado'), host);

    const serialized = JSON.stringify(response.body);

    expect(response.statusCode).toBe(500);
    expect(response.body?.detail).toBe('Internal server error');
    expect(serialized).not.toContain('detalle interno filtrado');
  });

  it('strips the query string from instance so secrets never reach the body', () => {
    const { filter } = createFilter();
    const { host, response } = createHost({
      originalUrl: '/orders?token=SECRET',
      url: '/orders?token=SECRET',
    });

    filter.catch(new NotFoundException('no encontrado'), host);

    expect(response.body?.instance).toBe('/orders');
    expect(JSON.stringify(response.body)).not.toContain('SECRET');
  });

  it('includes the requestId when the request carries one', () => {
    const { filter } = createFilter();
    const { host, response } = createHost({
      id: 'req-123',
      originalUrl: '/orders',
      url: '/orders',
    });

    filter.catch(new NotFoundException('no encontrado'), host);

    expect(response.body?.requestId).toBe('req-123');
  });

  it('omits the requestId key entirely when the request has none', () => {
    const { filter } = createFilter();
    const { host, response } = createHost({ originalUrl: '/orders', url: '/orders' });

    filter.catch(new NotFoundException('no encontrado'), host);

    expect(response.body?.requestId).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(response.body, 'requestId')).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain('requestId');
  });
});

describe('ProblemDetailsFilter query sanitization', () => {
  it('removes query string from NotFoundException detail with URL-like message', () => {
    const { filter } = createFilter();
    const { host, response } = createHost({ originalUrl: '/api/nope', url: '/api/nope' });

    filter.catch(new NotFoundException('Cannot GET /api/nope?secret=XYZ'), host);

    expect(response.body?.detail).toBe('Cannot GET /api/nope');
    expect(JSON.stringify(response.body)).not.toContain('XYZ');
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });

  it('sanitizes query strings inside array messages of BadRequestException', () => {
    const { filter } = createFilter();
    const { host, response } = createHost({ originalUrl: '/o', url: '/o' });

    filter.catch(
      new BadRequestException({ message: ['fallo en /o?token=ABC', 'campo B invalido'] }),
      host,
    );

    expect(response.body?.detail).toBe('fallo en /o; campo B invalido');
    expect(JSON.stringify(response.body)).not.toContain('ABC');
    expect(JSON.stringify(response.body)).not.toContain('token');
  });

  it('does not alter details without query strings', () => {
    const { filter } = createFilter();
    const { host, response } = createHost({ originalUrl: '/', url: '/' });

    filter.catch(new BadRequestException('Are you sure?'), host);

    expect(response.body?.detail).toBe('Are you sure?');
  });
});

describe('ProblemDetailsFilter logging', () => {
  it('logs 5xx failures at error level with the raw error server-side', () => {
    const { filter, logger } = createFilter();
    const { host } = createHost({ originalUrl: '/orders', url: '/orders' });

    filter.catch(new InternalServerErrorException('detalle interno filtrado'), host);

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs 4xx failures at warn level', () => {
    const { filter, logger } = createFilter();
    const { host } = createHost({ originalUrl: '/orders', url: '/orders' });

    filter.catch(new NotFoundException('no encontrado'), host);

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('ProblemDetailsFilter DI metadata', () => {
  it('declares the Logger value import as its first constructor dependency', () => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', ProblemDetailsFilter) as
      unknown[] | undefined;

    expect(paramTypes?.[0]).toBe(Logger);
  });
});

describe('AppModule registration', () => {
  it('registers the filter as a global APP_FILTER provider', () => {
    const providers = Reflect.getMetadata('providers', AppModule) as unknown;

    expect(Array.isArray(providers)).toBe(true);

    const providerList = (Array.isArray(providers) ? providers : []) as unknown[];
    const appFilterProvider = providerList.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        (provider as { provide?: unknown }).provide === APP_FILTER,
    );

    expect(appFilterProvider).toBeDefined();
  });
});
