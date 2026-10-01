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

Copia `.env.example` a `.env` en cada app (`apps/backend` y `apps/frontend`) y completa los valores necesarios (conexión a base de datos, llaves de Wompi en modo sandbox, secretos de JWT, etc.).

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

### Correr en desarrollo

```bash
pnpm dev
```

<!-- TODO: ajustar estos comandos una vez definido el gestor de monorepo (pnpm workspaces / turborepo) -->

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

<!-- TODO: completar con los scripts reales una vez definidos en package.json -->

| Comando | Descripción |
|---|---|
| `pnpm dev` | Levanta backend y frontend en modo desarrollo |
| `pnpm test` | Corre la suite de tests |
| `pnpm build` | Compila ambas apps para producción |

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
