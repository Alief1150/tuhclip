export type LogNamespace = 'caption' | 'transcript' | 'storage' | 'ui';

let enabled = import.meta.env.DEV;

export function setLoggingEnabled(value: boolean): void {
  enabled = value;
}

export function createLogger(namespace: LogNamespace) {
  const prefix = `[tuhclip][${namespace}]`;
  return {
    debug: (...values: unknown[]) => {
      if (enabled) console.debug(prefix, ...values);
    },
    error: (...values: unknown[]) => {
      if (enabled) console.error(prefix, ...values);
    },
  };
}
