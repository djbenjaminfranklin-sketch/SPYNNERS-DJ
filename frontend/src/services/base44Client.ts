import Constants from 'expo-constants';

type ExpoExtra = Record<string, any>;

export type Base44Config = {
  apiUrl: string;
  appId: string;
  apiKey: string;
};

/**
 * Expo "extra" can be exposed through different fields depending on how the
 * app is launched (Expo Go vs Dev Client vs EAS build). Centralize the lookup.
 */
export function getExpoExtra<T extends ExpoExtra = ExpoExtra>(): T {
  const c: any = Constants as any;

  // Newer Expo
  if (c?.expoConfig?.extra) return c.expoConfig.extra as T;

  // Older Expo manifest
  if (c?.manifest?.extra) return c.manifest.extra as T;

  // EAS Updates / manifest2 shape
  if (c?.manifest2?.extra) return c.manifest2.extra as T;

  // Fallback
  return {} as T;
}

/**
 * Reads Base44 config from app.json -> expo.extra.
 * Throws a clear error if missing so we don't "silently load nothing".
 */
export function getBase44Config(): Base44Config {
  const extra = getExpoExtra();

  const apiUrl = String(extra.base44ApiUrl || '').trim();
  const appId = String(extra.base44AppId || '').trim();
  const apiKey = String(extra.base44ApiKey || '').trim();

  if (!apiUrl || !appId || !apiKey) {
    // Throwing is intentional: the UI should show the error state and logs
    // should immediately reveal what's missing.
    throw new Error(
      `Base44 config missing. apiUrl=${apiUrl ? 'ok' : 'missing'} appId=${appId ? 'ok' : 'missing'} apiKey=${apiKey ? 'ok' : 'missing'}`
    );
  }

  return { apiUrl, appId, apiKey };
}

export function buildBase44EntityUrl(entity: string, query: string = ''): string {
  const { apiUrl, appId } = getBase44Config();
  const base = `${apiUrl.replace(/\/$/, '')}/${appId}/entities/${encodeURIComponent(entity)}`;
  if (!query) return base;
  return query.startsWith('?') ? `${base}${query}` : `${base}?${query}`;
}
