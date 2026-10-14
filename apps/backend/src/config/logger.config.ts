import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { LoggerOptions } from 'pino';
import { stdSerializers } from 'pino-http';
import type { Options } from 'pino-http';

export const LOG_CENSOR = '[Redacted]';

const DEFAULT_LOG_LEVEL = 'info';

const QUERY_STRING_SEPARATOR = '?';

/**
 * Nombres de campo que nunca deben llegar en claro a los logs.
 *
 * La comparacion es case-insensitive e ignora separadores (`-`, `_`), de modo
 * que `api-key`, `api_key` y `apiKey` son todos sensibles. Los nombres estan
 * normalizados (minusculas, sin separadores) para que el lookup sea O(1).
 */
const SENSITIVE_FIELD_NAMES: ReadonlySet<string> = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'authorization',
  'cookie',
  'setcookie',
  'apikey',
  'cardnumber',
  'pan',
  'cvv',
  'cvc',
  'securitycode',
  'expirationdate',
  'expiry',
]);

/**
 * Campos propios de un `Error` que se conservan explicitamente con formato de
 * error en lugar de censurarse por clave (nunca son secretos y son la base del
 * diagnostico server-side).
 */
const RESERVED_ERROR_FIELDS: ReadonlySet<string> = new Set(['name', 'message', 'stack']);

const REDACTED_BEARER_TOKEN = `Bearer ${LOG_CENSOR}`;

/**
 * Subcadena con forma de URL: se conserva la ruta y se descarta su query string.
 *
 * La query puede transportar secretos (`?token=...`) y suele colarse en
 * `message`/`stack` a traves de URLs de callback. Mismo patron que
 * `sanitizeDetail` del filtro, aplicado aqui al texto del error.
 */
const URL_QUERY_STRING_PATTERN = /(\/[^\s?;,)}]*)(?:\?[^\s;,)}]*)/g;

/** Cabecera `Authorization: Bearer <token>` embebida en texto libre. */
const BEARER_TOKEN_PATTERN = /\bBearer\s+\S+/gi;

/**
 * Par de `clave=valor` (query string o texto libre) cuya clave puede ser
 * sensible. Se captura el separador inicial para reponerlo intacto.
 */
const SENSITIVE_ASSIGNMENT_PATTERN = /([?&;\s]|^)([A-Za-z0-9_-]+)=([^\s&;,)]*)/g;

/**
 * Rutas de redaccion de pino.
 *
 * LIMITE CONOCIDO (verificado empiricamente sobre `@pinojs/redact`, el motor que
 * usa pino 10 y sucesor del clasico `fast-redact`): la redaccion por comodines
 * NO es de profundidad arbitraria.
 *   - En objetos planos, cada comodin `*` cubre EXACTAMENTE un nivel; no existe
 *     un comodin de "cualquier profundidad". `*.password` no alcanza
 *     `body.user.profile.password`.
 *   - En arrays, el marcador `[]` no esta soportado: `body.items[].cardNumber`
 *     no hace nada. Solo funciona `*` en lugar del indice (`body.items.*.cvv`),
 *     y ademas consume un nivel de profundidad.
 *   - Una sintaxis desconocida (p. ej. `[]`) se ignora en silencio, lo que da
 *     falsa sensacion de cobertura.
 * Por eso esta lista es solo defensa en profundidad para claves de primer y
 * segundo nivel (principalmente cabeceras ya serializadas). La cobertura real de
 * anidados >=2 niveles y de arrays la aporta `censorSensitive` via
 * `hooks.logMethod`.
 */
export const LOG_REDACT_PATHS = [
  // Cabeceras.
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-auth-token"]',
  'req.headers["proxy-authorization"]',
  'res.headers["set-cookie"]',
  // Credenciales y tokens.
  'password',
  '*.password',
  'token',
  '*.token',
  'secret',
  '*.secret',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'authorization',
  '*.authorization',
  // Datos de tarjeta (PCI DSS).
  'cardNumber',
  '*.cardNumber',
  'pan',
  '*.pan',
  'cvv',
  '*.cvv',
  'cvc',
  '*.cvc',
  'securityCode',
  '*.securityCode',
  'expirationDate',
  '*.expirationDate',
  'expiry',
  '*.expiry',
] as const;

