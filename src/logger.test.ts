import { describe, expect, it, vi } from 'vitest';
import { createLogger, parseVerbosity } from './logger';

describe('parseVerbosity', () => {
  it('defaults an empty string to "info"', () => {
    expect(parseVerbosity('')).toBe('info');
  });

  it('accepts all standard levels case-insensitively with surrounding whitespace', () => {
    expect(parseVerbosity('error')).toBe('error');
    expect(parseVerbosity(' Warn ')).toBe('warn');
    expect(parseVerbosity('NOTICE')).toBe('notice');
    expect(parseVerbosity('Info')).toBe('info');
    expect(parseVerbosity('DEBUG')).toBe('debug');
  });

  it('throws for an unrecognized value', () => {
    expect(() => parseVerbosity('verbose')).toThrow(/Invalid verbosity "verbose"/);
  });
});

describe('createLogger', () => {
  function fakeCore() {
    return { info: vi.fn(), warning: vi.fn() };
  }

  it('error: suppresses info, debug, and warnings', () => {
    const core = fakeCore();
    const log = createLogger('error', core);

    log.info('info message');
    log.debug('debug message');
    log.warning('warning message');

    expect(core.info).not.toHaveBeenCalled();
    expect(core.warning).not.toHaveBeenCalled();
  });

  it('warn: emits warnings, suppresses info and debug', () => {
    const core = fakeCore();
    const log = createLogger('warn', core);

    log.info('info message');
    log.debug('debug message');
    log.warning('warning message');

    expect(core.info).not.toHaveBeenCalled();
    expect(core.warning).toHaveBeenCalledWith('warning message');
  });

  it('info (default): emits info and warnings, suppresses debug', () => {
    const core = fakeCore();
    const log = createLogger('info', core);

    log.info('info message');
    log.debug('debug message');
    log.warning('warning message');

    expect(core.info).toHaveBeenCalledWith('info message');
    expect(core.info).toHaveBeenCalledTimes(1);
    expect(core.warning).toHaveBeenCalledWith('warning message');
  });

  it('debug: emits info, debug (prefixed), and warnings', () => {
    const core = fakeCore();
    const log = createLogger('debug', core);

    log.info('info message');
    log.debug('debug message');
    log.warning('warning message');

    expect(core.info).toHaveBeenCalledWith('info message');
    expect(core.info).toHaveBeenCalledWith('[debug] debug message');
    expect(core.warning).toHaveBeenCalledWith('warning message');
  });
});
