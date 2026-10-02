# ADR-003 — ESLint + Prettier en lugar de Biome

**Estado:** Aceptado
**Fecha:** 2026-10-01
**Módulo:** M0 — Análisis y setup inicial

## Contexto

Hay que elegir linter y formateador del monorepo. El proyecto usa NestJS
(backend) y Next.js (frontend), dos frameworks cuyo tooling oficial asume
ESLint. Este ADR documenta la decisión y la evidencia que la sostiene, y deja
constancia de un hallazgo que corrige una suposición previa.

## Opciones consideradas

1. **ESLint 10 + Prettier 3** — dos herramientas: ESLint para análisis
   estático (incluidas reglas que requieren información de tipos) y Prettier
   como formateador.
2. **Biome 2** — una sola herramienta que hace lint y formato, en Rust.

## Decisión

ESLint 10.11.0 con `typescript-eslint` 8.71.0 (configuración flat, con análisis
de tipos) y Prettier 3.9.9 como formateador.

## Por qué

- **El tooling de NestJS y Next.js asume ESLint.** Los comandos `nest build` y
  `next lint` de los frameworks se integran con ESLint, y sus guías oficiales
  lo toman como presupuesto. Elegir Biome obliga a mantener una configuración
  paralela que los frameworks no conocen.
- **Las reglas que necesitan información de tipos funcionan.** Ejecutado con
  `projectService: true` y un tsconfig propio, un archivo con una promesa
  flotante dio exit 1 con dos errores:
  `@typescript-eslint/require-await` ("Async function 'doWork' has no 'await'
  expression") y `@typescript-eslint/no-floating-promises` ("Promises must be
  awaited, end with a call to .catch, end with a call to .then with a rejection
  handler or be explicitly marked as ignored with the `void` operator"). El
  análisis semántico está activo.
- **Biome no detecta la promesa flotante con sus reglas recomendadas.**
  Ejecutado con `recommended: true` dio exit 0, sin hallazgos. Solo la detecta
  si se habilita `lint/nursery/noFloatingPromises`, que pertenece al grupo
  nursery y está fuera de recommended. Para este proyecto, donde perder una
  promesa rechazada significa una petición que nunca responde, depender de una
  regla inestable no es suficiente.

## Corrección de una suposición anterior

Antes de decidir se daba por hecho que Biome no soportaba decoradores de
parámetro. **Eso es falso, y quedó desmentido ejecutándolo.** Biome 2.5.15,
instalado solo en una carpeta temporal fuera del repositorio (sin tocar el
`package.json` ni el `pnpm-lock.yaml` del proyecto, y eliminado al terminar):

- Sin la opción, `biome lint` dio exit 1 con error de parseo: "Decorators are
  not valid here. You can enable parameter decorators by setting the
  `unsafeParameterDecoratorsEnabled` option to `true` in your configuration
  file."
- Con la opción activada, dio exit 0: "Checked 1 file in 6ms. No fixes applied."

Detalle del camino de la opción: en Biome 2.5.15 va en
`javascript.parser.unsafeParameterDecoratorsEnabled`. Puesta al nivel de
`javascript`, la configuración falla al deserializar con "Found an unknown key
`unsafeParameterDecoratorsEnabled`".

Conclusión: Biome sí cubre los decoradores de parámetro, pero solo con una
opción que el propio Biome etiqueta como insegura. Este dato corrige la
afirmación anterior y queda registrado para que nadie la repita.

## Consecuencias y trade-offs aceptados

- Son dos herramientas en lugar de una, con una dependencia más.
- El formateo y el lint son pasos separados: `pnpm exec eslint .` y
  `pnpm exec prettier --check .`. Se desactivó el formateo desde ESLint para
  que las dos herramientas no compitan por el mismo código.
- ESLint no reporta los errores del compilador de TypeScript. Ejecutado: un
  decorador de parámetro NestJS dio exit 0 en ESLint, mientras
  `tsc` con el mismo archivo dio exit 2 con `error TS1206: Decorators are not
  valid here`. ESLint no da falsos positivos con decoradores, pero delega en
  el typecheck de cada app la responsabilidad de activar
  `experimentalDecorators` (ver ADR-002). Ninguno de los dos resultados
  contradice al otro: son capas distintas.
- `pnpm exec eslint .` pasa con exit 0 hoy, pero el repositorio solo contiene
  archivos de configuración: todavía no se ha probado con código de
  aplicación real.
- La resolución de `projectService` por app no está probada. Solo se validó
  con un tsconfig local temporal. TODO: verificar en M2/M3 cuando existan los
  tsconfig de cada app.
- `*.md` y `docs/` están en `.prettierignore`. El markdown del repositorio es
  contenido escrito por una persona y el reformateo de prosa genera ruido
  innecesario en los diffs. El coste: Prettier no revisa el markdown.

## Verificación ejecutada

- `pnpm exec eslint .`: exit 0, sin hallazgos.
- `pnpm exec prettier --check .`: exit 0.
- Prueba de promesa flotante: exit 1 con los dos errores citados arriba.
- Prueba de decorador NestJS: exit 0 en ESLint, exit 2 en `tsc` con TS1206.
- Prueba de Biome 2.5.15: exit 1 sin la opción, exit 0 con la opción en
  `javascript.parser`.
- Promesa flotante en Biome con `recommended: true`: exit 0, no detectada. Con
  `nursery.noFloatingPromises`: exit 1, detectada.
- Los archivos temporales de prueba se borraron y `git status` confirmó que no
  quedaron residuos dentro del repositorio.