/**
 * Vista saneada de una peticion HTTP apta para logs.
 *
 * Deliberadamente NO incluye `query` ni `params`: ambos pueden arrastrar
 * credenciales (`?token=...`, `?email=...`) y no aportan valor para operar.
 */
export interface SerializedRequestLog {
  id: string | undefined;
  method: string;
  url: string;
  headers: Record<string, string>;
  remoteAddress: string;
  remotePort: number;
}

type PinoLogMethodHook = NonNullable<NonNullable<LoggerOptions['hooks']>['logMethod']>;

function normalizeFieldName(fieldName: string): string {
  return fieldName.toLowerCase().replace(/[-_]/g, '');
}

function isSensitiveFieldName(fieldName: string): boolean {
  return SENSITIVE_FIELD_NAMES.has(normalizeFieldName(fieldName));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === null || prototype === Object.prototype;
}

/**
 * Copia recursiva que reemplaza por `LOG_CENSOR` el valor de cualquier clave
 * sensible, a cualquier profundidad y dentro de arrays.
 *
 * Reglas:
 *   - Solo desciende por arrays y objetos planos (prototipo `Object.prototype`
 *     o `null`). Las instancias de clase (`IncomingMessage`, `ServerResponse`,
 *     `Date`, `Buffer`, ...) y los `Error` se devuelven tal cual: de `req`/`res`
 *     se encargan el serializer y `redact`, y de los `Error` se encarga
 *     `censorError`, que redacta `message`/`stack` y sus propiedades enumerables.
 *   - Usa un `WeakMap` original -> copia para resolver referencias circulares sin
 *     recursión infinita. Devolver el objeto original al detectar un ciclo
 *     filtraria los valores sensibles que cuelgan de él, por eso se reutiliza la
 *     copia ya censurada.
 */
function censorNode(value: unknown, censoredByOriginal: WeakMap<object, unknown>): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (value instanceof Error) {
    return value;
  }

  const cachedCensored = censoredByOriginal.get(value);
  if (cachedCensored !== undefined) {
    return cachedCensored;
  }

  if (Array.isArray(value)) {
    const censoredItems: unknown[] = [];
    censoredByOriginal.set(value, censoredItems);

    for (const item of value as unknown[]) {
      censoredItems.push(censorNode(item, censoredByOriginal));
    }

    return censoredItems;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const censoredObject: Record<string, unknown> = {};
  censoredByOriginal.set(value, censoredObject);

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    censoredObject[fieldName] = isSensitiveFieldName(fieldName)
      ? LOG_CENSOR
      : censorNode(fieldValue, censoredByOriginal);
  }

  return censoredObject;
}

export function censorSensitive(value: unknown): unknown {
  return censorNode(value, new WeakMap<object, unknown>());
}

/**
 * Redacta el par `clave=valor` cuando la clave es sensible; en caso contrario
 * devuelve el texto original intacto.
 */
function redactSensitiveAssignment(match: string, separator: string, fieldName: string): string {
  return isSensitiveFieldName(fieldName) ? `${separator}${fieldName}=${LOG_CENSOR}` : match;
}

/**
 * Redacta secretos embebidos en texto libre (`message`, `stack`).
 *
 * Cubre, en este orden: `Bearer <token>`, pares `clave=valor` con clave sensible
 * y, por ultimo, la query string de subcadenas con forma de URL.
 */
function redactSecretsInText(text: string): string {
  return text
    .replace(BEARER_TOKEN_PATTERN, REDACTED_BEARER_TOKEN)
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, redactSensitiveAssignment)
    .replace(URL_QUERY_STRING_PATTERN, '$1');
}

/**
 * Representacion censurada de un error apta para logs.
 *
 * Decision de diseno: en lugar de extender `censorSensitive` (que devuelve el
 * `Error` intacto para no perder el stack) se expone este helper explicito para
 * el borde que registra excepciones. Conserva `name`, `message` y `stack` con
 * formato de error (necesarios server-side) pero aplica la redaccion de secretos
 * a nivel de string en `message`/`stack` y censura recursivamente las
 * propiedades enumerables del error, incluidas las anidadas. Un valor que no sea
 * `Error` se delega a `censorSensitive`.
 */
