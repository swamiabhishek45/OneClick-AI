import { UserProfile, Resume, ManualMapping, WebsiteTemplate, LearningMapping, DomainRule, FillHistoryEntry, AppSettings, SavedCredential } from './types';

const DB_NAME = 'OneClickAutofillDB';
const DB_VERSION = 2;


let dbInstance: IDBDatabase | null = null;

export function initDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Profiles store
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'id' });
      }

      // Resumes store
      if (!db.objectStoreNames.contains('resumes')) {
        db.createObjectStore('resumes', { keyPath: 'id' });
      }

      // Templates store
      if (!db.objectStoreNames.contains('templates')) {
        const templateStore = db.createObjectStore('templates', { keyPath: 'id' });
        templateStore.createIndex('domain', 'domain', { unique: true });
      }

      // Manual Mappings store
      if (!db.objectStoreNames.contains('manualMappings')) {
        const mappingStore = db.createObjectStore('manualMappings', { keyPath: 'id' });
        mappingStore.createIndex('domain', 'domain', { unique: false });
      }

      // Learning mappings store
      if (!db.objectStoreNames.contains('learning')) {
        const learningStore = db.createObjectStore('learning', { keyPath: 'id' });
        learningStore.createIndex('label', 'label', { unique: true });
      }

      // History store
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id' });
      }

      // Domain Rules store
      if (!db.objectStoreNames.contains('domainRules')) {
        db.createObjectStore('domainRules', { keyPath: 'domain' });
      }

      // Credentials store
      if (!db.objectStoreNames.contains('credentials')) {
        const credentialStore = db.createObjectStore('credentials', { keyPath: 'id' });
        credentialStore.createIndex('domain', 'domain', { unique: false });
      }
    };
  });
}

// Helper to execute operations
async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const db = await initDb();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

// Profiles CRUD
export async function getProfiles(): Promise<UserProfile[]> {
  const store = await getStore('profiles');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const store = await getStore('profiles', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(profile);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProfile(id: string): Promise<void> {
  const store = await getStore('profiles', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Resumes CRUD
export async function getResumes(): Promise<Resume[]> {
  const store = await getStore('resumes');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveResume(resume: Resume): Promise<void> {
  const store = await getStore('resumes', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(resume);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteResume(id: string): Promise<void> {
  const store = await getStore('resumes', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Templates CRUD
export async function getTemplates(): Promise<WebsiteTemplate[]> {
  const store = await getStore('templates');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getTemplateByDomain(domain: string): Promise<WebsiteTemplate | null> {
  const db = await initDb();
  const transaction = db.transaction('templates', 'readonly');
  const store = transaction.objectStore('templates');
  const index = store.index('domain');
  
  return new Promise((resolve) => {
    const request = index.get(domain);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function saveTemplate(template: WebsiteTemplate): Promise<void> {
  const store = await getStore('templates', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(template);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  const store = await getStore('templates', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Manual Mappings CRUD
export async function getManualMappings(): Promise<ManualMapping[]> {
  const store = await getStore('manualMappings');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getManualMappingsByDomain(domain: string): Promise<ManualMapping[]> {
  const db = await initDb();
  const transaction = db.transaction('manualMappings', 'readonly');
  const store = transaction.objectStore('manualMappings');
  const index = store.index('domain');

  return new Promise((resolve, reject) => {
    const request = index.getAll(domain);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveManualMapping(mapping: ManualMapping): Promise<void> {
  const store = await getStore('manualMappings', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(mapping);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteManualMapping(id: string): Promise<void> {
  const store = await getStore('manualMappings', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Learning Mappings CRUD
export async function getLearningMappings(): Promise<LearningMapping[]> {
  const store = await getStore('learning');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getLearningMappingByLabel(label: string): Promise<LearningMapping | null> {
  const db = await initDb();
  const transaction = db.transaction('learning', 'readonly');
  const store = transaction.objectStore('learning');
  const index = store.index('label');

  return new Promise((resolve) => {
    const request = index.get(label);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function saveLearningMapping(learning: LearningMapping): Promise<void> {
  const store = await getStore('learning', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(learning);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// History CRUD
export async function getHistory(): Promise<FillHistoryEntry[]> {
  const store = await getStore('history');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result || [];
      // Sort by timestamp descending
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addHistoryEntry(entry: FillHistoryEntry): Promise<void> {
  const store = await getStore('history', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearHistory(): Promise<void> {
  const store = await getStore('history', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Domain Rules CRUD
export async function getDomainRules(): Promise<DomainRule[]> {
  const store = await getStore('domainRules');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getDomainRule(domain: string): Promise<DomainRule> {
  const store = await getStore('domainRules');
  return new Promise((resolve) => {
    const request = store.get(domain);
    request.onsuccess = () => {
      resolve(request.result || { domain, enabled: true, autoFillOnLoad: true, requireConfirmation: false });
    };
    request.onerror = () => {
      resolve({ domain, enabled: true, autoFillOnLoad: true, requireConfirmation: false });
    };
  });
}

export async function saveDomainRule(rule: DomainRule): Promise<void> {
  const store = await getStore('domainRules', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(rule);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Chrome Storage settings wrappers (shared & quick settings)
const DEFAULT_SETTINGS: AppSettings = {
  ai: {
    provider: 'hybrid',
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash',
    answerOpenQuestions: true,
    useJobDescriptionContext: true,
  },
  theme: 'light',
  globalEnabled: true,
};

export function getAppSettings(): Promise<AppSettings> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['settings'], (result) => {
        const stored = result.settings as AppSettings | undefined;
        if (!stored) {
          resolve(DEFAULT_SETTINGS);
          return;
        }
        resolve({
          ...DEFAULT_SETTINGS,
          ...stored,
          ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai },
        });
      });
    } else {
      // Fallback for non-extension environment (testing/dev mockup)
      const local = localStorage.getItem('autofill_settings');
      resolve(local ? JSON.parse(local) : DEFAULT_SETTINGS);
    }
  });
}

export function saveAppSettings(settings: AppSettings): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ settings }, () => {
        resolve();
      });
    } else {
      localStorage.setItem('autofill_settings', JSON.stringify(settings));
      resolve();
    }
  });
}

export function getActiveProfileId(): Promise<string> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['activeProfileId'], (result) => {
        resolve(result.activeProfileId || 'default');
      });
    } else {
      resolve(localStorage.getItem('active_profile_id') || 'default');
    }
  });
}

export function setActiveProfileId(id: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ activeProfileId: id }, () => {
        resolve();
      });
    } else {
      localStorage.setItem('active_profile_id', id);
      resolve();
    }
  });
}

// Credentials CRUD
export async function getCredentials(): Promise<SavedCredential[]> {
  const store = await getStore('credentials');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getCredentialByDomain(domain: string): Promise<SavedCredential | null> {
  const db = await initDb();
  const transaction = db.transaction('credentials', 'readonly');
  const store = transaction.objectStore('credentials');
  const index = store.index('domain');

  return new Promise((resolve) => {
    const request = index.get(domain);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function saveCredential(credential: SavedCredential): Promise<void> {
  const store = await getStore('credentials', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(credential);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCredential(id: string): Promise<void> {
  const store = await getStore('credentials', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
