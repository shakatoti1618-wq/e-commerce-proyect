import { describe, expect, it } from 'vitest';

import { reportBootstrapFailure } from './bootstrap-failure';
import { EnvironmentValidationError } from './config/env.schema';

function createSpy() {
  const writes: string[] = [];
  const exits: number[] = [];

  return {
    writes,
    exits,
    write: (message: string) => {
      writes.push(message);
    },
    exit: (code: number) => {
      exits.push(code);
    },
  };
}

describe('reportBootstrapFailure', () => {
  it('writes validation error message including variable names but not sentinel values and exits with code 1', () => {
    const spy = createSpy();
    const error = new EnvironmentValidationError(
      'Invalid environment variables: NODE_ENV (invalid_value)',
    );

    reportBootstrapFailure(error, spy.write, spy.exit);

    expect(spy.writes.length).toBe(1);
    expect(spy.writes[0]).toContain('NODE_ENV');
    expect(spy.writes[0]).not.toContain('invalid_value');
    expect(spy.writes[0]).not.toContain('custom');
    expect(spy.exits).toEqual([1]);
  });

  it('writes generic message without leaking internal details and exits with code 1', () => {
    const spy = createSpy();
    const error = new Error('leaked /internal/path secret=TOP_SECRET');

    reportBootstrapFailure(error, spy.write, spy.exit);

    expect(spy.writes.length).toBe(1);
    const message = spy.writes[0];
    expect(message).not.toContain('leaked');
    expect(message).not.toContain('/internal');
    expect(message).not.toContain('TOP_SECRET');
    expect(message).not.toContain('secret');
    expect(spy.exits).toEqual([1]);
  });
});
