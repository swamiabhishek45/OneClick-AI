import type { AppSettings } from './types';
import {
  isExtensionContextValid,
  notifyExtensionContextInvalidated,
  readLocalStorage,
  watchLocalStorage,
} from './extensionRuntime';

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

const THEME_CACHE_KEY = 'oneclick_ui_theme';

function isThemeSetting(value: unknown): value is AppSettings['theme'] {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Synchronous copy for extension pages so the first paint uses the saved theme. */
export function readCachedThemeSetting(): AppSettings['theme'] | null {
  try {
    const value = localStorage.getItem(THEME_CACHE_KEY);
    return isThemeSetting(value) ? value : null;
  } catch {
    return null;
  }
}

function cacheThemeSetting(setting: AppSettings['theme']): void {
  try {
    localStorage.setItem(THEME_CACHE_KEY, setting);
  } catch {
    /* storage unavailable */
  }
}

/** Without a root this targets the extension page itself, so the choice is cached there. */
export function applyThemeSetting(setting: AppSettings['theme'], root?: HTMLElement | null): ResolvedTheme {
  const resolved = resolveTheme(setting);
  applyResolvedTheme(resolved, root);
  if (!root) {
    cacheThemeSetting(setting);
  }
  return resolved;
}

export async function getAppSettingsTheme(): Promise<AppSettings['theme']> {
  if (!isExtensionContextValid()) {
    return 'light';
  }
  const result = await readLocalStorage<{ settings?: AppSettings }>('settings');
  return result?.settings?.theme ?? 'light';
}

export async function initExtensionTheme(root?: HTMLElement | null): Promise<ResolvedTheme> {
  const setting = await getAppSettingsTheme();
  return applyThemeSetting(setting, root);
}

export function watchThemeChanges(
  onTheme: (resolved: ResolvedTheme, setting: AppSettings['theme']) => void
): () => void {
  const media =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  const handler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local' || !changes.settings?.newValue) return;
    if (!isExtensionContextValid()) {
      notifyExtensionContextInvalidated();
      return;
    }
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

  const stopStorage = watchLocalStorage(handler);
  media?.addEventListener('change', onSystemChange);

  return () => {
    stopStorage();
    media?.removeEventListener('change', onSystemChange);
  };
}
