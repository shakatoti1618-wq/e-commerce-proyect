import 'reflect-metadata';

import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

@Injectable()
class SampleService {}

@Injectable()
class ConsumerService {
  constructor(private readonly sample: SampleService) {}

  getSample(): SampleService {
    return this.sample;
  }
}

describe('metadata contract for constructor injection', () => {
  it('emits design:paramtypes for a dependency injected without @Inject', () => {
    const paramTypes: unknown = Reflect.getMetadata('design:paramtypes', ConsumerService);

    expect(
      Array.isArray(paramTypes),
      'Se rompió el contrato de metadata: design:paramtypes debe ser un array. ' +
        'Puede deberse a que el transformador dejó de emitir emitDecoratorMetadata ' +
        '(dependencia transitiva Oxc/rolldown), rompiendo la inyección por tipo sin @Inject.',
    ).toBe(true);

    expect(
      Array.isArray(paramTypes) ? paramTypes[0] : undefined,
      'Se rompió el contrato de metadata: el primer design:paramtypes debe ser SampleService ' +
        '(dependencia transitiva Oxc/rolldown).',
    ).toBe(SampleService);
  });

  it('resolves the injected dependency at runtime instead of a silent undefined', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SampleService, ConsumerService],
    }).compile();

    const consumer = moduleRef.get(ConsumerService);
    const sample = consumer.getSample();

    expect(
      sample,
      'Nest inyectó undefined en lugar de SampleService: fallo silencioso de inyección ' +
        'por pérdida de metadata en el transformador.',
    ).toBeDefined();
    expect(sample).toBeInstanceOf(SampleService);
  });
});
