import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { validateEnv } from './env.schema';

const SECRET_SENTINEL = 'super-secret-leak';

function getThrownError(action: () => void): Error {
  try {
    action();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
    throw error;
  }

  throw new Error('Se esperaba que la validacion lanzara un error, pero no lo hizo.');
}

describe('validateEnv', () => {
  it('returns a fully typed config for a complete, valid environment', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: 'https://lume.example',
      ENABLE_SWAGGER: 'true',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(8080);
    expect(typeof env.PORT).toBe('number');
    expect(env.LOG_LEVEL).toBe('warn');
    expect(env.CORS_ORIGINS).toBe('https://lume.example');
    expect(env.ENABLE_SWAGGER).toBe(true);
  });

  it('applies defaults when only NODE_ENV is provided', () => {
    const env = validateEnv({ NODE_ENV: 'test' });

    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.ENABLE_SWAGGER).toBe(false);
    expect(env.CORS_ORIGINS).toBeUndefined();
  });

  it('normalizes an empty CORS_ORIGINS to undefined', () => {
    const env = validateEnv({ NODE_ENV: 'test', CORS_ORIGINS: '' });

    expect(env.CORS_ORIGINS).toBeUndefined();
  });

  it('rejects when NODE_ENV is missing and names the variable', () => {
    const error = getThrownError(() => validateEnv({ PORT: '3000' }));

    expect(error.message).toContain('NODE_ENV');
  });

  it('rejects an invalid NODE_ENV without leaking its value (A2)', () => {
    const error = getThrownError(() => validateEnv({ NODE_ENV: 'prodution' }));

    expect(error.message).toContain('NODE_ENV');
    expect(error.message).not.toContain('prodution');
  });

  it('rejects a non-numeric PORT without leaking its value', () => {
    const error = getThrownError(() => validateEnv({ NODE_ENV: 'test', PORT: 'abc' }));

    expect(error.message).toContain('PORT');
    expect(error.message).not.toContain('abc');
  });

  it('rejects an out-of-range PORT without leaking its value', () => {
    const error = getThrownError(() => validateEnv({ NODE_ENV: 'test', PORT: '70000' }));

    expect(error.message).toContain('PORT');
    expect(error.message).not.toContain('70000');
  });

  it('parses ENABLE_SWAGGER=true as boolean true', () => {
    const env = validateEnv({ NODE_ENV: 'test', ENABLE_SWAGGER: 'true' });

    expect(env.ENABLE_SWAGGER).toBe(true);
  });

  it('rejects an invalid ENABLE_SWAGGER value and names the variable', () => {
    const error = getThrownError(() => validateEnv({ NODE_ENV: 'test', ENABLE_SWAGGER: 'yes' }));

    expect(error.message).toContain('ENABLE_SWAGGER');
    expect(error.message).not.toContain('yes');
  });

  it('names every invalid variable when several are wrong at once (A2)', () => {
    const error = getThrownError(() =>
      validateEnv({
        NODE_ENV: SECRET_SENTINEL,
        PORT: 'abc',
        ENABLE_SWAGGER: 'yes',
      }),
    );

    expect(error.message).toContain('NODE_ENV');
    expect(error.message).toContain('PORT');
    expect(error.message).toContain('ENABLE_SWAGGER');
    expect(error.message).not.toContain(SECRET_SENTINEL);
  });
});

describe('boot abort (A1)', () => {
  it('aborts boot when NODE_ENV is invalid', async () => {
    vi.resetModules();
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'prodution';

    try {
      // `ConfigModule.forRoot` es async: la validacion falla dentro del dynamic
      // module, asi que el arranque aborta cuando Nest resuelve `AppModule`.
      // Se awaita esa promesa (en vez de `NestFactory.create`, que invoca
      // `process.abort`) para probar el aborto sin matar el worker de tests.
      const { AppModule } = await import('../app.module');
      const dynamicImports = Reflect.getMetadata('imports', AppModule) as unknown[];

      await expect(dynamicImports[0]).rejects.toThrow(/NODE_ENV/);
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
      vi.resetModules();
    }
  });
});
