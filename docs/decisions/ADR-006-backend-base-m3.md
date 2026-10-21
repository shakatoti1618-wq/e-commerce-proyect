# ADR-006 - Backend base (NestJS)

## Contexto

Estado de la rama y decisiones vigentes al cierre de implementación de M3.

**Estado [V]**

- Rama `feat/m3-backend-base`.
- 10 commits en el rango `fb2459e..4eed631`.
- 27 commits de implementación sobre main antes de los commits docs de cierre
  (`git rev-list --count main..HEAD`). Con el commit de este ADR la cifra deja de
  ser 27; la definitiva se mide al abrir el PR.
- 102 tests en 14 archivos.
- Sin dependencias nuevas en el rango: solo se borró el script `format:check` de
  `apps/backend`.

Commits del rango [V]:

1. `718cfe5` incluir `error.code` en el fallo de arranque.
2. `dd203bf` quitar `format:check` por paquete.
3. `2cc35ce` endpoint `/api/health`.
4. `5bac159` CORS estricto, trust proxy y cabeceras base.
5. `9927088` errores de body-parser a problem+json.
6. `aae13e2` esqueleto OpenAPI.
7. `8ef65d3` e2e vía `createApp`.
8. `20f11a2` urlencoded.
9. `5a2502b` cabeceras en preflight y CORS más estricto.
10. `4eed631` acotar el mapeo de JSON mal formado.

**Decisiones vigentes [U]** (no reabrir)

- NestJS 11.2.7 + Express.
- `nestjs-zod` 5.5.0; no soporta Nest 12. **Condición de salida:** migrar a Nest 12
  cuando lo soporte.
- Versiones exactas en `package.json`, sin `^` ni `~`.
- Vitest 5 con Oxc; **sin** `unplugin-swc`/`@swc/core`; con smoke test de metadata
  como condición de salida.
- `.env` solo con `NODE_ENV=development` o `test` (allowlist fail-closed).
- Sin rate limiting en M3 (entra desde M7).
- Sin `packages/contracts` hasta M4.
- OpenAPI solo con `ENABLE_SWAGGER=true` y nunca en producción.
- CSP y HSTS antes del checkout.
- El error de validación de `env` sale con el formato por defecto de Nest porque
  ocurre antes del logger.
- Regla transversal: **los secretos nunca viajan en ruta ni query.**

## Opciones consideradas

1. **`unplugin-swc` / `@swc/core`** — descartado: el binario está bloqueado en
   Windows.
2. **`helmet`** — descartado a favor de cabeceras propias, sin dependencias nuevas.
3. **`overrides` de pnpm** — descartados para `js-yaml`; se asume la deuda y se fija
   condición de salida.

## Decisiones

**Desviaciones frente a lo pedido [V salvo indicación]**

a) Cuatro commits no pedidos en la tanda, cada uno con prueba real en servidor:

- `9927088`: sin él, el 413 y el 400 no salían como `problem+json`.
- `20f11a2`: un urlencoded >100 KB daba 500 con `PayloadTooLargeError`
  (`limit 102400`) porque Nest registra su parser en `init()`, después de nuestro
  middleware. Con el fix da 413 `problem+json`.
- `5a2502b`: el preflight 204 no llevaba `nosniff` ni `Referrer-Policy` porque
  `enableCors` iba antes de las cabeceras base. Ahora van antes; además `methods` y
  `allowedHeaders` explícitos (`GET`, `HEAD`, `POST`, `PATCH`, `DELETE` y
  `Content-Type`, `Accept`) y `credentials` solo si la lista de orígenes no está
  vacía.
- `4eed631`: `mapBodyParserError` remapeaba cualquier `SyntaxError` a 400
  `"Malformed JSON body"`; ahora solo `error.type === 'entity.parse.failed'`.

b) `977e040` no arranca de forma aislada y lo corrige `f809280` [U]. Debe constar
aquí y en el PR.

c) Desviaciones de configuración [U]: `vitest.config.mjs`, test de aborto A1 por el
`forRoot` async, contrato de metadata Oxc.

## Por qué

- **Fail-closed por defecto:** CORS vacío deniega todo, `trust proxy` arranca en 0,
  `.env` solo en development/test y Swagger apagado salvo explícito, con bloqueo
  adicional en producción [U].
- **Mínima superficie:** un solo prefijo `/api`, liveness sin uptime ni entorno, sin
  `helmet` ni dependencias nuevas, `X-Powered-By` apagado [U].
- **Los secretos no se reflejan:** ni en `detail` ni en `instance` ni en los logs;
  la query string se elimina de las tres rutas [U].
- **Sin deuda de versiones:** versiones exactas y sin `^` ni `~` para que el lockfile
  sea la única fuente de verdad [U].

## Consecuencias y trade-offs aceptados

- Se acepta `js-yaml` con `pnpm audit --prod` reportando 1 moderada, sin overrides
  (ver *Deuda diferida*) [U].