export function censorError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return censorSensitive(error);
  }

  const censoredError: Record<string, unknown> = {
    name: error.name,
    message: redactSecretsInText(error.message),
    stack: redactSecretsInText(error.stack ?? ''),
  };

  const enumerableProperties = error as unknown as Record<string, unknown>;

  for (const [fieldName, fieldValue] of Object.entries(enumerableProperties)) {
    if (RESERVED_ERROR_FIELDS.has(fieldName)) {
      continue;
    }

    censoredError[fieldName] = isSensitiveFieldName(fieldName)
      ? LOG_CENSOR
      : censorSensitive(fieldValue);
  }

  return censoredError;
}

function isCensorableArgument(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

/**
 * Hook de pino que censura el objeto que se va a loguear antes de serializarlo.
 *
 * `redact` no cubre anidados profundos ni arrays (ver `LOG_REDACT_PATHS`), asi
 * que este hook es la cobertura real. Solo transforma el primer argumento
 * cuando es un objeto; los mensajes string pasan intactos.
 */
const censorLogMethodArguments: PinoLogMethodHook = function censorLogMethodArguments(
  inputArguments,
  method,
) {
  const [firstArgument, ...remainingArguments] = inputArguments;

  if (!isCensorableArgument(firstArgument)) {
    method.apply(this, inputArguments);
    return;
  }

  const censoredArguments = [
    censorSensitive(firstArgument),
    ...remainingArguments,
  ] as unknown as typeof inputArguments;

  method.apply(this, censoredArguments);
};

/**
 * Genera el `X-Request-Id` en el servidor.
 *
 * Se ignora deliberadamente cualquier `X-Request-Id` entrante para que un
 * cliente no pueda forjar la correlacion de los logs (trazabilidad fiable).
 */
export function genReqId(_req: IncomingMessage, res: ServerResponse): string {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);

  return requestId;
}

function stripQueryString(url: string): string {
  const separatorIndex = url.indexOf(QUERY_STRING_SEPARATOR);

  return separatorIndex === -1 ? url : url.slice(0, separatorIndex);
}

/**
 * Extrae la peticion cruda de un objeto ya serializado por pino-http.
 *
 * `pino-http` envuelve los serializers (`wrapSerializers: true` por defecto), de
 * modo que este serializer recibe la salida de `stdSerializers.req`, no el
 * `IncomingMessage`. Ese objeto expone la peticion original en `raw`; serializar
 * desde ahi preserva `remoteAddress`/`remotePort` (que se pierden si se vuelve a
 * serializar la vista ya procesada, porque ya no tiene `socket`).
 */
function unwrapRawRequest(request: IncomingMessage): IncomingMessage {
  const requestWithRaw = request as IncomingMessage & { raw?: IncomingMessage };

  return requestWithRaw.raw ?? request;
}

/**
 * Serializer de `req` para `pino-http`.
 *
 * Conserva unicamente `id`, `method`, `headers`, `remoteAddress`/`remotePort` y
 * un `url` sin query string. `query` y `params` se descartan por completo para
 * que `GET /search?token=abc&email=x` no deje rastro de `abc`, `x` ni `?` en
 * ningun campo del log de peticion.
 */
export function serializeRequest(request: IncomingMessage): SerializedRequestLog {
  const serialized = stdSerializers.req(unwrapRawRequest(request));

  return {
    id: serialized.id,
    method: serialized.method,
    url: stripQueryString(serialized.url),
    headers: serialized.headers,
    remoteAddress: serialized.remoteAddress,
    remotePort: serialized.remotePort,
  };
}

/**
 * Construye las opciones de `pino-http` a partir del nivel configurado.
 *
 * El body de las peticiones NO se loguea por defecto (defensa en profundidad):
 * aqui solo se anaden el serializer de `req`, la redaccion y la censura
 * recursiva como capas adicionales. Toda la politica de logging pasa por este
 * helper para no dispersar la configuracion.
 */
export function buildPinoHttpOptions(level?: string): Options {
  return {
    level: level ?? DEFAULT_LOG_LEVEL,
    redact: {
      paths: [...LOG_REDACT_PATHS],
      censor: LOG_CENSOR,
    },
    serializers: {
      req: serializeRequest,
    },
    hooks: {
      logMethod: censorLogMethodArguments,
    },
    genReqId,
  };
}
