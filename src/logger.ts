export type Verbosity = 'error' | 'warn' | 'notice' | 'info' | 'debug';

const LEVELS: Record<Verbosity, number> = {
  error: 0,
  warn: 1,
  notice: 2,
  info: 3,
  debug: 4,
};

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warning(message: string): void;
}

export interface CoreLike {
  info(message: string): void;
  warning(message: string): void;
}

export function parseVerbosity(raw: string, core: Pick<CoreLike, 'warning'>): Verbosity {
  const value = raw.trim().toLowerCase();
  if (value === '') {
    return 'info';
  }
  if (value in LEVELS) {
    return value as Verbosity;
  }
  core.warning(`Invalid verbosity "${raw}"; defaulting to "info". Expected one of: error, warn, notice, info, debug.`);
  return 'info';
}

export function createLogger(verbosity: Verbosity, core: CoreLike): Logger {
  const level = LEVELS[verbosity];

  return {
    debug(message: string): void {
      if (level >= LEVELS.debug) {
        core.info(`[debug] ${message}`);
      }
    },
    info(message: string): void {
      if (level >= LEVELS.info) {
        core.info(message);
      }
    },
    warning(message: string): void {
      if (level >= LEVELS.warn) {
        core.warning(message);
      }
    },
  };
}
