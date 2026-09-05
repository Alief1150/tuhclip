import { storeGet, storePut } from './db';

export async function writeSetting(key: string, value: string): Promise<void> {
  await storePut('settings', { key, value });
}

export async function readSetting(key: string): Promise<string | null> {
  const record = await storeGet<{ key: string; value: string }>('settings', key).catch(() => null);
  return record?.value ?? null;
}
