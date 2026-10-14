export function reportBootstrapFailure(
  error: unknown,
  write: (message: string) => void,
  exit: (code: number) => void,
): void {
  if (error instanceof Error && error.name === 'EnvironmentValidationError') {
    const message = error.message;
    if (!message) {
      write('Invalid environment variables\n');
      exit(1);
      return;
    }
    const splitIndex = message.indexOf(':');
    const after = splitIndex >= 0 ? message.substring(splitIndex + 1) : message;
    const parts = after ? after.split(',') : [];
    const names: string[] = [];
    const nameRegex = /[A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)*/g;
    for (const p of parts) {
      const mm = p.match(nameRegex);
      if (mm) {
        for (const x of mm) {
          if (x !== 'INVALID' && x !== 'ENVIRONMENT' && x !== 'VARIABLES') {
            names.push(x);
          }
        }
      }
    }
    const seen = new Set<string>();
    const res: string[] = [];
    for (const n of names) {
      if (!seen.has(n)) {
        seen.add(n);
        res.push(n);
      }
    }
    if (res.length > 0) {
      write('Invalid environment variables: ' + res.join(', ') + '\n');
    } else {
      write('Invalid environment variables\n');
    }
  } else {
    write('Bootstrap failed: unexpected error during startup.\n');
  }

  exit(1);
}
