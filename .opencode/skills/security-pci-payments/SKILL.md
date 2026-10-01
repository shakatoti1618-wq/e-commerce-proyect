---
name: security-pci-payments
description: Buenas prácticas de seguridad para manejo de pagos reales — PCI DSS, tokenización, webhooks, idempotencia, protección de datos de clientes
---

## Qué cubro

- Nunca almacenar ni loguear datos crudos de tarjeta (número, CVV, fecha de expiración)
- Checkout/tokenización hospedado por el proveedor de pagos (Wompi/Stripe) como único punto de contacto con la tarjeta
- Verificación de firma en cada webhook antes de procesarlo
- Idempotencia en toda operación que mueva dinero (una petición repetida no cobra dos veces)
- Principio de mínimo privilegio en accesos a datos de clientes; nunca devolver más campos de los necesarios en una respuesta de API
- Auditoría inmutable de toda acción sobre órdenes y pagos

## Cuándo usarme

En cualquier tarea que toque checkout, pagos, webhooks de la pasarela, o el modelo de datos de órdenes/transacciones.
