import 'reflect-metadata';

import { APP_PIPE } from '@nestjs/core';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { AppModule } from '../../app.module';
import {
  createStrictZodDto,
  zodValidationPipe,
  zodValidationPipeInstance,
  ZodValidationPipe,
  ZodSchemaDeclarationException,
  WEBHOOK_RAW_BODY_LIMIT,
} from './zod.dto';

describe('zod.dto helpers', () => {
  describe('createStrictZodDto', () => {
    it('creates a DTO class with schema and validates correctly', () => {
      const schema = z.object({
        email: z.email(),
        age: z.number().int().min(18).max(120),
      });

      const TestDto = createStrictZodDto(schema);

      expect(TestDto).toBeDefined();
      expect(TestDto.schema).toBe(schema);
    });

    it('validates valid payload through the pipe', () => {
      const schema = z.object({
        email: z.email(),
        age: z.number().int().min(18).max(120),
      });

      const TestDto = createStrictZodDto(schema);

      const validPayload = { email: 'test@example.com', age: 25 };
      const result = zodValidationPipeInstance.transform(validPayload, {
        type: 'body',
        metatype: TestDto,
      }) as unknown as { email: string; age: number };

      expect(result).toEqual(validPayload);
    });

    it('rejects invalid email and returns ZodValidationException with issues', () => {
      const schema = z.object({
        email: z.email(),
        age: z.number().int().min(18).max(120),
      });

      const TestDto = createStrictZodDto(schema);

      const invalidPayload = { email: 'not-an-email', age: 25 };

      expect(
        () =>
          zodValidationPipeInstance.transform(invalidPayload, {
            type: 'body',
            metatype: TestDto,
          }) as unknown,
      ).toThrow();
    });

    it('rejects age below minimum and returns issues', () => {
      const schema = z.object({
        email: z.email(),
        age: z.number().int().min(18).max(120),
      });

      const TestDto = createStrictZodDto(schema);

      const invalidPayload = { email: 'test@example.com', age: 10 };

      expect(
        () =>
          zodValidationPipeInstance.transform(invalidPayload, {
            type: 'body',
            metatype: TestDto,
          }) as unknown,
      ).toThrow();
    });

    it('rejects extra properties (strict mode)', () => {
      const schema = z
        .object({
          email: z.email(),
          age: z.number().int().min(18).max(120),
        })
        .strict();

      const TestDto = createStrictZodDto(schema);

      const invalidPayload = {
        email: 'test@example.com',
        age: 25,
        extraField: 'not allowed',
      };

      expect(
        () =>
          zodValidationPipeInstance.transform(invalidPayload, {
            type: 'body',
            metatype: TestDto,
          }) as unknown,
      ).toThrow();
    });
  });

  describe('zodValidationPipe strictSchemaDeclaration', () => {
    it('throws ZodSchemaDeclarationException when used without typed DTO', () => {
      const pipe = new zodValidationPipe();

      expect(
        () =>
          pipe.transform(
            { foo: 'bar' },
            {
              type: 'body',
              metatype: undefined,
            },
          ) as unknown,
      ).toThrow(ZodSchemaDeclarationException);
    });
  });

  describe('exports', () => {
    it('exports ZodValidationPipe class', () => {
      expect(ZodValidationPipe).toBeDefined();
      expect(typeof ZodValidationPipe).toBe('function');
    });

    it('exports ZodSchemaDeclarationException', () => {
      expect(ZodSchemaDeclarationException).toBeDefined();
      expect(typeof ZodSchemaDeclarationException).toBe('function');
    });

    it('exports WEBHOOK_RAW_BODY_LIMIT constant', () => {
      expect(WEBHOOK_RAW_BODY_LIMIT).toBe('5mb');
    });
  });
});

describe('AppModule registration', () => {
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
