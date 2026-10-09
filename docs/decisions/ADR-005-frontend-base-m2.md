# ADR-005 — Frontend base (Next.js)

**Estado:** Aceptado
**Fecha:** 2026-10-08
**Módulo:** M2 — Frontend base (Next.js)

## Contexto

M0 dejó fijado el monorepo, las versiones y el CI (ADR-001 a ADR-004), y con el
merge del PR #1 a `main` (`dbfb659`) el workflow de GitHub Actions ya corrió al
menos una vez. Hasta M2 no existía ninguna aplicación: `apps/` estaba vacío, así
que el build bloqueante del CI (ADR-004) no compilaba nada. M2 levanta la
primera aplicación, el frontend en Next.js: layout base, tipografía y tema,
navegación pública y móvil, rutas públicas placeholder y el cliente de identidad
de marca. Este ADR registra las decisiones de esa base, el resultado de la
auditoría de seguridad del módulo y la deuda que queda diferida.

## Opciones consideradas

1. **Identidad de marca:** (a) variables de entorno `NEXT_PUBLIC_BRAND_*`
   horneadas en el bundle; (b) un cliente de Settings
   (`apps/frontend/src/lib/brand/index.ts`) con fixture local y fallback a
   `/api/settings` del backend.
2. **Versión de ESLint:** (a) forzar ESLint 10 también en `apps/frontend`;
   (b) dejar `apps/frontend` en ESLint 9 de forma temporal, con la raíz en
   ESLint 10.
3. **Tipografía:** (a) fijar ya la definitiva de la marca; (b) usar Outfit de
   forma provisional vía `next/font/google`.
4. **Tema:** (a) tema claro/oscuro con toggle; (b) un único tema fijo con la
   paleta de marca.
5. **Schema de marca:** para `social`, (a) fail-closed total, (b)
   `.default({})` para el campo ausente, (c) `.default({})` + `.catch({})` para
   tolerar cualquier valor inválido. Para las URLs, (a) validar solo en el
   schema, (b) validar en el schema y reforzar en `collectSocialLinks`.

## Decisiones

1. **La identidad de marca llega por un cliente de Settings, no por variables
   `NEXT_PUBLIC_BRAND_*`.** El punto de entrada es `getBrandIdentity()` en
   `apps/frontend/src/lib/brand/index.ts`. Intenta `fetchBrandFromApi()`:
   `GET ${NEXT_PUBLIC_API_URL}/api/settings` con `AbortController` (timeout de
   2 s) y `next: { revalidate: 3600 }`; si no hay `NEXT_PUBLIC_API_URL`, si la
   respuesta no es `ok`, si hay error de red o si el payload no pasa
   `brandSchema.safeParse`, devuelve `null` y cae al `localBrandFixture`. El
   fixture solo cubre el backend ausente o caído; el schema Zod valida lo que
   venga del endpoint y el fixture es la red de seguridad si no valida.

2. **ESLint 9 solo en `apps/frontend`, de forma temporal; la raíz sigue en
   ESLint 10.** La raíz usa `eslint@10.11.0` con `typescript-eslint@8.71.0`
   (ADR-003) e ignora `apps/frontend/**` en su `eslint.config.mjs`.
   `apps/frontend` tiene su propia configuración (`eslint-config-next`) y su
   propia versión (`eslint@9.39.5`). **Condición de salida (decisión puente, no
   permanente):** pasar `apps/frontend` a ESLint 10 y unificar una sola versión
   en el monorepo cuando el tooling de Next.js esté verificado sobre ESLint 10.

3. **Outfit como tipografía provisional (`next/font/google`).** En
   `src/lib/fonts.ts`, `Outfit({ subsets: ['latin'], display: 'swap',
   variable: '--font-brand' })`: variable y subconjunto latin. `next/font` exige
   valores estáticos en tiempo de build, por eso la fuente es una constante y no
   una variable de entorno. La tipografía definitiva la decide la marca.

4. **Un solo tema fijo: burdeos/negro con acentos dorados.** Los tokens viven en
   `src/app/globals.css` bajo `@theme` (Tailwind v4) y son provisionales. No hay
   variante clara/oscura ni toggle. El contraste WCAG 2.1 está calculado y
   anotado en el propio CSS, y los componentes consumen tokens, nunca colores
   literales.

5. **Schema de marca: FAIL-CLOSED para `name`, `tagline` y `logo`; `social`
   tolera cualquier valor inválido.** En `brandSchema`, `name`, `tagline` y
   `logo` son obligatorios y, si faltan o no validan, tumban todo el
   `safeParse` y cae el fixture. `social` es
   `z.object({ ... }).default({}).catch({})`: `.default({})` cubre el campo
   ausente y `.catch({})` normaliza a `{}` **cualquier** valor que no sea un
   objeto válido (`null`, string, número, array o booleano), no solo `null`. La
   consecuencia es que las redes se pierden sin traza (el comentario corregido
   en `ca21337` lo documenta). La protección anti-URLs no-https es doble:
   `optionalSocialUrl` (`.url()` + `startsWith('https://')`) en el schema y
   `collectSocialLinks` en `navigation.ts` (`startsWith('https://')` exacto).
   `logoSource` acepta una ruta local segura o una URL https: rechaza rutas
   protocol-relative, barra invertida, barra al inicio, caracteres de control,
   la raíz `/` (corregido en `c44505f`) y las rutas que no resuelven al mismo
   origen.

