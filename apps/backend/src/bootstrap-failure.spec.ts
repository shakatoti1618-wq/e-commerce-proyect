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

  it('includes a safe error code without leaking the message or stack and exits with code 1', () => {
    const spy = createSpy();
    const error = Object.assign(new Error('listen EADDRINUSE: address already in use :::3000'), {
      code: 'EADDRINUSE',
    });

    reportBootstrapFailure(error, spy.write, spy.exit);

    expect(spy.writes.length).toBe(1);
    const message = spy.writes[0];
    expect(message).toContain('EADDRINUSE');
    expect(message).toContain('Bootstrap failed: unexpected error during startup (EADDRINUSE).');
    expect(message).not.toContain('address already in use');
    expect(message).not.toContain(':::3000');
    expect(message).not.toContain('Error:');
    expect(message).not.toContain('at ');
    expect(message).not.toContain(error.stack ?? 'STACK_PLACEHOLDER');
    expect(spy.exits).toEqual([1]);
  });

  it('writes the exact generic message when the error has no code and exits with code 1', () => {
    const spy = createSpy();
    const error = new Error('something went wrong during startup');

    reportBootstrapFailure(error, spy.write, spy.exit);

    expect(spy.writes).toEqual(['Bootstrap failed: unexpected error during startup.\n']);
    expect(spy.exits).toEqual([1]);
  });

  it('falls back to the generic message when the code does not match the safe pattern', () => {
    const spy = createSpy();
    const error = Object.assign(new Error('internal detail'), {
      code: 'BAD CODE\nLEAKED',
    });

    reportBootstrapFailure(error, spy.write, spy.exit);

    expect(spy.writes).toEqual(['Bootstrap failed: unexpected error during startup.\n']);
    expect(spy.writes[0]).not.toContain('BAD CODE');
    expect(spy.writes[0]).not.toContain('LEAKED');
    expect(spy.exits).toEqual([1]);
  });

  it('falls back to the generic message when the code exceeds the maximum length', () => {
    const spy = createSpy();
    const error = Object.assign(new Error('internal detail'), {
      code: 'A'.repeat(65),
    });

    reportBootstrapFailure(error, spy.write, spy.exit);

    expect(spy.writes).toEqual(['Bootstrap failed: unexpected error during startup.\n']);
    expect(spy.exits).toEqual([1]);
  });
});
