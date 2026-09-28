import { UserProfile } from './types';
import { readLocalStorage, sendExtensionMessage } from './extensionRuntime';

export const PROFILES_CACHE_KEY = 'profilesCache';

export function syncProfilesCache(profiles: UserProfile[]): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set({ [PROFILES_CACHE_KEY]: profiles }, () => resolve());
  });
}

export async function readProfilesCache(): Promise<UserProfile[]> {
  const result = await readLocalStorage<{ profilesCache?: UserProfile[] }>(PROFILES_CACHE_KEY);
  return result?.profilesCache ?? [];
}

/** Load profiles for popup/widget — message first, then storage cache. */
export async function fetchProfilesForUi(): Promise<UserProfile[]> {
  const response = await sendExtensionMessage<{ profiles?: UserProfile[] }>({
    action: 'getProfiles',
  });
  if (response?.profiles && response.profiles.length > 0) {
    return response.profiles;
  }
  return readProfilesCache();
}

export async function fetchActiveProfileIdForUi(): Promise<string> {
  const response = await sendExtensionMessage<{ activeProfileId?: string }>({
    action: 'getActiveProfileId',
  });
  return response?.activeProfileId || 'default';
}

export function resolveActiveProfileId(
  profiles: UserProfile[],
  activeProfileId: string
): string {
  if (profiles.length === 0) return activeProfileId || 'default';
  if (profiles.some((p) => p.id === activeProfileId)) return activeProfileId;
  const flagged = profiles.find((p) => p.isDefault);
  return flagged?.id ?? profiles[0].id;
}
