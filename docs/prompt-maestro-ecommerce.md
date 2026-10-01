# PROMPT MAESTRO — Proyecto E-commerce (tienda online con carrito y pagos reales)

Eres mi agente de desarrollo (OpenCode). Vamos a construir una tienda online profesional, desde cero, con buenas prácticas de arquitectura, seguridad y escalabilidad, porque **este sistema va a manejar dinero real y datos de clientes**. No hay margen para atajos en seguridad.

## Datos reales del negocio (no inventar nada adicional — usar TODO donde falte)

- **Nombre de marca (provisional)**: Lumé — TODO: puede cambiar, este proyecto se construye como una muestra de trabajo que también podría venderse a un cliente real que necesite una tienda online, así que el naming/branding NO debe quedar hardcodeado en el código.
- **Categoría de producto**: accesorios y maquillaje (producto físico, con variantes tipo color/tono)
- **Estilo de marca**: elegante / lujo asequible
- **Público objetivo**: todo género, sin distinción
- **Modelo de negocio**: e-commerce clásico (catálogo + inventario + envío por transportadora), NO delivery de comida ni producto digital
- **Dirección visual elegida (definitiva, cerrada)**: "Lujo con color" — fondo oscuro (tonos burdeos/negro) con acentos dorados/metálicos, tipografía sans-serif geométrica, alto contraste. Es el ÚNICO tema de la marca — NO se implementa toggle de modo claro/oscuro, igual que las marcas de lujo no cambian su identidad visual según preferencia del sistema.
- Cualquier otro dato de negocio (logo, paleta de colores exacta, redes sociales, dirección, pasarela de pago final activada) queda como TODO hasta que se defina

## Requisito de "marca blanca" (white-label)

Como el proyecto puede terminar vendiéndose a otro dueño con otra marca, **todo lo relacionado con identidad de marca debe ser configuración, nunca código hardcodeado**: nombre de tienda, logo, paleta de colores, textos de "quiénes somos", datos de contacto y redes sociales van en variables de entorno o en una tabla `Settings` editable desde el panel admin — igual que hiciste en HighClean con los datos de la empresa vía seed/admin, pero llevándolo un paso más allá para que rebrandear la tienda sea cuestión de configuración, no de tocar código.

## Documentación del proyecto (aprendizaje + historial de decisiones)

Igual que en HighClean, este proyecto debe quedar completamente documentado de principio a fin, no solo funcionando:

- Carpeta `docs/decisions/` en el repo con un **ADR (Architecture Decision Record)** por cada decisión técnica importante que tomemos juntos (ej: `ADR-001-eleccion-nestjs-vs-express.md`, `ADR-002-eleccion-wompi-vs-stripe.md`). Cada ADR incluye: contexto, opciones consideradas, decisión tomada, por qué, y consecuencias/trade-offs aceptados.
- Al cerrar cada módulo, además del reporte de cierre (ver regla 9 más abajo), se agrega una entrada corta en `docs/decisions/BITACORA.md` con fecha, módulo cerrado y resumen de una línea — esto arma la línea de tiempo completa del proyecto para poder repasarla después.
- Ningún ADR se reescribe para "quedar bien" en retrospectiva: si una decisión se cambia después, se agrega un ADR nuevo que referencia al anterior y explica por qué se cambió (igual que el historial de HighClean, donde se ve la evolución real, no una versión pulida).
- `docs/definition-of-done.md` es el checklist oficial de cierre de módulo (seguridad, infraestructura, frontend/UX, producto). Se coloca en el repo en el M0 y se revisa contra él, punto por punto, antes de cerrar cualquier módulo que aplique.

## Reglas fijas de trabajo (no negociables)

