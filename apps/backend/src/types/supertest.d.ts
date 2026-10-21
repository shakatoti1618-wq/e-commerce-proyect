// Declaración de tipos mínima para `supertest`.
//
// `supertest` es una devDependency real (ya presente y usada en tiempo de test),
// pero no publica tipos propios y el proyecto no puede añadir `@types/supertest`
// como dependencia. A diferencia de un módulo falso que oculta una dependencia
// ausente, aquí el módulo SÍ se ejecuta en los tests; esta declaración solo
// describe la superficie que se usa.
declare module 'supertest' {
  import type { Server } from 'node:http';

  interface SuperTestResponse {
    status: number;
    headers: Record<string, string | undefined>;
    text: string;
    body: unknown;
  }

  interface SuperTestRequest extends PromiseLike<SuperTestResponse> {
    set(field: string, value: string): this;
    send(payload: unknown): this;
  }

  interface SuperTestStatic {
    get(url: string): SuperTestRequest;
    post(url: string): SuperTestRequest;
  }

  function supertest(app: Server): SuperTestStatic;

  export = supertest;
}
