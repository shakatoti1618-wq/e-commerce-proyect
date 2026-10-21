# Bitácora del proyecto — Lumé

Línea de tiempo del proyecto: un registro corto por cada módulo cerrado y por cada evento relevante de configuración. El detalle de cada decisión técnica está en el ADR correspondiente de esta carpeta.

| Fecha | Módulo / evento | Resumen |
| --- | --- | --- |
| 2026-09-30 | Corrección de configuración previa al M0 | Se agrega el agente `@devops` (monorepo, tooling, commits y CI), se crea el `.gitignore` de la raíz y se ajustan los permisos de los agentes. |
| 2026-10-01 | M0 — Análisis y setup inicial | Monorepo con pnpm workspaces, pnpm 12.8.1 fijado, Node 24 LTS, TypeScript estricto, ESLint + Prettier (decidido sobre Biome con pruebas ejecutadas), CI con build bloqueante y commitlint solo en CI, y un único `.env.example` en la raíz. Decisiones en ADR-001 a ADR-004. |
| 2026-10-08 | M2 — Frontend base (Next.js) | Módulo cerrado el 2026-10-08 con 23 commits de implementación y configuración (más los commits `docs:` de esta documentación de cierre), del 2026-10-02 al 2026-10-08; tema único burdeos/negro/dorado sin dark mode; identidad de marca por cliente de Settings con fixture local y fallback a `/api/settings`; 4 rutas públicas placeholder (`/`, `/productos`, `/nosotros`, `/contacto`) accesibles; ESLint 9 temporal solo en `apps/frontend` (raíz en ESLint 10); auditoría de seguridad sin críticos ni altos y 4 fixes posteriores. Detalle en ADR-005. |
| 2026-10-20 | M3 — Backend base (NestJS) | Módulo implementado y documentado con 28 commits sobre main al momento de redactar esta fila (27 de implementación más el de ADR-006; la cifra definitiva se mide al abrir el PR); el cierre formal es el merge del PR, pendiente. NestJS 11 + Zod, errores `problem+json`, logging con censura, `/api/health`, CORS estricto fail-closed, cabeceras base, esqueleto OpenAPI solo con `ENABLE_SWAGGER=true`, 102 tests en 14 archivos. Cuatro fixes no pedidos tras prueba real y una auditoría de seguridad sin críticos ni altos (la primera se descartó como evidencia por citas fabricadas). Detalle en ADR-006. |

## Diferidos de M3

Estos puntos quedaron abiertos al implementar M3 (detalle y evidencia en ADR-006):

- M4: 413/400 de body-parser y preflight sin `requestId`, sin `X-Request-Id` y sin log.
- M4: `envFilePath` puede apuntar fuera del repo; cerrar **antes** de añadir `DATABASE_URL`.
- M4: validar el formato de `CORS_ORIGINS` en el schema de `env`.
- M4: logging de URLs de redes descartadas por el schema (arrastrado de M2).
- M7: `Authorization` y `PUT` fuera de CORS; `Allow-Credentials` con origen no permitido; `Allow-Methods` y `Allow-Headers` anunciados en preflight denegado.
- Antes del checkout: CSP y HSTS. Desde M7: rate limiting.
- Sin módulo asignado: defensa en profundidad de Swagger en producción, límites de `censorNode` y `SENSITIVE_ASSIGNMENT_PATTERN`, reflejo de `message` en los 4xx.
- Deuda aceptada: `js-yaml`, advisory `GHSA-r3ph-w7gj-g6xm` (vía `@nestjs/swagger@11.4.7`); `supertest.d.ts` manual.
- Registro de las decisiones de `@seguridad` de M3 no localizado; pendiente de reconstruir con `@seguridad`.

## Diferidos de M2

Estos puntos quedaron abiertos al cerrar M2 (detalle y evidencia en ADR-005):

- CSP y cabeceras de seguridad (X-Content-Type-Options, Referrer-Policy, frame-ancestors/X-Frame-Options y HSTS según el hosting final): obligatorio antes del módulo de checkout.
- Logo externo / `images.remotePatterns`: módulo de catálogo.
- Logging de URLs de redes descartadas por el schema: backend (M3/M4). M3 no lo implementó; se arrastra a M4.
- Normalización de `NEXT_PUBLIC_API_URL`: frontend, junto con el contrato `/api/settings`.
- URL `https://` con userinfo embebido aceptada por el schema de marca (I3): frontend, junto con el contrato `/api/settings`.
- `braces` (devDependency vía `eslint-config-next`): dev/tooling, monitoreo continuo con `pnpm audit`.
- Unificar `apps/frontend` a ESLint 10 cuando el tooling de Next.js esté verificado sobre esa versión (decisión puente en ADR-005); la raíz ya está en ESLint 10.

Nota: `poweredByHeader: false` no es deuda; está resuelto en `aef350b`.

Nota: los pendientes de M0 de la sección siguiente siguen abiertos; M2 no los cierra ni los modifica.

## Pendientes de M0

Estos puntos quedaron abiertos al cerrar M0 y hay que resolverlos más adelante:

- El CI nunca se ha ejecutado: no hubo push. Hay que verificarlo en el primer push a `main`. **Resuelto por el PR #1 (CI en verde), merge 2026-10-01.**
- El paso de commitlint por rango no se ha probado en un PR ni en un push real.
- Caso edge: en el push inicial de una rama, `github.event.before` es `0000000000000000000000000000000000000000` y el rango de commits no se puede calcular.
- `.github/workflows/ci.yml` no documenta ese caso edge con un comentario.
- `.env.example` no termina en newline final y `.editorconfig` pide `insert_final_newline = true`. **Resuelto en M3 (2026-10-20): el último byte es `10`.**
- No hay gestor de versiones de Node instalado (ni nvm, ni fnm, ni volta), así que la verificación local corrió sobre Node 26.5.0 mientras el proyecto declara Node 24 en `.nvmrc` y `engines`. **Resuelto en M3 (2026-10-20): `.nvmrc` fija 24 y `fnm` 1.39.0 sirve `node v24.21.0`.**
- La resolución de `projectService` por app no está probada; solo se validó con un tsconfig local temporal. **Resuelto parcialmente en M3 (2026-10-20): `pnpm -r lint` ejecuta `eslint .` en frontend y backend con exit 0 y `apps/backend` tiene `projectService: true`; `apps/frontend` sin confirmar.**
- El build bloqueante del CI es vacío en M0 porque `apps/` todavía no existe. Empieza a tener efecto real en M2/M3.