- Se acepta `envFilePath` con dos rutas relativas, pendiente de cerrarse en M4 [U].
- Se acepta que el preflight de CORS anuncie métodos y cabeceras permitidos aunque
  deniegue el origen [V].
- Se acepta documentar OpenAPI con `@nestjs/swagger`, con su cadena de dependencias
  como condición de salida compartida con Nest 12 [U].

### Auditoría de seguridad del módulo

**Proceso de verificación**

Los reportes de agentes no se aceptaron sin contraste con la terminal. Una primera
auditoría de `@seguridad` se descartó como evidencia por citas de línea y salidas
fabricadas; la segunda se aceptó con reservas: sus conteos y líneas coinciden con la
terminal, pero no vio el 500 del urlencoded, el preflight sin cabeceras ni el
`Allow-Credentials` con origen no permitido, que salieron de la prueba real. Cada
módulo se cierra con arranque real y `curl.exe` ejecutados por Jonathan.

**Decisiones de seguridad derivadas del código**

Derivadas del código por el agente de documentación y contrastadas parcialmente por
Jonathan contra su terminal. No son las decisiones originales de `@seguridad`, cuyo
registro no fue localizado en el repo, pendiente de reconstruir con `@seguridad`.

*CORS*

1. CORS fail-closed: wildcard `*` y orígenes vacíos se descartan; sin orígenes
   permitidos se devuelve lista vacía (`create-app.ts`, `normalizeCorsOrigins`).
2. `credentials` solo si la lista de orígenes permitidos no está vacía
   (`create-app.ts`, `enableCors`).
3. Métodos y cabeceras por lista blanca explícita, sin `PUT` ni `Authorization`
   (`create-app.ts`, `CORS_ALLOWED_METHODS`, `CORS_ALLOWED_HEADERS`).

*Superficie del servidor*

4. `trust proxy` configurable por entorno y arrancando en 0 (fail-closed)
   (`create-app.ts`, `TRUST_PROXY_HOPS`).
5. `X-Powered-By` deshabilitado (`create-app.ts`, `expressInstance.disable`).
6. Cabeceras base propias, sin `helmet`: `X-Content-Type-Options: nosniff` y
   `Referrer-Policy: no-referrer` (`create-app.ts`, `BASELINE_SECURITY_HEADERS`).
7. Prefijo global `/api` y `rawBody: true` para la firma del webhook (`create-app.ts`,
   `setGlobalPrefix`).

*Cuerpo de petición*

8. Límites: JSON 1 MB y urlencoded 100 KB con `extended: false` (`create-app.ts`,
   `GLOBAL_BODY_LIMIT`, `URLENCODED_BODY_LIMIT`).
9. Errores de body-parser con mensajes fijos que nunca reflejan el cuerpo, y mapeo
   acotado a `entity.parse.failed` (`create-app.ts`, `MALFORMED_JSON_DETAIL`,
   `BODY_TOO_LARGE_DETAIL`, `isMalformedJsonError`).

*Manejo de errores*

10. Respuestas `application/problem+json` (RFC 9457) y detalle genérico en 5xx, sin
    mensaje ni stack (`problem-details.filter.ts`, `PROBLEM_JSON_CONTENT_TYPE`,
    `INTERNAL_SERVER_ERROR_DETAIL`, `resolveDetail`).
11. `detail` e `instance` sin query string, para que ningún secreto se refleje
    (`problem-details.filter.ts`, `sanitizeDetail`, `resolveInstance`).

*Logging*

12. Cabeceras registradas por allowlist; `query` y `params` nunca se registran; URL
    sin query string (`logger.config.ts`, `ALLOWED_REQUEST_HEADERS`,
    `serializeRequest`, `stripQueryString`).
13. Censura recursiva de campos sensibles a cualquier profundidad (`logger.config.ts`,
    `SENSITIVE_FIELD_NAMES`, `censorSensitive`, `censorError`).
14. `X-Request-Id` generado en servidor, ignorando deliberadamente el entrante
    (`logger.config.ts`, `genReqId`).

*Configuración y arranque*

15. `.env` solo con `NODE_ENV` en `development` o `test`, allowlist fail-closed
    (`env.schema.ts`, `shouldIgnoreEnvFile`).
16. Error de entorno con solo nombres y códigos de issue, sin valores interpolados
    (`env.schema.ts`, `validateEnv`).
17. Fallo de arranque genérico, con `error.code` solo si cumple el patrón alfanumérico
    con guiones bajos (`bootstrap-failure.ts`, `readSafeErrorCode`).
18. Ruta de `.env` con dos entradas relativas (`app.module.ts`, `envFilePath`).

*Validación y documentación*

19. Pipe Zod global y estricto que falla en arranque si un DTO falta (`zod.dto.ts`,
    `strictSchemaDeclaration`; registrado en `app.module.ts`, `APP_PIPE`).
20. Filtro de excepciones global (`app.module.ts`, `APP_FILTER`).
21. OpenAPI solo con el flag activo y bloqueado en producción por el schema
    (`create-app.ts`, `mountOpenApiDocumentation`; `env.schema.ts`, `superRefine`).
