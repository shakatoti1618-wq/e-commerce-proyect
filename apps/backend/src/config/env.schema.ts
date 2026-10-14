import { z } from 'zod';

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const BOOLEAN_STRING_VALUES = ['true', 'false'] as const;

export const envSchema = z
  .object({
    // Obligatoria y sin default: si falta o es inválida se aborta el arranque.
    NODE_ENV: z.enum(NODE_ENVIRONMENTS),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    CORS_ORIGINS: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().optional(),
    ),
    // Gating fail-closed: cualquier valor distinto de 'true'/'false' es error.
    ENABLE_SWAGGER: z
      .enum(BOOLEAN_STRING_VALUES)
      .default('false')
      .transform((value) => value === 'true'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && data.ENABLE_SWAGGER === true) {
      ctx.addIssue({
        code: 'custom',
        path: ['ENABLE_SWAGGER'],
        message: 'ENABLE_SWAGGER must be false when NODE_ENV is production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

/**
 * Valida las variables de entorno al arranque.
 *
 * En caso de fallo, el mensaje expone UNICAMENTE los nombres de las variables y
 * el codigo de error de Zod. Nunca se interpolan los valores recibidos, para no
 * filtrar secretos (A2) hacia los logs de arranque.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const invalidVariables = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'} (${issue.code})`)
      .join(', ');

    throw new EnvironmentValidationError(`Invalid environment variables: ${invalidVariables}`);
  }

  return parsed.data;
}

export function shouldIgnoreEnvFile(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}
