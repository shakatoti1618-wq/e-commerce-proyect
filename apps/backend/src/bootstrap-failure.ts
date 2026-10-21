const ERROR_CODE_PATTERN = /^[A-Za-z0-9_]+$/;
const ERROR_CODE_MAX_LENGTH = 64;
const STARTUP_FAILURE_MESSAGE_PREFIX = 'Bootstrap failed: unexpected error during startup';

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const candidate = (error as { code?: unknown }).code;
  if (typeof candidate !== 'string') {
    return undefined;
  }
  if (candidate.length > ERROR_CODE_MAX_LENGTH) {
    return undefined;
  }
  if (!ERROR_CODE_PATTERN.test(candidate)) {
    return undefined;
  }
  return candidate;
}

function describeUnexpectedStartupFailure(error: unknown): string {
  const code = readSafeErrorCode(error);
  if (code === undefined) {
    return `${STARTUP_FAILURE_MESSAGE_PREFIX}.\n`;
  }
  return `${STARTUP_FAILURE_MESSAGE_PREFIX} (${code}).\n`;
}

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
    write(describeUnexpectedStartupFailure(error));
  }

  exit(1);
}
