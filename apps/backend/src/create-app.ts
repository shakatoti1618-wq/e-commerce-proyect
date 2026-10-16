import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
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

  // CORS estricto: SIEMPRE un array normalizado (nunca `'*'`), con credenciales.
  app.enableCors({
    origin: normalizeCorsOrigins(config.get<string>('CORS_ORIGINS')),
    credentials: true,
  });

  // Cabeceras base en toda respuesta, incluidos los errores.
  app.use(applyBaselineSecurityHeaders);

  // Body parser global con límite conservador.
  app.useBodyParser('json', { limit: GLOBAL_BODY_LIMIT });

  return app;
}
