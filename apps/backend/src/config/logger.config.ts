import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Options } from 'pino-http';

export const LOG_CENSOR = '[Redacted]';

/**
 * Rutas de redaccion de pino.
 *
 * Es una capa de defensa en profundidad: la regla base es no volcar datos
 * sensibles a los logs, pero si un objeto con credenciales o datos de tarjeta
 * llega al logger, aqui queda censurado.
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

/**
 * Construye las opciones de `pino-http` a partir del nivel configurado.
 *
 * El body de las peticiones NO se loguea por defecto (defensa en profundidad):
 * aqui solo se anade la redaccion como capa adicional. Toda la politica de
 * logging pasa por este helper para no dispersar la configuracion.
 */
export function buildPinoHttpOptions(level?: string): Options {
  return {
    level: level ?? 'info',
    redact: {
      paths: [...LOG_REDACT_PATHS],
      censor: LOG_CENSOR,
    },
    genReqId,
  };
}
