import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

/**
 * Límite global conservador para el JSON body parser (1 MB).
 *
 * El parser global se registra aquí (antes de `init()`) mediante
 * `useBodyParser`, de modo que el adaptador NO vuelve a registrar el suyo por
 * defecto y el límite sí aplica. Al crear la app con `rawBody: true`, Nest añade
 * internamente un `verify` que deja el cuerpo crudo disponible en `req.rawBody`.
 *
 * Para el webhook de Wompi (M9) se necesitará verificar la firma sobre el
 * **raw body** (Buffer) con un límite mayor (`WEBHOOK_RAW_BODY_LIMIT`, 5 MB,
 * exportado desde `zod.dto.ts`). En M9 se decidirá si registrar un parser
 * dedicado en esa ruta en lugar de reutilizar este límite global.
 *
 * NO se monta aquí porque el webhook no existe en M3.
 */
const GLOBAL_BODY_LIMIT = '1mb';

/**
 * Límite para el parser urlencoded (100 KB), igual al valor por defecto de
 * `body-parser`.
 *
 * Se registra EXPLÍCITAMENTE antes de `mapBodyParserError` porque Nest
 * registra su parser urlencoded por defecto en `init()`, DESPUÉS de nuestros
 * middlewares: su error nunca alcanzaría el middleware de normalización y el
 * cliente recibiría un 500 en lugar de un 413 problem+json.
 *
 * `extended: false` difiere del default de Nest (`extended: true`): hoy
 * ninguna ruta consume urlencoded, así que no hay impacto.
 */
const URLENCODED_BODY_LIMIT = '100kb';

/**
 * Cabeceras base aplicadas a TODA respuesta (éxito o error).
 *
 * Se registran con un middleware propio: sin `helmet` ni dependencias nuevas.
 * CSP y HSTS NO se definen aquí (quedan diferidos a un commit posterior).
 */
const BASELINE_SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'no-referrer'],
];

/** Separador de la lista `CORS_ORIGINS`. */
const CORS_ORIGIN_SEPARATOR = ',';

/**
 * Wildcard. NUNCA se permite: `credentials: true` con `*` es inválido e
 * inseguro, así que cualquier entrada `'*'` se descarta (fail-closed).
 */
const CORS_ORIGIN_WILDCARD = '*';

/** Barra(s) final(es) de un origen, que se recortan al normalizar. */
const CORS_ORIGIN_TRAILING_SLASHES = /\/+$/;

/**
 * Métodos HTTP autorizados en el preflight de CORS (lista blanca explícita).
 *
 * Sin esta lista, `cors` responde con sus 5 métodos por defecto (incluye
 * `PUT`, que hoy ninguna ruta expone). Se amplía cuando un módulo lo necesite.
 */
const CORS_ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'];

/**
 * Cabeceras de request autorizadas en el preflight de CORS (lista blanca
 * explícita). `Authorization` y `PUT` NO se añaden hasta que un módulo real
 * los necesite.
 */
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Accept'];

/**
 * Superficie mínima del `app` de Express que necesitamos, para no depender de
 * `any` suelto ni de `@types/express`. `getHttpAdapter().getInstance()`
 * devuelve `any`; se castea a esta interfaz en el borde.
 */
interface ExpressInstanceLike {
  set(setting: string, value: unknown): void;
  get(setting: string): unknown;
  disable(setting: string): void;
}

/** Superficie mínima de la respuesta HTTP que usa el middleware de cabeceras. */
interface ResponseHeaderWriter {
  setHeader(name: string, value: string): void;
}

/**
 * Superficie mínima de un error de `body-parser` que necesitamos inspeccionar.
 *
 * `type` es la etiqueta propia de `body-parser` (`entity.too.large`,
 * `entity.parse.failed`); `status`/`statusCode` son el código HTTP que adjunta.
 * Se tipan como `unknown` porque el error llega como valor no confiable y se
 * valida antes de usarlo (nunca se interpola en la respuesta).
 */
interface BodyParserErrorLike {
  type?: unknown;
  status?: unknown;
  statusCode?: unknown;
}

/** Código HTTP con el que `body-parser` marca un cuerpo demasiado grande. */
const PAYLOAD_TOO_LARGE_STATUS = 413;

/** Etiqueta de `body-parser` para un cuerpo que excede el límite. */
const BODY_PARSER_TOO_LARGE_TYPE = 'entity.too.large';

/** Etiqueta de `body-parser` para un JSON que no se pudo parsear. */
const BODY_PARSER_PARSE_FAILED_TYPE = 'entity.parse.failed';

