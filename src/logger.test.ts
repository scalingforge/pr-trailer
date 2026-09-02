import { describe, expect, it, vi } from 'vitest';
import { createLogger, parseVerbosity } from './logger';

function fakeCore() {
  return { info: vi.fn(), warning: vi.fn() };
}

describe('parseVerbosity', () => {
  it('defaults an empty string to "info"', () => {
    const core = fakeCore();

    expect(parseVerbosity('', core)).toBe('info');
    expect(core.warning).not.toHaveBeenCalled();
  });

  it('accepts all standard levels case-insensitively with surrounding whitespace', () => {
    const core = fakeCore();

    expect(parseVerbosity('error', core)).toBe('error');
    expect(parseVerbosity(' Warn ', core)).toBe('warn');
    expect(parseVerbosity('NOTICE', core)).toBe('notice');
    expect(parseVerbosity('Info', core)).toBe('info');
    expect(parseVerbosity('DEBUG', core)).toBe('debug');
    expect(core.warning).not.toHaveBeenCalled();
  });

  it('falls back to "info" and warns on an unrecognized value', () => {
    const core = fakeCore();

    expect(parseVerbosity('verbose', core)).toBe('info');
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Invalid verbosity "verbose"'));
  });
});

describe('createLogger', () => {
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