## Por qué

- **Marca por Settings y no por `NEXT_PUBLIC_BRAND_*`.** Las variables
  `NEXT_PUBLIC_*` se hornean en el bundle en tiempo de build: cambiar la marca
  obligaría a recompilar y redesplegar, y repartiría la identidad entre el
  entorno y el código. La marca es un dato de negocio que debe venir del
  backend y editarse sin tocar el frontend. `getBrandIdentity()` centraliza esa
  lectura en un único punto y deja el fixture solo para el caso de backend
  ausente o caído.
- **ESLint 9 aislado en el frontend.** La raíz ya está en ESLint 10 con
  `typescript-eslint`; `apps/frontend` necesita `eslint-config-next`, que se dejó
  sobre ESLint 9. En lugar de forzar la versión en un solo sentido, se aisló el
  frontend: la raíz ignora `apps/frontend/**` y el frontend lleva su propia
  configuración y su propia versión. Es un puente, no un destino.
- **Outfit provisional.** `next/font` exige valores estáticos en build time, así
  que la fuente es una constante en `fonts.ts`, no una variable de entorno.
  Outfit (variable, latin) da un punto de partida sólido sin comprometer el
  peso de carga; la elección final la decide la marca y se cambia en un solo
  archivo.
- **Tema único.** La marca pidió "Lujo con color", no un modo oscuro
  conmutable. Un único tema evita mantener dos paletas, dos estados y la lógica
  de preferencia. El contraste WCAG 2.1 vive en el CSS y los componentes no
  llevan colores literales, así que el cambio de paleta es local a los tokens.
- **Fail-closed en la identidad, tolerante en las redes.** `name`, `tagline` y
  `logo` son la identidad: si faltan o no validan, mostrar una marca a medias no
  tiene sentido, así que tumban el `safeParse` y cae el fixture completo.
  `social` no es esencial: tolerar cualquier valor inválido evita que un campo
  secundario rompa toda la marca. La doble barrera —schema y
  `collectSocialLinks`— hace que ninguna URL que no sea `https://` llegue al
  footer, incluso si una de las capas falla.

## Consecuencias y trade-offs aceptados

- La tienda renderiza sin backend: `getBrandIdentity()` cae al fixture. A
  cambio, mientras no exista `/api/settings` (M3/M4) la marca real no puede
  cambiar sin tocar el código, y el fixture lleva TODOs.
- Conviven dos versiones de ESLint en el repositorio (10 en la raíz, 9 en
  `apps/frontend`). Es deuda de tooling controlada, con condición de salida
  explícita (decisión 2).
- Outfit y la paleta son provisionales. Ambos están centralizados (`fonts.ts` y
  los tokens de `globals.css`) para que el cambio de marca sea local.
- Ante un `social` inválido, las redes se pierden sin traza y no se distingue de
  un campo ausente; el logging de esas URLs queda diferido al backend.
- El build bloqueante del CI (ADR-004) pasa a tener efecto real: por primera vez
  `apps/` tiene una aplicación que compila.
- `apps/frontend` todavía no tiene script de `test`; solo `lint`, `typecheck` y
  `build`.

### Auditoría de seguridad del módulo

`@seguridad` hizo una revisión de solo lectura sobre la base `70c0242`. Resultado:
**sin hallazgos críticos ni altos.** Códigos de severidad: medio (M), bajo (B) e
informativo (I).

- M1 (`braces`, dependencia transitiva de dev): diferido.
- M2 (logo externo / `images.remotePatterns`): diferido.
- B1 (`social: null` rompía el `safeParse`): corregido en `5af5b17`.
- B2 (logging de redes descartadas): diferido.
- B3 (`logo: '/'`): corregido en `c44505f`.
- I1 (cabeceras de seguridad / CSP): el `X-Powered-By` se eliminó en `aef350b`;
  el resto de cabeceras y CSP queda diferido.
- I2 (normalización de `NEXT_PUBLIC_API_URL`): diferido.
- I3 (URL `https://` con userinfo embebido): diferido.

Los 4 commits de corrección posteriores a la auditoría, todos sobre `70c0242`,
son:

- `aef350b` `fix(frontend): disable x-powered-by header` — `poweredByHeader:
  false`. **RESUELTO: no es deuda.**
- `5af5b17` `fix(frontend): tolerate null social in brand payload` —
  `social: .default({}).catch({})`.
- `c44505f` `fix(frontend): reject root path as logo source` — se rechaza `/`
  como logo.
