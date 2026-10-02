# Bitácora del proyecto — Lumé

Línea de tiempo del proyecto: un registro corto por cada módulo cerrado y por cada evento relevante de configuración. El detalle de cada decisión técnica está en el ADR correspondiente de esta carpeta.

| Fecha | Módulo / evento | Resumen |
| --- | --- | --- |
| 2026-09-30 | Corrección de configuración previa al M0 | Se agrega el agente `@devops` (monorepo, tooling, commits y CI), se crea el `.gitignore` de la raíz y se ajustan los permisos de los agentes. |
| 2026-10-01 | M0 — Análisis y setup inicial | Monorepo con pnpm workspaces, pnpm 12.8.1 fijado, Node 24 LTS, TypeScript estricto, ESLint + Prettier (decidido sobre Biome con pruebas ejecutadas), CI con build bloqueante y commitlint solo en CI, y un único `.env.example` en la raíz. Decisiones en ADR-001 a ADR-004. |

## Pendientes de M0

Estos puntos quedaron abiertos al cerrar M0 y hay que resolverlos más adelante:

- El CI nunca se ha ejecutado: no hubo push. Hay que verificarlo en el primer push a `main`.
- El paso de commitlint por rango no se ha probado en un PR ni en un push real.
- Caso edge: en el push inicial de una rama, `github.event.before` es `0000000000000000000000000000000000000000` y el rango de commits no se puede calcular.
- `.github/workflows/ci.yml` no documenta ese caso edge con un comentario.
- `.env.example` no termina en newline final y `.editorconfig` pide `insert_final_newline = true`.
- No hay gestor de versiones de Node instalado (ni nvm, ni fnm, ni volta), así que la verificación local corrió sobre Node 26.5.0 mientras el proyecto declara Node 24 en `.nvmrc` y `engines`.
- La resolución de `projectService` por app no está probada; solo se validó con un tsconfig local temporal.
- El build bloqueante del CI es vacío en M0 porque `apps/` todavía no existe. Empieza a tener efecto real en M2/M3.