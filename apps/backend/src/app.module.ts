import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { shouldIgnoreEnvFile, validateEnv } from './config/env.schema';
import { buildPinoHttpOptions } from './config/logger.config';

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
  controllers: [],
  providers: [],
})
export class AppModule {}
