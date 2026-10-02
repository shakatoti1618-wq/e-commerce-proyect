# ADR-002 — pnpm fijado, Node 24 LTS y TypeScript estricto

**Estado:** Aceptado
**Fecha:** 2026-10-01
**Módulo:** M0 — Análisis y setup inicial

## Contexto

El proyecto maneja dinero real y datos de clientes, así que la reproducibilidad
del entorno es un requisito, no una comodidad: dos personas deben instalar lo
mismo y obtener el mismo resultado. En M0 no hay apps todavía, pero el andamiaje
se fija ahora.

## Opciones consideradas

Gestor de paquetes: npm (viene con Node), pnpm o yarn. Versión de Node: la
línea LTS actual (24.x) o la línea Current (26.x). TypeScript: configuración
estricta compartida en la base del monorepo o configuración laxa por app.

## Decisión

- pnpm 12.8.1, fijado en `packageManager` dentro de `package.json`.
- Node 24 LTS: `.nvmrc` con `24` y `engines.node: ">=24"`.
- TypeScript estricto compartido en `tsconfig.base.json`, y `typecheck`
  delegado por app.

## Por qué

- **pnpm.** Resolución rápida y, sobre todo, un store con enlaces duros: los
  paquetes se comparten entre proyectos en vez de duplicarse. pnpm detecta
  dependencias no declaradas, lo que ayuda a mantener el árbol correcto. Fijar
  la versión en `packageManager` evita que cada quien instale una distinta.
- **Node 24 y no 26.** Verificado contra nodejs.org: la línea 26.x es "Current",
  no LTS; entra a LTS el 28-oct-2026. La LTS vigente es 24.x "Krypton". Para un
  proyecto que maneja pagos reales conviene la línea con soporte prolongado.
- **TypeScript estricto.** Las banderas activadas en `tsconfig.base.json` son
  `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`,
  `forceConsistentCasingInFileNames`, `esModuleInterop`, `skipLibCheck`,
  `resolveJsonModule` e `isolatedModules`. `noUncheckedIndexedAccess` y
  `exactOptionalPropertyTypes` importan en un e-commerce: con ellas el código no
  puede asumir que un índice de array existe, ni que un campo opcional siempre
  trae valor. Ambas previenen errores que aparecen tarde, en producción.
- **Typecheck por app, no un typecheck raíz global.** Un typecheck raíz que
  valida todo el monorepo choca con que NestJS resuelve módulos como Node
  (CommonJS) y Next.js usa resolución de tipo bundler, más los tipos generados
  en `.next` durante el build. Delegar por app deja que cada una elija su
  sistema de módulos sin romper la base compartida. Cada app tendrá su
  `tsconfig.json` heredando de `tsconfig.base.json` (M2/M3).

## Consecuencias y trade-offs aceptados

- El machine de desarrollo tiene Node v26.5.0 y no hay gestor de versiones
  instalado (ni nvm, ni fnm, ni volta), así que la verificación local de M0
  corrió sobre Node 26 mientras el proyecto declara 24. La verificación local
  no reproduce entonces exactamente el entorno de CI. TODO: instalar un gestor
  de versiones para que la verificación local use Node 24.
- `exactOptionalPropertyTypes` y `noUncheckedIndexedAccess` hacen que algo de
  código que en modo laxo compila, ahora exija un chequeo explícito. Se acepta
  ese coste inicial: es menor que los errores que evita.
- **Reevaluar Node 26 cuando entre en LTS (28-oct-2026).** Este ADR no es
  eterno. Cuando la línea 26 sea LTS, se debe decidir si se sube `.nvmrc` y
  `engines`. Si se decide cambiar, se escribe un ADR nuevo que referencie a
  este, sin reescribirlo.

## Verificación ejecutada

- Versiones comprobadas una por una contra el registro con
  `npm view <pkg>@<version> version` antes de fijarlas: pnpm 12.8.1,
  typescript 5.9.2, eslint 10.11.0, typescript-eslint 8.71.0, prettier 3.9.9,
  @commitlint/cli 21.2.3.
- Detalle: `@eslint/js@10.11.0` no existe en el registro; la versión válida es
  `@eslint/js@10.0.1`. Se detectó al instalar, no al fijar.
- `pnpm install` desde cero: exit 0, "Packages: +167".
- `pnpm install --frozen-lockfile`: exit 0, "Lockfile is up to date".
- `pnpm exec tsc` y los scripts de la raíz salen 0.
- Store de pnpm resuelto en `D:\.pnpm-store\v11`, fuera de OneDrive. pnpm 12
  resuelve el store por unidad: desde el repositorio da `D:`, desde el home da
  la ruta local de usuario.
- No existe ningún `.npmrc`, ni en el repositorio ni en el usuario.