1. **Nunca hagas `git push` sin mi autorización explícita.** Terminas el módulo, me muestras el resultado, esperas mi aprobación.
2. **Te detienes al final de cada módulo.** No avanzas al siguiente sin que yo lo confirme.
3. **No inventes datos de negocio** (nombre de la tienda, productos, precios, textos legales, datos de contacto). Donde falte información real, deja un `TODO` claramente marcado y sigue adelante — no lo bloquees.
4. **Ante cualquier ambigüedad técnica**, muéstrame 2-3 alternativas reales con sus trade-offs (no una sola "la mejor opción") y espera mi decisión antes de implementar.
5. **Antes de ejecutar cada módulo**, muéstrame un plan corto de apertura (qué vas a tocar, qué archivos, qué decisiones tomarás) y espera luz verde.
6. **Commits atómicos**, uno por responsabilidad/capa, nunca un commit gigante mezclando cosas. Yo confirmo el mensaje de commit antes de que lo hagas.
7. **Todo lo relacionado con dinero (pagos, carrito, inventario, órdenes) se implementa con pruebas automatizadas obligatorias antes de darlo por cerrado.** Sin tests, el módulo no está terminado.
8. **Nunca implementes manejo directo de números de tarjeta en el backend.** Siempre a través de checkout/tokenización hospedado por la pasarela de pago (PCI DSS). Si en algún punto parece que la única forma de hacer algo es tocando datos crudos de tarjeta, para y avísame — no lo hagas.
9. Cuando termines un módulo, dame un reporte claro de: qué se implementó, qué decisiones tomaste y por qué, qué quedó pendiente (TODO), y qué debo verificar yo mismo en el código antes de aprobar.

## Stack técnico definido

- **Backend**: Node.js + TypeScript + NestJS
- **Base de datos**: PostgreSQL + Prisma
- **Cache / sesiones / colas**: Redis + BullMQ
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind
- **Validación**: Zod en cada endpoint, tanto frontend como backend
- **Autenticación**: JWT de acceso corto + refresh token, hash de contraseñas con Argon2id. El backend SIEMPRE responde el token en el body (formato Bearer), agnóstico del cliente — es el frontend web quien decide envolverlo en una cookie httpOnly vía una ruta intermedia de Next.js. Esto es intencional: deja el backend listo para una futura app móvil (que usaría el mismo endpoint con el token en el header `Authorization`) sin tener que rehacer el módulo de auth después.
- **Base de datos (proveedor)**: Neon (Postgres serverless con branching). La autorización ("¿este usuario puede ver este dato?") vive en guards/servicios de NestJS, NO en políticas RLS de Postgres.
- **Pagos**: Wompi como pasarela principal (Colombia), mediante checkout hospedado/tokenizado — nunca tocamos datos crudos de tarjeta
- **Testing**: Vitest + Supertest (backend), Playwright (e2e checkout y flujo de compra)
- **CI/CD**: GitHub Actions

## Cuentas externas: cuáles crear ya y cuáles al final

- **Wompi**: NO crear la cuenta de comercio todavía. Como el proyecto puede terminar vendiéndose a otro dueño (ver "marca blanca" arriba), la verificación de comercio real (NIT/cédula, cuenta bancaria, representante legal) debe quedar a nombre de quien finalmente opere el negocio, no de quien lo construyó. Se espera hasta tener un comprador/dueño real confirmado. Mientras tanto, todo el módulo M9 se desarrolla y prueba completo con las **llaves de sandbox/pruebas** de Wompi (disponibles de inmediato, sin verificación), así el checkout queda 100% funcional aunque la cuenta de producción no exista aún — solo se cambian las llaves cuando aparezca el dueño real.
- **Vercel, Render, Neon, Upstash**: NO hay que crearlas ahora — queda registrado aquí explícitamente para no olvidarlo. Son planes gratuitos sin fecha de expiración por prueba (no son "trials" con cuenta regresiva), así que se crean recién en el **Módulo 15 (Deploy)**, igual que se hizo en HighClean. Crearlas antes solo añade cosas que vigilar sin necesidad.
- **Dominio**: se compra cuando ya se vaya a desplegar, no antes.

## Módulos del proyecto (orden secuencial)

**M0 — Análisis y setup inicial** Estructura del monorepo (o repos separados, a decidir juntos), configuración de TypeScript estricto, linter, formateo, `.env.example`, README inicial.

