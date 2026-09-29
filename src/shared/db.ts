import {
  UserProfile,
  Resume,
  ManualMapping,
  LearningMapping,
  DomainRule,
  AppSettings,
  ProfileDocumentType,
} from './types';

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

export function getDocumentType(doc: Resume): ProfileDocumentType {
  return doc.documentType === 'coverLetter' ? 'coverLetter' : 'resume';
}

function newestFirst(a: Resume, b: Resume): number {
  return (b.uploadedAt || '').localeCompare(a.uploadedAt || '');
}

export async function getProfileDocuments(
  profileId: string,
  documentType: ProfileDocumentType
): Promise<Resume[]> {
  const all = await getResumes();
  return all
    .filter((r) => r.profileId === profileId && getDocumentType(r) === documentType)
    .sort(newestFirst);
}

/** Active file for autofill; falls back to the newest upload. */
export async function getProfileDocument(
  profileId: string,
  documentType: ProfileDocumentType
): Promise<Resume | null> {
  const docs = await getProfileDocuments(profileId, documentType);
  return docs.find((r) => r.isDefault) || docs[0] || null;
}

export async function setActiveProfileDocument(id: string): Promise<void> {
  const all = await getResumes();
  const target = all.find((r) => r.id === id);
  if (!target) return;
  const type = getDocumentType(target);
  for (const doc of all) {
    if (doc.profileId !== target.profileId || getDocumentType(doc) !== type) continue;
    const shouldBeActive = doc.id === id;
    if (Boolean(doc.isDefault) !== shouldBeActive) {
      await saveResume({ ...doc, isDefault: shouldBeActive });
    }
  }
}

/** Deletes a file and promotes the newest remaining one if it was active. */
export async function deleteProfileDocument(id: string): Promise<void> {
  const all = await getResumes();
  const target = all.find((r) => r.id === id);
  await deleteResume(id);
  if (!target?.isDefault) return;
  const remaining = all
    .filter(
      (r) =>
        r.id !== id &&
        r.profileId === target.profileId &&
        getDocumentType(r) === getDocumentType(target)
    )
    .sort(newestFirst);
  if (remaining[0]) {
    await saveResume({ ...remaining[0], isDefault: true });
  }
}

export async function deleteProfileDocuments(profileId: string): Promise<void> {
  const all = await getResumes();
  for (const doc of all) {
    if (doc.profileId === profileId) {
      await deleteResume(doc.id);
    }
  }
}

/** Assigns files uploaded before per-profile documents existed to the given profile. */
export async function assignLegacyDocuments(profileId: string): Promise<void> {
  const all = await getResumes();
  for (const doc of all) {
    if (!doc.profileId) {
      await saveResume({ ...doc, profileId, documentType: getDocumentType(doc) });
    }
  }
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

export async function clearLearningMappings(): Promise<void> {
  const store = await getStore('learning', 'readwrite');
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
      resolve(request.result || { domain, enabled: true, autoFillOnLoad: false, requireConfirmation: false });
    };
    request.onerror = () => {
      resolve({ domain, enabled: true, autoFillOnLoad: false, requireConfirmation: false });
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
    applicationMemory: '',
  },
  theme: 'light',
  globalEnabled: true,
  learnFromCorrections: true,
  siteAllowlist: [],
  showFillPreview: false,
  autoFillOnLoad: false,
};

function normalizeAppSettings(stored: Partial<AppSettings> | undefined): AppSettings {
  const aiRaw: Partial<AppSettings['ai']> = stored?.ai ?? {};
  const provider =
    aiRaw.provider === 'heuristic' || aiRaw.provider === 'hybrid'
      ? aiRaw.provider
      : 'hybrid';

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    ai: {
      ...DEFAULT_SETTINGS.ai,
      ...aiRaw,
      provider,
      applicationMemory:
        typeof aiRaw.applicationMemory === 'string' ? aiRaw.applicationMemory : '',
    },
    learnFromCorrections: stored?.learnFromCorrections !== false,
    siteAllowlist: Array.isArray(stored?.siteAllowlist) ? stored.siteAllowlist : [],
    showFillPreview: false,
    autoFillOnLoad: stored?.autoFillOnLoad === true,
  };
}

export function getAppSettings(): Promise<AppSettings> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['settings'], (result) => {
        const stored = result.settings as AppSettings | undefined;
        resolve(normalizeAppSettings(stored));
      });
    } else {
      const local = localStorage.getItem('autofill_settings');
      resolve(local ? normalizeAppSettings(JSON.parse(local)) : DEFAULT_SETTINGS);
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