22. `/api/health` mínimo: `status: 'ok'`, sin uptime, entorno ni dependencias
    (`health.controller.ts`, `HealthController`).

**Excepciones verificadas en servidor real**

Comportamientos observados que se apartan de la regla general de correlación y
depuración:

- Los 413 y 400 de body-parser salen sin `requestId`, sin cabecera `X-Request-Id` y
  sin la línea `request completed` en el log [V].
- El preflight no genera log ni `X-Request-Id` [V].
- Causa [N]: hipótesis de que `pino-http` se monta en `init()`, después de los
  `app.use` de `createApp`. Pendiente de confirmar.

Responsable y módulo de cierre: **M4**. Detalle en *Deuda diferida*.

### Deuda diferida

- **M4** [V el síntoma; la causa marcada [N] arriba]: 413/400 de body-parser y
  preflight sin `requestId`, sin `X-Request-Id` y sin log.
- **M4** [V]: `envFilePath` con `['.env', '../../.env']` (`app.module.ts`) puede
  apuntar fuera del repo si el cwd es la raíz; debe cerrarse **antes** de añadir
  `DATABASE_URL`.
- **M4** [V]: validar en el schema de `env` el formato de `CORS_ORIGINS` (hoy
  `normalizeCorsOrigins` acepta cualquier cadena; falla cerrado pero en silencio).
- **M4** [U]: logging de URLs de redes descartadas por el schema (arrastrado de M2).
- **M7** [V los síntomas; la solución es propuesta]: `Authorization` y `PUT` fuera de
  `CORS_ALLOWED_HEADERS`/`CORS_ALLOWED_METHODS` (deliberado); `Allow-Credentials`
  presente con origen no permitido cuando la lista no está vacía; `Allow-Methods` y
  `Allow-Headers` anunciados en preflight denegado. Cierre previsto: `origin` como
  función por petición.
- Sin módulo asignado: `mountOpenApiDocumentation` no comprueba `NODE_ENV` (la defensa
  vive en `env.schema.ts`, `superRefine`) [V]; `censorNode` no desciende a objetos no
  planos; `SENSITIVE_ASSIGNMENT_PATTERN` no cubre claves con puntos ni unicode; el 4xx
  refleja `message` de errores ajenos. **Regla:** ningún validador ni middleware
  interpola valores recibidos en `message`, desde los DTO de M4.
- **Decisiones de `@seguridad` de M3:** registro no localizado en el repo, pendiente
  de reconstruir con `@seguridad`.
- Tests [V, salvo indicación]: duplicación entre `create-app.e2e.spec.ts` y
  `create-app.body-parser.spec.ts` (413/400 en ambos); doble cast en el helper de
  preflight por `supertest.d.ts` manual; flake puntual de `logger.config.spec.ts` sin
  mensaje original [N]: 1 fallo, luego 7 corridas en verde.
- Deuda aceptada [U]: `pnpm audit --prod` da 1 moderada, `js-yaml` 5.3.0, advisory
  `GHSA-r3ph-w7gj-g6xm` (parche en `>=5.4.1`), traída por `@nestjs/swagger@11.4.7`;
  sin `overrides` de pnpm; condición de salida compartida con Nest 12.
  `src/types/supertest.d.ts` manual (reemplazar por `@types/supertest` con versión
  exacta).

## Verificación ejecutada

Hallazgos en servidor real [V]:

- `X-Powered-By` ya no aparece. `/api/health` responde `200 {"status":"ok"}` con
  `nosniff` y `Referrer-Policy: no-referrer`.
- 404 con `?secret=XYZ`: el `detail` trae solo la ruta; `XYZ` no aparece en la
  respuesta ni en los logs.
- 413 y 400 por JSON: `problem+json` con `detail` fijo y sin reflejar el cuerpo.
- urlencoded >100 KB: 413 `problem+json` (antes 500).
- CORS: con `CORS_ORIGINS` vacío no sale `Allow-Origin` ni `Allow-Credentials`; con
  origen permitido sale el origen exacto (nunca `*`) con `Vary: Origin`; con origen
  no permitido no sale `Allow-Origin`.
- Un `SyntaxError` ajeno a body-parser ya no se etiqueta `"Malformed JSON body"`; Nest
  convierte SyntaxError en BadRequestException reflejando su message [N].
- `{"__proto__":{"x":1}}` da 400 `"Malformed JSON body"` (INFO: el JSON es válido,
  pero se rechaza; el mensaje es engañoso).
- Preflight con `Access-Control-Request-Method: PUT` da 204 con `Allow-Origin` y con
  `Allow-Methods` sin `PUT`. `cors` no deniega por método no listado, solo anuncia lo
  permitido. **No describir como "bloquea métodos".**
- `text/plain` y `PUT /api/health` dan 404 normales con `requestId`.

Verificación de herramientas [U]: prettier, lint y typecheck con exit 0 y 102 tests en
14 archivos (reporte del agente de implementación, contrastados en parte por
Jonathan).