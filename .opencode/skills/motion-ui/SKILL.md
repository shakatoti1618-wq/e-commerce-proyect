---
name: motion-ui
description: Reglas para animaciones, scroll, microinteracciones y transiciones — accesibilidad y presupuesto de rendimiento
---

## Qué cubro

- Toda animación (scroll, hero, transiciones de página) respeta `prefers-reduced-motion`: se reduce o desactiva automáticamente si el usuario lo tiene activado en su sistema
- Microinteracciones en botones necesitan equivalente táctil (`active`/`tap`) para móvil, no solo `hover` (hover no existe en pantallas táctiles)
- Presupuesto de rendimiento: ninguna animación puede degradar el tiempo de carga ni el Core Web Vitals de la página — "que impacte visualmente" nunca es excusa para que pese o cargue más lento
- Loading states con skeletons (siluetas de contenido) en vez de spinners de pantalla completa cuando se está cargando el catálogo o el carrito

## Cuándo usarme

Al implementar cualquier animación, transición o microinteracción en apps/frontend.
