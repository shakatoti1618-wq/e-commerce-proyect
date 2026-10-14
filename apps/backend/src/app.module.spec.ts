import 'reflect-metadata';

import { APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppModule } from './app.module';
import { zodValidationPipe } from './common/dto/zod.dto';

describe('AppModule bootstrap', () => {
  it('compiles the module graph without unresolvable providers', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      await moduleRef.close();
      expect(moduleRef).toBeDefined();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('registers APP_PIPE with zodValidationPipe class via reflection', () => {
    const providers = Reflect.getMetadata('providers', AppModule) as unknown[];

    expect(Array.isArray(providers)).toBe(true);

    const providerList = Array.isArray(providers) ? providers : [];
    const appPipeProvider = providerList.find(
      (provider): provider is { provide: unknown; useClass: unknown } =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        provider.provide === APP_PIPE,
    );

    expect(appPipeProvider).toBeDefined();
    expect(appPipeProvider!.useClass).toBe(zodValidationPipe);
  });
});
