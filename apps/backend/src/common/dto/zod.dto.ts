import { z } from 'zod';
import {
  ZodValidationPipe,
  createZodValidationPipe,
  createZodDto,
  ZodSchemaDeclarationException,
} from 'nestjs-zod';

/**
 * Límite de body para el webhook de Wompi (M9).
 *
 * El webhook necesita acceso al **raw body** (Buffer) para verificar la firma
 * HMAC antes de que el JSON parser lo consuma. En M9 se montará un middleware
 * `express.raw({ type: 'application/json', limit: WEBHOOK_RAW_BODY_LIMIT, verify: ... })`
 * **solo** en la ruta del webhook.
 *
 * NO se monta aquí porque el webhook no existe en M3. Se exporta la constante
 * para que M9 la use sin buscar valores mágicos.
 */
export const WEBHOOK_RAW_BODY_LIMIT = '5mb';

/**
 * Pipe de validación Zod global con `strictSchemaDeclaration: true`.
 *
 * Hace que el pipe falle en tiempo de arranque (500) si se intenta validar un
 * parámetro sin un DTO tipado (p. ej. `body: unknown`). Esto actúa como
 * defensa contra olvidar DTOs en los controladores.
 */
export const zodValidationPipe = createZodValidationPipe({
  strictSchemaDeclaration: true,
});

/**
 * Re-exporta `ZodValidationPipe` y `createZodValidationPipe` para que los
 * controladores no importen directamente de `nestjs-zod`.
 */
export { ZodValidationPipe, createZodValidationPipe, ZodSchemaDeclarationException };

/**
 * Instancia del pipe de validación para uso en tests.
 * En producción se usa la clase via `APP_PIPE` (AppModule).
 */
export const zodValidationPipeInstance = new zodValidationPipe();

/**
 * Tipo helper para inferir el tipo de un DTO creado con `createZodDto`.
 */
export type ZodDtoType<TSchema extends z.ZodTypeAny> = z.infer<TSchema>;

/**
 * Crea una clase DTO estricta a partir de un schema Zod.
 *
 * @param schema - Schema Zod que define la forma del DTO
 * @param options - Opciones adicionales (codec por defecto: false)
 *
 * @returns Clase DTO con `.schema` expuesta y validación estricta
 *
 * @remarks
 * **Por qué `codec: false` es el default:**
 *
 * - `codec: true` habilita la serialización/deserialización bidireccional
 *   (útil para respuestas de API donde queremos transformar la salida).
 * - En el borde de **entrada** (request body, query, params) solo necesitamos
 *   validación y parsing → `codec: false` evita overhead innecesario.
 * - La serialización de respuestas se manejará en M8/M9 con DTOs de salida
 *   dedicados (`ResponseDto`), no reutilizando los DTOs de entrada.
 *
 * El schema se hace `.strict()` implícitamente por Zod 4 (rechaza propiedades
 * extra) y se recomienda usar `.max()` en objetos para limitar cardinalidad.
 */
export function createStrictZodDto<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return createZodDto(schema, { codec: false });
}
