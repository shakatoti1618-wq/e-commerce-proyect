import { Controller, Get } from '@nestjs/common';

/**
 * Cuerpo de respuesta del endpoint de liveness.
 * Literal de tipo: `status` solo puede ser `'ok'`, de modo que el retorno
 * del controlador queda verificado en compilación sin `any`.
 */
export interface HealthResponse {
  status: 'ok';
}

/**
 * Endpoint de liveness (`GET /api/health`).
 *
 * Propósito único: confirmar que el proceso responde. No versiona, no expone
 * uptime/entorno y no toca dependencias (eso sería readiness, otra tarea).
 */
@Controller('health')
export class HealthController {
  @Get()
  public getHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
