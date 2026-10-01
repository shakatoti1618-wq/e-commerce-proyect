---
name: prisma-postgres-modeling
description: Buenas prácticas de modelado de datos con Prisma/PostgreSQL para e-commerce — montos, migraciones, índices
---

## Qué cubro

- Montos de dinero en tipos exactos (Decimal), nunca float, con moneda explícita
- Migraciones reversibles o documentadas si no lo son
- Índices con intención (columnas usadas en WHERE/JOIN frecuentes)
- Relaciones que reflejan el dominio real (producto-variante, orden-item, usuario-dirección)
- Nunca columnas para datos crudos de tarjeta

## Cuándo usarme

Al diseñar o modificar el esquema de Prisma o al escribir una migración.
