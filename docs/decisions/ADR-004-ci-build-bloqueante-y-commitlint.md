# ADR-004 - CI con build bloqueante y commitlint solo en CI

**Estado:** Aceptado
**Fecha:** 2026-10-01
**Módulo:** M0 - Análisis y setup inicial

## Contexto

El proyecto se despliega con pagos reales, así que un commit que no compila o
un mensaje de commit que no sigue la convención no puede pasar inadvertido. Hay
que decidir cómo se valida eso: si con hooks locales o con el CI, y si el build
puede fallar sin bloquear.

## Opciones consideradas

1. Validar el mensaje de commit con hooks locales (husky) en la máquina de cada
   desarrollador, o validarlo en el CI.
2. Dejar que el paso de build falle sin bloquear el pipeline, o bloquearlo.

## Decisión

- GitHub Actions con dos jobs: `quality` (install, lint, typecheck, test, build)
  y `commitlint`.
- El paso de build es **bloqueante**: sin `continue-on-error` en ningún paso.
- commitlint se ejecuta **solo en el CI**, sin husky ni ningún hook local.

## Por qué

- **Sin hooks locales.** Un hook solo se ejecuta en la máquina de quien
  commitea. Se puede saltar con `--no-verify` y no cubre a quien commitea desde
  otra parte. El CI valida todos los commits que llegan al repositorio,
 includedo los que vienen de otra máquina. La convención queda garantizada en
  el punto donde importa.
- **Build bloqueante.** Un build que falla y no frena nada deja pasar código
  roto. Con `continue-on-error` el pipeline se pone verde aunque el artefacto no
  exista. En este proyecto eso significa desplegar algo que ni siquiera
  compila.
- **`fetch-depth: 0` en los checkouts.** El paso de commitlint valida un rango
  de commits, y para calcular ese rango hace falta el historial completo. Con
  el clon superficial por defecto de Actions, el rango no se puede calcular.
- **`permissions: contents: read`.** El CI solo necesita leer el código. El
  mínimo privilegio reduce el daño si algo se compromete.

## Configuracion resultante

Disparadores: `pull_request` sobre `main` y `push` sobre `main`.

Job `quality`: `actions/checkout@v5.0.0` con `fetch-depth: 0`,
`pnpm/action-setup@v4.1.0` con version `12.8.1` y `run_install: false`,
`actions/setup-node@v5.0.0` con `node-version: '24'` y `cache: pnpm`, y luego
`pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build`.

Job `commitlint`: `actions/checkout@v5.0.0` con `fetch-depth: 0` y
`wagoid/commitlint-github-action@v6.2.1` con `configFile: commitlint.config.mjs`,
`from: ${{ github.event.pull_request.base.sha || github.event.before }}` y
`to: ${{ github.sha }}`. El mismo `from` cubre los dos casos: en un PR usa el
commit base del PR, y en un push a main usa el commit anterior al push.

El archivo `commitlint.config.mjs` extiende `@commitlint/config-conventional` y
restringe el tipo a: build, chore, ci, docs, feat, fix, perf, refactor, style,
test. `subject-case` queda desactivado.

Todas las actions van con version fijada. No se usa `@main` ni `@master`.

## Consecuencias y trade-offs aceptados

- El mensaje del commit se valida al subirlo, no al escribirlo. El
  desarrollador se entera en el CI, un instante después de commitear.
- No hay proteccion local, asi que un commit con mensaje invalido llega al
  historial. El commitlint del CI lo senala y se corrige en el siguiente commit.
  Se acepta: la alternativa (hooks) se puede saltar y no cubre otras maquinas.
- `pnpm install --frozen-lockfile` en CI hace fallar el pipeline si el
  `package.json` y el `pnpm-lock.yaml` no coinciden. Es deliberado: el lockfile
  se versiona y es la fuente de verdad de las versiones.

## Lo que NO esta verificado (TODO)

Esto es lo mas importante de este ADR: **el workflow no se ha ejecutado nunca.**

- No se ha hecho push, asi que el CI nunca ha corrido en GitHub. Lo unico
  verificado es que el archivo es YAML valido y que su estructura es la
  esperada. Verificado parseando el YAML con un parser real: 2 jobs
  (`quality`, `commitlint`), 2 triggers, `node-version: 24`, pnpm `12.8.1`,
  8 pasos en el job `quality`, `fetch-depth: 0` en los dos checkouts, y
  `continue-on-error` ausente del archivo.
- El paso de commitlint por rango no se ha probado en un PR real ni en un push
  real a `main`.
- Caso edge conocido: en el push inicial de una rama, `github.event.before`
  vale `0000000000000000000000000000000000000000` y el rango `from..to` no se
  puede calcular. TODO: validar ese caso en el primer push real y ajustar el
  rango si `wagoid/commitlint-github-action` lo rechaza.
- El archivo `ci.yml` no tiene un comentario YAML que documente ese caso edge.
  TODO: anadirlo.
- El build bloqueante es vacuo en M0: todavia no existe `apps/`, asi que
  `pnpm -r --if-present build` no compila nada y sale con codigo 0. El build
  empieza a tener efecto real en M2/M3, cuando existan las aplicaciones.
  Verificado que `pnpm -r --if-present` con cero paquetes sale 0 sin usar
  `|| true`.