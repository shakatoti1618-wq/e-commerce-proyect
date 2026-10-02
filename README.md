<!-- TODO: reemplazar por el logo/banner final una vez definido -->

# Lumé

E-commerce de accesorios y maquillaje con pagos reales, construido con NestJS + Next.js. Arquitectura escalable, segura y lista para marca blanca.

<!-- TODO: badges reales una vez configurado el CI (build status, coverage, licencia) -->

## Tabla de contenido

- [Sobre el proyecto](#sobre-el-proyecto)
- [Stack técnico](#stack-técnico)
- [Arquitectura](#arquitectura)
- [Empezando](#empezando)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Scripts disponibles](#scripts-disponibles)
- [Seguridad](#seguridad)
- [Documentación y decisiones técnicas](#documentación-y-decisiones-técnicas)
- [Roadmap](#roadmap)
- [Licencia](#licencia)

## Sobre el proyecto

Lumé es una tienda online de accesorios y maquillaje pensada para todo público, con estilo de "lujo accesible". El proyecto se construyó desde cero aplicando buenas prácticas de arquitectura, seguridad y escalabilidad, ya que maneja **pagos reales y datos de clientes**.

Además de ser una tienda funcional, el proyecto está diseñado como base **white-label**: toda la identidad de marca (nombre, logo, colores, textos, contacto) vive en configuración, no en el código, por lo que puede adaptarse a otra marca sin reescribir la aplicación.

## Stack técnico

**Backend**
- Node.js + TypeScript + [NestJS](https://nestjs.com/)
- PostgreSQL + [Prisma](https://www.prisma.io/) (proveedor: [Neon](https://neon.tech/))
- Redis + BullMQ para cache y colas
- Autenticación con JWT + Argon2id
- [Wompi](https://wompi.co/) como pasarela de pagos (checkout tokenizado, sin manejo directo de datos de tarjeta)

**Frontend**
- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- Tailwind CSS

**Testing**
- Vitest + Supertest (backend)
- Playwright (end-to-end)

**CI/CD**
- GitHub Actions

## Arquitectura

- **Monorepo** con `apps/backend` (API NestJS) y `apps/frontend` (Next.js), pensado para que un futuro cliente adicional (por ejemplo una app móvil) consuma la misma API sin cambios.
- Arquitectura por capas en el backend: `controller → service → repository`, con DTOs y validación (Zod) en cada endpoint.
- Autorización de datos resuelta en la capa de NestJS (guards/servicios), no delegada a políticas de base de datos.
- Todo pago pasa por checkout hospedado/tokenizado del proveedor — el backend nunca almacena ni procesa datos crudos de tarjeta.

## Empezando

### Prerrequisitos

- Node.js LTS
- pnpm (o el gestor de paquetes que use el proyecto)
- Una base de datos PostgreSQL (local o Neon)

### Instalación

```bash
git clone https://github.com/shakatoti1618-wq/e-commerce-proyect.git
cd e-commerce-proyect
pnpm install
```

### Variables de entorno

Hay un único archivo `.env.example` en la raíz del repositorio, organizado en tres secciones: **Backend**, **Frontend** y **Marca blanca**. Solo contiene placeholders: los valores reales van en un `.env` local, que nunca se versiona.

Copia el archivo y complétalo:

```bash
cp .env.example .env
```

Dos cosas importantes:

- **Al frontend solo llegan las variables `NEXT_PUBLIC_*`.** Cualquier otra variable del backend nunca debe exponerse al bundle del cliente, porque quedaría visible de forma pública. Ante la duda, no la expongas.
- La sección de **Marca blanca** es la fuente de verdad de la identidad de la tienda (nombre, logo, colores, contacto, redes). En una implementación con tabla `Settings`, esos valores podrán sobreescribirse desde el panel admin. Así, rebrandear la tienda es cambiar configuración, no reescribir código.

### Correr en desarrollo

```bash
pnpm dev
```

## Estructura del proyecto

```
.
├── apps/
│   ├── backend/       # API NestJS
│   └── frontend/      # Aplicación Next.js
├── docs/
│   ├── decisions/      # ADRs y bitácora del proyecto
│   └── definition-of-done.md
└── .opencode/          # Configuración de agentes de desarrollo (uso interno)
```

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Levanta backend y frontend en modo desarrollo |
| `pnpm build` | Compila ambas apps para producción |
| `pnpm test` | Corre la suite de tests |
| `pnpm lint` | Revisa estilo y errores con ESLint |
| `pnpm typecheck` | Verifica los tipos con TypeScript |
| `pnpm format` | Formatea el código con Prettier |
| `pnpm format:check` | Verifica el formato sin escribir cambios |

Los scripts de la raíz recorren los paquetes del workspace. Mientras no exista `apps/`, salen sin hacer nada; empezarán a validar de verdad cuando existan las aplicaciones (M2/M3).

## Seguridad

Este proyecto maneja dinero real y datos de clientes, por lo que sigue prácticas explícitas de seguridad: validación estricta de entrada, rate limiting, verificación de firma en webhooks de pago, idempotencia en operaciones de pago, hashing de contraseñas con Argon2id, y auditoría de acciones sensibles. El detalle completo está en [`docs/definition-of-done.md`](./docs/definition-of-done.md).

Si encuentras una vulnerabilidad, por favor repórtala de forma privada. <!-- TODO: agregar canal de contacto real para reportes de seguridad -->

## Documentación y decisiones técnicas

Cada decisión de arquitectura importante está documentada como un ADR (Architecture Decision Record) en [`docs/decisions/`](./docs/decisions/), junto con una bitácora cronológica del desarrollo del proyecto en `docs/decisions/BITACORA.md`.

## Roadmap

- [ ] MVP: catálogo, carrito, checkout y pagos con Wompi
- [ ] Panel de administración
- [ ] Indexación y SEO
- [ ] App móvil (arquitectura ya preparada para esto — ver ADRs de autenticación)

## Licencia

<!-- TODO: definir licencia (o marcar como propietario/privado si no se va a hacer open source) -->