/**
 * Mensajes GENÉRICOS y fijos para los errores del body parser.
 *
 * Se evita por completo interpolar el mensaje original del parser o cualquier
 * fragmento del cuerpo enviado: un `detail` con contenido del request podría
 * reflejar datos del cliente y romper la coherencia del API.
 */
const BODY_TOO_LARGE_DETAIL = 'Request body too large';
const MALFORMED_JSON_DETAIL = 'Malformed JSON body';

/** Firma de `next` de Express para reenviar el error (o el control). */
type ErrorNextFunction = (error?: unknown) => void;

/**
 * Normaliza la lista de orígenes permitidos (fail-closed).
 *
 * - Separa por coma, recorta espacios, pasa a minúsculas.
 * - Quita barras finales (el origen nunca incluye path).
 * - Descarta entradas vacías y el wildcard `'*'`.
 * - Deduplica preservando el orden de aparición.
 *
 * Si no queda ningún origen, devuelve `[]`, lo que hace que CORS deniegue todo.
 */
function normalizeCorsOrigins(rawOrigins: string | undefined): string[] {
  if (!rawOrigins) {
    return [];
  }

  const normalizedOrigins = new Set<string>();

  for (const candidate of rawOrigins.split(CORS_ORIGIN_SEPARATOR)) {
    const origin = candidate.trim().toLowerCase().replace(CORS_ORIGIN_TRAILING_SLASHES, '');

    if (origin === '' || origin === CORS_ORIGIN_WILDCARD) {
      continue;
    }

    normalizedOrigins.add(origin);
  }

  return [...normalizedOrigins];
}

/**
 * Middleware propio: añade las cabeceras base a toda respuesta y delega.
 */
function applyBaselineSecurityHeaders(
  _request: unknown,
  response: ResponseHeaderWriter,
  next: () => void,
): void {
  for (const [name, value] of BASELINE_SECURITY_HEADERS) {
    response.setHeader(name, value);
  }

  next();
}

/**
 * Estrecha `unknown` a la superficie inspeccionable de un error de body-parser.
 *
 * Solo comprueba que sea un objeto no nulo; los campos concretos se leen a
 * través de `BodyParserErrorLike` y se comparan sin asumir su tipo.
 */
function isBodyParserError(error: unknown): error is BodyParserErrorLike {
  return typeof error === 'object' && error !== null;
}

/** ¿El error trae el código HTTP 413 en `status` o `statusCode`? */
function hasPayloadTooLargeStatus(error: BodyParserErrorLike): boolean {
  return error.status === PAYLOAD_TOO_LARGE_STATUS || error.statusCode === PAYLOAD_TOO_LARGE_STATUS;
}

/** ¿Es el error de `body-parser` por un cuerpo que excede el límite? */
function isPayloadTooLargeError(error: unknown): boolean {
  if (!isBodyParserError(error)) {
    return false;
  }

  return error.type === BODY_PARSER_TOO_LARGE_TYPE || hasPayloadTooLargeStatus(error);
}

/**
 * ¿Es el error de `body-parser` por un JSON mal formado?
 *
 * Reconoce únicamente el error propio de `body-parser` identificado por su
 * etiqueta `entity.parse.failed`; NO cualquier `SyntaxError` genérico.
 */
function isMalformedJsonError(error: unknown): boolean {
  return isBodyParserError(error) && error.type === BODY_PARSER_PARSE_FAILED_TYPE;
}

/**
 * Middleware de error (4 parámetros, como exige Express) que normaliza los
 * errores del body parser a `HttpException`.
 *
 * Nest mapea `SyntaxError`/`URIError` a `BadRequestException` reflejando el
 * mensaje del parser, pero no reconoce `PayloadTooLargeError` (de ahí el 500).
 * Al reenviarlos como `HttpException` con un mensaje fijo, el
 * `ProblemDetailsFilter` global les da formato `application/problem+json` sin
 * filtrar contenido del cuerpo. Cualquier otro error se reenvía intacto.
 *
 * Normaliza los errores del body parser (413/400) a problem+json. Cubre los
 * parsers json Y urlencoded, así que ambos deben registrarse ANTES de este
 * middleware; si Nest registra el suyo en `init()` después, su error nunca
 * pasaría por aquí y acabaría en un 500.
 *
 * Debe registrarse DESPUÉS de los parsers para que Express lo alcance al
 * propagar el error.
 */
