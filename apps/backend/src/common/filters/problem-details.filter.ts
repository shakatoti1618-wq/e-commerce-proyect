import { STATUS_CODES } from 'node:http';

import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { censorError } from '../../config/logger.config';

/**
 * Cuerpo de error segun RFC 9457 (`application/problem+json`).
 *
 * `requestId` es opcional a proposito: solo se incluye en el JSON cuando el
 * servidor pudo generarlo, de modo que un cliente nunca vea `requestId: null`.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  requestId?: string;
  timestamp: string;
}

/**
 * Vista minima de la peticion necesaria para construir la respuesta.
 *
 * Se tipa localmente para no acoplar el filtro a los tipos de Express: solo
 * `id` (generado por `pino-http`), `originalUrl` y `url` son de interes.
 */
interface HttpRequestLike {
  id?: unknown;
  originalUrl?: unknown;
  url?: unknown;
}

/**
 * Vista minima de la respuesta necesaria para escribir el problem details.
 *
 * Los metodos devuelven el propio objeto para preservar el encadenado de la API
 * HTTP (`res.status(...).json(...)`), igual que Express/Fastify.
 */
interface HttpResponseLike {
  header(name: string, value: string): HttpResponseLike;
  status(statusCode: number): HttpResponseLike;
  json(body: ProblemDetails): void;
}

const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';
const PROBLEM_TYPE_BLANK = 'about:blank';
const INTERNAL_SERVER_ERROR_DETAIL = 'Internal server error';
const UNKNOWN_STATUS_TITLE = 'Error';
const SERVER_ERROR_STATUS_THRESHOLD = 500;
const DEFAULT_SERVER_ERROR_STATUS = 500;
const QUERY_STRING_SEPARATOR = '?';
const MESSAGE_SEPARATOR = '; ';
const ROOT_PATH = '/';

/**
 * Filtro global de excepciones que normaliza TODA respuesta de error.
 *
 * Garantias:
 *   - El cuerpo siempre cumple RFC 9457 y viaja como `application/problem+json`.
 *   - Un error 5xx (o una excepcion no controlada) nunca expone el mensaje
 *     original ni el stack: el detalle se sustituye por un texto generico y el
 *     detalle real solo se registra server-side.
 *   - `instance` se calcula sin query string: la query puede transportar
 *     secretos (`?token=...`) y no debe reflejarse.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<HttpRequestLike>();
    const response = ctx.getResponse<HttpResponseLike>();

    const status = this.resolveStatus(exception);
    const detail = this.resolveDetail(exception, status);
    const instance = this.resolveInstance(request);
    const requestId = typeof request.id === 'string' ? request.id : undefined;

    const body = this.buildBody(status, detail, instance, requestId);

    this.logException(exception, status, instance, requestId);

    response.header('Content-Type', PROBLEM_JSON_CONTENT_TYPE);
    response.status(status).json(body);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return DEFAULT_SERVER_ERROR_STATUS;
  }

  private resolveDetail(exception: unknown, status: number): string {
    const isServerError = status >= SERVER_ERROR_STATUS_THRESHOLD;

    if (isServerError || !(exception instanceof HttpException)) {
      return INTERNAL_SERVER_ERROR_DETAIL;
    }

    return this.sanitizeDetail(this.extractSafeDetail(exception.getResponse(), status));
  }

  /**
   * Elimina la query string de subcadenas con forma de URL en el detalle.
   *
   * La query puede transportar secretos (`?token=...`) y, a diferencia del
   * resto del mensaje, el cliente no controla qué se refleja: se recorta la
   * ruta y se descarta todo lo que venga despues de `?`.
   */
  private sanitizeDetail(detail: string): string {
    return detail.replace(/(\/[^\s?;,)}]*)(?:\?[^\s;,)}]*)/g, '$1');
  }

  /**
   * Extrae un mensaje seguro del payload de una `HttpException` 4xx.
   *
   * Solo se aceptan formas conocidas (string, `message` string o `message` como
   * array de strings). Cualquier otra forma cae al texto estandar del status,
   * evitando reflejar estructuras arbitrarias del error.
   */
  private extractSafeDetail(payload: unknown, status: number): string {
    if (typeof payload === 'string' && payload.length > 0) {
      return payload;
    }

    const message = this.extractMessageField(payload);
    if (message !== undefined) {
      return message;
    }

    return this.resolveTitle(status);
  }

  private extractMessageField(payload: unknown): string | undefined {
    if (typeof payload !== 'object' || payload === null) {
      return undefined;
    }

    const message = (payload as { message?: unknown }).message;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }

    if (Array.isArray(message)) {
      const stringMessages = message.filter((entry): entry is string => typeof entry === 'string');

      if (stringMessages.length > 0) {
        return stringMessages.join(MESSAGE_SEPARATOR);
      }
    }

    return undefined;
  }

  private resolveTitle(status: number): string {
    return STATUS_CODES[status] ?? UNKNOWN_STATUS_TITLE;
  }

  /**
   * Deriva la ruta de la peticion sin query string.
   *
   * `originalUrl`/`url` pueden ser `undefined` fuera de una peticion HTTP real,
   * por eso se valida el tipo antes de manipular la cadena.
   */
  private resolveInstance(request: HttpRequestLike): string {
    const rawUrl = this.resolveRawUrl(request);

    return rawUrl.split(QUERY_STRING_SEPARATOR)[0] || ROOT_PATH;
  }

  private resolveRawUrl(request: HttpRequestLike): string {
    if (typeof request.originalUrl === 'string') {
      return request.originalUrl;
    }

    if (typeof request.url === 'string') {
      return request.url;
    }

    return '';
  }

  private buildBody(
    status: number,
    detail: string,
    instance: string,
    requestId: string | undefined,
  ): ProblemDetails {
    const baseBody: ProblemDetails = {
      type: PROBLEM_TYPE_BLANK,
      title: this.resolveTitle(status),
      status,
      detail,
      instance,
      timestamp: new Date().toISOString(),
    };

    if (requestId === undefined) {
      return baseBody;
    }

    return { ...baseBody, requestId };
  }

  private logException(
    exception: unknown,
    status: number,
    path: string,
    requestId: string | undefined,
  ): void {
    if (status >= SERVER_ERROR_STATUS_THRESHOLD) {
      this.logger.error({ err: censorError(exception), requestId, path }, 'Unhandled exception');
      return;
    }

    this.logger.warn({ requestId, status, path }, 'Handled exception');
  }
}
