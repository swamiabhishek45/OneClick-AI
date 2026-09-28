import type { AppSettings } from './types';

export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(setting: AppSettings['theme']): ResolvedTheme {
  if (setting === 'dark') return 'dark';
  if (setting === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyResolvedTheme(resolved: ResolvedTheme, root?: HTMLElement | null): void {
  const el = root ?? document.documentElement;
  el.classList.toggle('dark', resolved === 'dark');
  el.dataset.theme = resolved;
}

export function applyThemeSetting(setting: AppSettings['theme'], root?: HTMLElement | null): ResolvedTheme {
  const resolved = resolveTheme(setting);
  applyResolvedTheme(resolved, root);
  return resolved;
}

export function getAppSettingsTheme(): Promise<AppSettings['theme']> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve('light');
      return;
    }
    chrome.storage.local.get(['settings'], (result) => {
      const theme = (result.settings as AppSettings | undefined)?.theme;
      resolve(theme ?? 'light');
    });
  });
}

export async function initExtensionTheme(root?: HTMLElement | null): Promise<ResolvedTheme> {
  const setting = await getAppSettingsTheme();
  return applyThemeSetting(setting, root);
}

export function watchThemeChanges(onTheme: (resolved: ResolvedTheme, setting: AppSettings['theme']) => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return () => {};
  }

  const media =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  const handler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local' || !changes.settings?.newValue) return;
    const setting = (changes.settings.newValue as AppSettings).theme ?? 'light';
    onTheme(applyThemeSetting(setting), setting);
  };

  const onSystemChange = () => {
    getAppSettingsTheme().then((setting) => {
      if (setting === 'system') {
        onTheme(applyThemeSetting('system'), 'system');
      }
    });
  };

  chrome.storage.onChanged.addListener(handler);
  media?.addEventListener('change', onSystemChange);

  return () => {
    chrome.storage.onChanged.removeListener(handler);
    media?.removeEventListener('change', onSystemChange);
  };
}
