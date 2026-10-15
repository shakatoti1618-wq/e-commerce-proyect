import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';

import { reportBootstrapFailure } from './bootstrap-failure';
import { createApp } from './create-app';

async function bootstrap(): Promise<void> {
  const app = await createApp();

  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port);
}

bootstrap().catch((error: unknown) =>
  reportBootstrapFailure(
    error,
    (m) => process.stderr.write(m),
    (code) => process.exit(code),
  ),
);
