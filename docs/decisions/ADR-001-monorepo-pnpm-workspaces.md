# ADR-001 — Monorepo con pnpm workspaces (sin Turborepo por ahora)

**Estado:** Aceptado
**Fecha:** 2026-10-01
**Módulo:** M0 — Análisis y setup inicial

## Contexto

Lumé tiene dos aplicaciones que comparten contratos de datos e identidad de
marca: una API en NestJS y un frontend en Next.js. Este ADR fija la estructura
sobre la que se construirán en M2 y M3, cuando las apps existan.

## Opciones consideradas

Estructura: (1) monorepo con `apps/backend` y `apps/frontend`;
(2) multi-repo, un repositorio por aplicación.

Orquestación: (1) pnpm workspaces sin orquestador, con los scripts raíz
delegando en `pnpm -r --if-present`; (2) pnpm workspaces + Turborepo, con
caché de tareas y grafo de dependencias.

## Decisión

Monorepo con pnpm workspaces, declarando `apps/*` en `pnpm-workspace.yaml`.
Sin Turborepo por ahora.

## Por qué

- Backend y frontend comparten tipos y contratos; en un solo repositorio un
  cambio en un contrato se ve de inmediato en ambos lados.
- La identidad de marca (nombre, logo, paleta, textos) es configuración
  compartida; un solo lugar simplifica el rebrand.
- Un cliente futuro (por ejemplo una app móvil) debe consumir la misma API sin
  tocar el backend. El monorepo deja esa puerta abierta.
- Turborepo se reserva para más adelante: en M0 no hay apps que compilar, así
  que su caché y su grafo no aportan nada hoy y solo añadirían una
  dependencia y un archivo de configuración más que mantener.

## Consecuencias y trade-offs aceptados

- El historial mezcla cambios de frontend y backend.
- Cada app necesita su propio `tsconfig.json` y sus propios scripts de
  `typecheck`, `lint`, `test` y `build`; la raíz los orquesta con `pnpm -r`.
- El typecheck se delega por app y no es global (ver ADR-002).
- Turborepo se reevalúa cuando el tiempo de compilación del CI sea un problema
  real, no antes.
- Con cero paquetes de workspace, `pnpm -r --if-present` sale con código 0 sin
  ejecutar nada. Verificado en M0. Por tanto `pnpm build` en la raíz es un
  no-op hasta que existan las apps: el build bloqueante del CI empieza a
  tener efecto real en M2/M3.

## Verificación ejecutada

- `pnpm install` desde cero, borrando `node_modules` y el lockfile: exit 0.
- `pnpm -r --if-present build` con cero paquetes: exit 0, sin `|| true`.
- `pnpm-workspace.yaml` declara `packages: ['apps/*']`.
- No existe `turbo.json` en el repositorio.
