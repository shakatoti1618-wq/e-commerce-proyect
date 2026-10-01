---
name: testing-vitest-playwright
description: Buenas prácticas de testing para el e-commerce — unitarias con Vitest, e2e con Playwright, prioridad en carrito y checkout
---

## Qué cubro

- Tests unitarios de servicios de negocio (cálculo de totales, validación de stock)
- Tests de integración de endpoints críticos (checkout, webhooks de pago)
- Tests e2e del flujo completo de compra con Playwright, incluyendo casos de fallo
- Mocking correcto del proveedor de pagos en tests (nunca golpear la pasarela real en CI)

## Cuándo usarme

Al escribir pruebas para cualquier funcionalidad de carrito, checkout, pagos o autenticación.