- `ca21337` `docs(frontend): correct social fallback comment` — corrige el
  comentario del schema.

### Deuda diferida

| Deuda | Módulo responsable |
| --- | --- |
| CSP y cabeceras de seguridad (X-Content-Type-Options, Referrer-Policy, frame-ancestors/X-Frame-Options, y HSTS según el hosting que se use finalmente) | Obligatoria ANTES del módulo de checkout |
| Logo externo / `images.remotePatterns` (hoy no aplica: el fixture usa `/logo.svg`; el `unoptimized` de `Logo.tsx` se salta la validación de hosts) | Módulo de catálogo |
| Logging de URLs de redes descartadas por el schema (hoy se pierden sin traza) | Backend (M3/M4) |
| Normalización de `NEXT_PUBLIC_API_URL` (validar protocolo/barra final) | Frontend, junto con el contrato `/api/settings` |
| URL `https://` con userinfo embebido (`https://usuario:clave@host`) aceptada por el schema de marca (I3) | Frontend, junto con el contrato `/api/settings` |
| `braces` (devDependency, vía `eslint-config-next`) con advisory alto sin parche; dev-only, monitorear con `pnpm audit` | Dev/tooling, monitoreo continuo |

## Verificación ejecutada

- `git rev-list --count main..ca21337` (cierre técnico del módulo) = 24 commits,
  del 2026-10-02 al 2026-10-08, de los cuales 23 son de implementación y
  configuración. La rama parte de `main` en `dbfb659` (merge del PR #1); la base
  revisada por la auditoría es `70c0242` y el HEAD del cierre técnico es
  `ca21337`.
- Los 24 commits del módulo hasta el cierre técnico (`ca21337`), de más reciente
  a más antiguo:

  ```
  ca21337 docs(frontend): correct social fallback comment
  c44505f fix(frontend): reject root path as logo source
  5af5b17 fix(frontend): tolerate null social in brand payload
  aef350b fix(frontend): disable x-powered-by header
  70c0242 chore: align env example with brand settings source
  fca4127 fix(frontend): add base heading styles and fix stale comments
  f887882 fix(frontend): use a single main navigation landmark
  2bbf65b ci: check formatting and lint root files
  1fe6e5d fix(frontend): clean navigation comment and re-check https in social links
  62af71a fix(frontend): improve landmarks, logo alt and focus styles
  4b7a9fb chore(frontend): format files with prettier
  87468ad feat(frontend): add public routes with placeholder content
  bf4d2e5 feat(frontend): add accessible header, footer and mobile navigation
  f9d67f7 feat(frontend): add placeholder logo and icon assets
  fbe536b fix(frontend): reject control characters in brand logo path
  ec5226a fix(frontend): generate Next types before typecheck and drop local fetch type
  6d81a49 chore(repo): ignore next-env.d.ts
  2c697e5 feat(frontend): add base layout, fonts and metadata
  c68e726 fix(frontend): harden brand schema against external logo paths and empty socials
  bfa7829 feat(frontend): add typed brand settings client with local fallback
  8301263 fix(frontend): correct AA label and remove brand name from theme comment
  ff9cd80 feat(frontend): add luxury-with-color theme tokens
  6491068 chore(frontend): scaffold Next.js app with pinned toolchain
  27015ab chore(repo): ignore frontend in root eslint and skip unrs-resolver build
  ```

- De esos 24, `ca21337` es de tipo `docs` (corrige el comentario del schema). A
  partir de ahí, la documentación de cierre añade los commits `docs:` de este
  módulo (ADR-005, entrada de bitácora y las correcciones de conteo). Por eso el
  desglose estable es: **23 commits de implementación y configuración** + los
  commits `docs:` correspondientes. El total de la rama se verifica en el
  momento de abrir el PR con `git rev-list --count main..HEAD`.
- En los 4 fixes de auditoría se ejecutaron `pnpm format:check`, `pnpm
  typecheck`, `pnpm lint` y `pnpm build`: exit 0 en todos.
- Verificación del usuario: `/`, `/productos`, `/nosotros` y `/contacto`
  responden 200; `/nada` responde 404; revisión visual aprobada.
- Verificado en el repositorio: raíz `eslint@10.11.0` y `apps/frontend`
  `eslint@9.39.5`; el `eslint.config.mjs` de la raíz ignora `apps/frontend/**`;
  `eslint-config-next@16.3.8` declara como peer `eslint >=9.0.0`; `next.config.mjs`
  con `poweredByHeader: false`; `fonts.ts` con `Outfit({ subsets: ['latin'],
  display: 'swap', variable: '--font-brand' })`; tokens `@theme` en
  `globals.css` con los ratios WCAG anotados; `brand/index.ts` con el schema y
  el fallback; `navigation.ts` con `collectSocialLinks`.
- `pnpm exec prettier --check .` para confirmar que el resto del árbol sigue
  limpio. El markdown está excluido en `.prettierignore` (ADR-003), así que este
  ADR no se reformatea con Prettier.