function mapBodyParserError(
  error: unknown,
  _request: unknown,
  _response: unknown,
  next: ErrorNextFunction,
): void {
  if (isPayloadTooLargeError(error)) {
    next(new PayloadTooLargeException(BODY_TOO_LARGE_DETAIL));
    return;
  }

  if (isMalformedJsonError(error)) {
    next(new BadRequestException(MALFORMED_JSON_DETAIL));
    return;
  }

  next(error);
}

/**
 * Ruta bajo el prefijo global `api` donde se sirve la UI de OpenAPI.
 * Con `ENABLE_SWAGGER=true` la URL final es `/api/docs`; sin el flag, la ruta
 * no se registra y responde 404 como cualquier otra ruta inexistente.
 */
const OPENAPI_UI_PATH = 'api/docs';

/** Título del documento OpenAPI (placeholder; se ajuste al definir el API). */
const OPENAPI_DOCUMENT_TITLE = 'Lumé API';

/** Versión del documento OpenAPI (placeholder; sigue el versionado del API). */
const OPENAPI_DOCUMENT_VERSION = '0.0.0';

/** Descripción breve y neutra del documento OpenAPI. */
const OPENAPI_DOCUMENT_DESCRIPTION = 'REST API del backend de Lumé.';

/**
 * Monta la UI y el schema OpenAPI en `api/docs` SOLO si `ENABLE_SWAGGER=true`.
 *
 * Sin el flag (falso o ausente) no se registra ninguna ruta: `GET /api/docs`
 * responde 404. El schema de entorno ya rechaza `true` cuando `NODE_ENV` es
 * `production`, así que aquí únicamente se comprueba el flag.
 */
function mountOpenApiDocumentation(app: NestExpressApplication, config: ConfigService): void {
  if (config.get<boolean>('ENABLE_SWAGGER') !== true) {
    return;
  }

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(OPENAPI_DOCUMENT_TITLE)
      .setVersion(OPENAPI_DOCUMENT_VERSION)
      .setDescription(OPENAPI_DOCUMENT_DESCRIPTION)
      .build(),
  );

  SwaggerModule.setup(OPENAPI_UI_PATH, app, document);
}

/**
 * Construye la aplicación NestExpress SIN escuchar en ningún puerto.
 *
 * Se separa de `bootstrap()` (en `main.ts`) para que los tests puedan importar
 * esta fábrica y montar la app real sin arrancar el servidor HTTP. Toda la
 * configuración de seguridad (trust proxy, CORS, cabeceras base) vive aquí,
 * de modo que los tests ejerciten exactamente lo mismo que producción.
 */
export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');

  const config = app.get(ConfigService);
  const expressInstance = app.getHttpAdapter().getInstance() as unknown as ExpressInstanceLike;

  // `trust proxy` fail-closed: 0 significa no confiar en cabeceras de proxy.
  expressInstance.set('trust proxy', config.getOrThrow<number>('TRUST_PROXY_HOPS'));
  // No revelar la tecnología del servidor.
  expressInstance.disable('x-powered-by');

  // Cabeceras base en toda respuesta, incluidos los errores. Deben ir ANTES de
  // `enableCors`: el middleware de preflight de CORS responde y corta la cadena,
  // así que si se registra después el 204 del OPTIONS no llevaría
  // `X-Content-Type-Options` ni `Referrer-Policy`.
  app.use(applyBaselineSecurityHeaders);

  // CORS estricto: SIEMPRE un array normalizado (nunca `'*'`). La lista se
  // calcula UNA sola vez y `credentials` solo se activa si queda algún origen
  // permitido (fail-closed: con la allowlist vacía no se manda
  // `Access-Control-Allow-Credentials`).
  const allowedOrigins = normalizeCorsOrigins(config.get<string>('CORS_ORIGINS'));

  app.enableCors({
    origin: allowedOrigins,
    methods: CORS_ALLOWED_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    credentials: allowedOrigins.length > 0,
  });

  // Body parser global con límite conservador.
  app.useBodyParser('json', { limit: GLOBAL_BODY_LIMIT });

  // Parser urlencoded registrado AQUÍ y no en `init()`, para que sus errores
  // (413/400) pasen por `mapBodyParserError` en lugar de acabar en un 500.
  app.useBodyParser('urlencoded', { extended: false, limit: URLENCODED_BODY_LIMIT });

  // Normaliza los errores del body parser (413/400) a problem+json; cubre los
  // parsers json y urlencoded. Se registra DESPUÉS de ambos para que Express
  // lo invoque al propagar el error.
  app.use(mapBodyParserError);

  // OpenAPI SOLO con `ENABLE_SWAGGER=true` (nunca en producción, lo garantiza
  // el schema de entorno).
  mountOpenApiDocumentation(app, config);

  return app;
}
