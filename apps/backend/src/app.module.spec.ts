import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppModule } from './app.module';

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
});
