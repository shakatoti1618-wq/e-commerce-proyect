---
name: clean-code-nestjs
description: Principios de arquitectura por capas y clean code aplicados a NestJS (controllers, services, repositories, DTOs, guards)
---

## Qué cubro

- Separación estricta controller → service → repository
- DTOs y validación con class-validator/Zod en el borde de entrada
- Manejo de errores centralizado con filtros de excepción
- Inyección de dependencias en vez de instanciación directa
- Módulos cohesivos (un módulo = un dominio de negocio: catalog, cart, orders, payments)

## Cuándo usarme

Antes de crear o modificar cualquier controller, service o módulo en apps/backend.
