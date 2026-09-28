const INVALIDATED_EVENT = 'oneclick-extension-invalidated';

let invalidatedNotified = false;

/** True when this JS context can still talk to the extension (false after reload/update). */
export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function notifyExtensionContextInvalidated(): void {
  if (invalidatedNotified || typeof window === 'undefined') return;
  invalidatedNotified = true;
  window.dispatchEvent(new CustomEvent(INVALIDATED_EVENT));
}

export function onExtensionContextInvalidated(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = () => handler();
  window.addEventListener(INVALIDATED_EVENT, listener);
  return () => window.removeEventListener(INVALIDATED_EVENT, listener);
}

function markInvalidatedFromError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Extension context invalidated')) {
    notifyExtensionContextInvalidated();
  }
}

export function getExtensionURL(path: string): string | null {
  if (!isExtensionContextValid()) {
    notifyExtensionContextInvalidated();
    return null;
  }
  try {
    return chrome.runtime.getURL(path);
  } catch (error) {
    markInvalidatedFromError(error);
    return null;
  }
}

export function sendExtensionMessage<T = unknown>(message: unknown): Promise<T | null> {
  return new Promise((resolve) => {
    if (!isExtensionContextValid()) {
      notifyExtensionContextInvalidated();
      resolve(null);
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError?.message) {
          markInvalidatedFromError(new Error(lastError.message));
          resolve(null);
          return;
        }
        resolve((response as T) ?? null);
      });
    } catch (error) {
      markInvalidatedFromError(error);
      resolve(null);
    }
  });
}

export function addExtensionMessageListener(
  listener: (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void
): () => void {
  if (!isExtensionContextValid()) {
    return () => {};
  }
  try {
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      try {
        chrome.runtime.onMessage.removeListener(listener);
      } catch {
        /* context gone */
      }
    };
  } catch {
    notifyExtensionContextInvalidated();
    return () => {};
  }
}

export function readLocalStorage<T>(keys: string | string[]): Promise<T | null> {
  return new Promise((resolve) => {
    if (!isExtensionContextValid() || !chrome.storage?.local) {
      notifyExtensionContextInvalidated();
      resolve(null);
      return;
    }
    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError?.message) {
          markInvalidatedFromError(new Error(chrome.runtime.lastError.message));
          resolve(null);
          return;
        }
        resolve(result as T);
      });
    } catch (error) {
      markInvalidatedFromError(error);
      resolve(null);
    }
  });
}

export function watchLocalStorage(
  handler: (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => void
): () => void {
  if (!isExtensionContextValid() || !chrome.storage?.onChanged) {
    return () => {};
  }
  try {
    chrome.storage.onChanged.addListener(handler);
    return () => {
      try {
        chrome.storage.onChanged.removeListener(handler);
      } catch {
        /* context gone */
      }
    };
  } catch {
    notifyExtensionContextInvalidated();
    return () => {};
  }
}
