# Definition of Done — Proyecto Lumé

Checklist de referencia para dar por cerrado un módulo. No todos los puntos aplican a todos los módulos — el orquestador marca cuáles aplican al abrir el módulo, y `@qa-tester`/`@seguridad` los verifican al cerrarlo.

## Decisiones de arquitectura ya tomadas (contexto para todo el checklist)

- Base de datos: **Neon** (Postgres serverless con branching). La autorización ("¿este usuario puede ver este dato?") vive en NestJS (guards/servicios), no en RLS de Postgres.
- Autenticación preparada para multi-cliente: el backend responde el token en el body (`Bearer`), agnóstico de si el cliente es el frontend web o, a futuro, una app móvil. El frontend web decide cómo lo guarda (cookie httpOnly vía ruta intermedia de Next.js); una futura app móvil lo guardaría en almacenamiento seguro del dispositivo.
- Monorepo `apps/backend` + `apps/frontend`. Cualquier cliente nuevo (app móvil) consume la misma API sin tocar el backend existente.

## 1. Seguridad

- [ ] API keys y secretos no expuestos en el frontend
- [ ] Permisos de acceso a la base de datos verificados (autorización vía NestJS, no RLS)
- [ ] Autenticación funciona correctamente (login, registro, expiración y revocación de sesión)
- [ ] Un usuario no puede acceder a datos de otro usuario (IDOR) — incluye probar acceso a rutas de admin con usuario normal
- [ ] Sin vulnerabilidades de inyección SQL/XSS
- [ ] Rate limiting en endpoints sensibles (login, checkout, webhooks, formulario de contacto)
- [ ] Dependencias auditadas, sin paquetes con vulnerabilidades conocidas
- [ ] Sistema de gestión de errores centralizado
- [ ] Logs configurados sin exponer información sensible (nunca el body completo de checkout)
- [ ] Headers de seguridad y CSP configurados
- [ ] Pruebas automáticas de recuperación de login/contraseña olvidada
- [ ] Webhooks de pago: firma verificada, idempotencia (no cobra dos veces), reconciliación de estado orden↔pago, manejo de pago pendiente que nunca confirma
- [ ] Página de política de privacidad y términos (Ley 1581 de Colombia)

## 2. Infraestructura y operación

- [ ] Todos los endpoints de la API funcionan correctamente
- [ ] Copias de seguridad configuradas Y restauración probada al menos una vez (usando branching de Neon)
- [ ] Sistema de monitorización de errores y caídas inesperadas integrado

## 3. Frontend / UX

- [ ] Animaciones suaves al hacer scroll, respetando `prefers-reduced-motion`
- [ ] Microinteracciones en botones, con estado táctil (`active`/`tap`) equivalente para móvil, no solo hover
- [ ] Estados hover en elementos interactivos (desktop)
- [ ] Diseño responsive para móvil
- [ ] Navegación móvil
- [ ] Favicon personalizado
- [ ] Botón de volver arriba
- [ ] Loading con skeletons (preferido sobre spinner de pantalla completa)
- [ ] Transiciones entre páginas
- [ ] Animación de entrada del hero
- [ ] CTA repetido estratégicamente por la página
- [ ] Formulario de contacto funcional, protegido contra spam (rate limit + honeypot/captcha)
- [ ] Validación de formularios (UX en frontend, fuente de verdad en backend)
- [ ] Mensajes de error y éxito claros
- [ ] Dark mode — coherente con la dirección visual elegida del mockup
- [ ] Botones de redes sociales
- [ ] Sección de testimonios: sin testimonios inventados; diseñada para funcionar vacía o con reseñas reales
- [ ] Carrito persiste si el usuario recarga o cierra el navegador
- [ ] Optimización de velocidad, carga de imágenes y llamados a la API
- [ ] Tiempos de carga, estados de error y de ausencia de datos revisados
- [ ] Auditoría de accesibilidad
- [ ] Presupuesto de rendimiento respetado por las animaciones (no sacrificar velocidad de carga por "impacto visual")

## 4. Producto / negocio

- [ ] Notificaciones de compra al cliente: orden recibida, pago aprobado, pago rechazado/fallido (con siguiente paso), envío despachado
- [ ] Notificaciones al vendedor/admin: nueva orden pagada, pago fallido de un intento de compra, alerta de webhook de pago no procesado
- [ ] Panel admin (CRUD de productos, órdenes, clientes, reportes básicos — como en HighClean)
- [ ] Analytics y eventos de conversión configurados (vista de producto → agregar al carrito → inicio de checkout → compra completada)
- [ ] No aplica por ahora: requisitos de publicación en Google Play / App Store (no hay app nativa en el MVP; si se construye la app móvil más adelante, se retoma este punto)
