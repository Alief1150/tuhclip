import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger, setLoggingEnabled } from './logger';

describe('createLogger', () => {
  beforeEach(() => setLoggingEnabled(false));

  afterEach(() => {
    setLoggingEnabled(false);
    vi.restoreAllMocks();
  });

  it('prefixes enabled output with the namespace', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    setLoggingEnabled(true);
    createLogger('ui').debug('ready');
    expect(debug).toHaveBeenCalledWith('[tuhclip][ui]', 'ready');
  });

  it('does not emit output when disabled', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    createLogger('ui').debug('ready');
    expect(debug).not.toHaveBeenCalled();
  });
});
