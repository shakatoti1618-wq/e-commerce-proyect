import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { shouldIgnoreEnvFile, validateEnv } from './config/env.schema';
import { buildPinoHttpOptions } from './config/logger.config';
import { zodValidationPipe } from './common/dto/zod.dto';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
      ignoreEnvFile: shouldIgnoreEnvFile(process.env.NODE_ENV),
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: buildPinoHttpOptions(config.get<string>('LOG_LEVEL')),
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useClass: zodValidationPipe },
  ],
})
export class AppModule {}