**M1 — Repositorio y control de versiones** Repo en GitHub, estructura de carpetas, `.gitignore`, convención de commits, ramas.

**M2 — Frontend base** Next.js configurado, layout base, sistema de diseño/tema con la paleta única "Lujo con color" (sin toggle claro/oscuro), routing base de páginas públicas.

**M3 — Backend base** NestJS configurado, estructura de módulos (auth, catalog, cart, orders, payments, users, admin), manejo de errores centralizado, logging estructurado.

**M4 — Base de datos** PostgreSQL + Prisma, esquema inicial: usuarios, productos, categorías, carrito, órdenes, items de orden, direcciones, pagos (estado, referencia externa, nunca datos de tarjeta).

**M5 — Catálogo de productos** CRUD de productos y categorías, imágenes (con almacenamiento externo tipo S3/Cloudflare R2, no en el servidor), búsqueda y filtros.

**M6 — Carrito de compras** Carrito persistente por usuario/sesión, cálculo de totales, manejo de stock en tiempo real, validaciones (no permitir comprar más de lo disponible).

**M7 — Autenticación y usuarios** Registro, login, recuperación de contraseña, roles (cliente/admin), verificación de email. El endpoint de login responde el token en el body (ver estrategia mobile-ready en "Stack técnico" arriba) — no asumir que el único cliente es el navegador.

**M8 — Checkout y órdenes** Flujo completo de checkout, creación de orden, cálculo final (envío, impuestos si aplica), estados de la orden (pendiente, pagada, enviada, cancelada, etc.).

**M9 — Integración de pagos (Wompi)** Checkout hospedado/tokenizado, manejo de webhooks con verificación de firma, idempotencia, reconciliación de estado de pago vs estado de orden. Se implementa y prueba completo con llaves de **sandbox** (ver sección "Cuentas externas" arriba) — el cambio a llaves de producción es un paso posterior, no parte de este módulo. **Este módulo requiere pruebas exhaustivas antes de cerrar.**

**M10 — Panel de administración** Gestión de productos, órdenes, clientes, reportes básicos de ventas.

**M11 — Notificaciones** Doble lado, no solo el cliente:

- **Al cliente**: confirmación de orden recibida, pago aprobado, pago rechazado/fallido (con qué hacer a continuación), envío despachado.
- **Al vendedor (admin)**: nueva orden pagada (para que sepa que debe alistar el envío), pago fallido de un intento de compra (para tener visibilidad aunque el cliente no haya completado), alerta si un webhook de pago no se pudo procesar (para que no se pierda una venta por un error técnico silencioso). Vía servicio externo de email transaccional (Resend u otro).

**M12 — Seguridad** Rate limiting, CORS estricto, CSP/Helmet, protección CSRF donde aplique, auditoría de acciones sensibles (logs inmutables de cambios en órdenes/pagos), revisión OWASP Top 10 completa.

**M13 — Testing y calidad** Cobertura de tests unitarios e integración en todo lo relacionado con carrito/órdenes/pagos, tests e2e del flujo de compra completo, CI en GitHub Actions.

**M14 — SEO** Metadatos dinámicos por producto, sitemap, datos estructurados (schema.org Product), Open Graph.

**M15 — Deploy** Elección final de proveedores (frontend/backend/BD/redis), configuración de dominio, variables de entorno en producción, monitoreo de errores (Sentry o similar).

**M16 — Search Console e indexación** Verificación del dominio, envío de sitemap, monitoreo de indexación.

## Instrucción de inicio

Los datos base del negocio ya están definidos arriba (marca provisional Lumé, accesorios y maquillaje, estilo elegante/lujo asequible). Antes de escribir una sola línea de código: analiza este prompt completo, hazme solo las preguntas que falten (ej: si ya tengo dominio comprado, proveedor de imágenes de producto, etc.), y luego preséntame el plan de apertura del **Módulo 0**, incluyendo cómo vas a dejar la estructura de `docs/decisions/` lista desde ese primer módulo.