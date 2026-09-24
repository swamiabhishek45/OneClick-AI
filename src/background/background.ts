import { 
  initDb, 
  getProfiles, 
  saveProfile, 
  getResumes, 
  saveResume, 
  getTemplates, 
  getTemplateByDomain, 
  saveTemplate, 
  getManualMappingsByDomain, 
  saveManualMapping, 
  getLearningMappings, 
  saveLearningMapping, 
  addHistoryEntry, 
  getDomainRule, 
  saveDomainRule, 
  getAppSettings,
  saveAppSettings,
  getActiveProfileId, 
  setActiveProfileId,
  getCredentials,
  saveCredential,
  deleteCredential,
  getCredentialByDomain
} from '../shared/db';
import {
  matchFieldHeuristically,
  resolveUnmatchedFieldsWithGemini,
  getProfileValueByPath,
  MatchResult,
  ScannedFieldMetadata,
} from '../shared/ai';
import { learnUserCorrection } from '../shared/learning';
import { UserProfile } from '../shared/types';

/** Sync API key from local `.env` at build time into extension storage (if dashboard key is empty). */
async function syncGeminiKeyFromBuildEnv() {
  const builtInKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!builtInKey) return;

  const settings = await getAppSettings();
  if (settings.ai.geminiApiKey?.trim()) return;

  await saveAppSettings({
    ...settings,
    ai: {
      ...settings.ai,
      geminiApiKey: builtInKey,
      provider: settings.ai.provider === 'heuristic' ? 'hybrid' : settings.ai.provider,
    },
  });
}

// Initialize Database on install or worker start
chrome.runtime.onInstalled.addListener(async () => {
  console.log("OneClick Autofill AI installed.");
  try {
    await initDb();
    await syncGeminiKeyFromBuildEnv();
    // Pre-populate a default profile if none exists
    const profiles = await getProfiles();
    const defaultProfile: UserProfile = {
      id: 'default',
      name: 'Abhishek Profile',
      personal: {
        fullName: 'Abhishek Baswaraj Swami',
        firstName: 'Abhishek',
        lastName: 'Swami',
        email: 'abhishekswami1435@gmail.com',
        phone: '+918956008591',
        address: 'Pune',
        city: 'Pune',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '411001',
      },
      professional: {
        jobTitle: 'Full Stack Developer',
        experience: '1+',
        currentCompany: 'One Union Solutions',
        skills:
          'TypeScript, JavaScript, React, Next.js, Node.js, Express.js, Python, REST APIs, MongoDB, PostgreSQL, HTML, CSS, Tailwind CSS, Git, Docker, LLM, GenAI, Prompt Engineering, RAG, AI Integration, Full Stack Development',
        education:
          'B.Tech (CSE)',
        degree: 'B.Tech',
        college: 'Vilasrao Deshmukh Foundation Group of Institutions, Latur',
        linkedin: 'https://www.linkedin.com/in/swamiabhishek45/',
        github: 'https://github.com/swamiabhishek45',
        portfolio: 'https://swamiabhishek45.online/',
      },
      education: {
        tenth: {
          schoolOrCollege: 'Parimal High School, Latur',
          degree: 'SSC',
          fieldOfStudy: 'Science',
          passingYear: '2019',
          grade: '86.20%',
        },
        twelfthOrDiploma: {
          schoolOrCollege: 'Shyamgir Mahavidyalaya, Latur',
          degree: 'HSC',
          fieldOfStudy: 'PCMB',
          passingYear: '2021',
          grade: '82.16%',
        },
        ug: {
          schoolOrCollege: 'Vilasrao Deshmukh Foundation Group of Institutions, Latur',
          degree: 'B.Tech',
          fieldOfStudy: 'CSE',
          passingYear: '2025',
          grade: '8.20 CGPA',
        },
        pg: {
          schoolOrCollege: '',
          degree: '',
          fieldOfStudy: '',
          passingYear: '',
          grade: '',
        },
      },
      jobInfo: {
        currentCTC: '350000',
        expectedCTC: '500000',
        noticePeriod: '15 Days',
        preferredLocation: 'Pune, Remote',
      },
      customFields: [],
    };

    if (profiles.length === 0) {
      await saveProfile(defaultProfile);
    } else {
      const existingDefault = profiles.find((p) => p.id === 'default');
      const seedEmails = new Set(['john.doe@example.com', 'abhishekswami1435@gmail.com']);
      if (
        existingDefault &&
        seedEmails.has(existingDefault.personal.email.toLowerCase())
      ) {
        await saveProfile({ ...defaultProfile, name: existingDefault.name });
      }
    }
  } catch (err) {
    console.error("Database initialization failed on install:", err);
  }
});

void syncGeminiKeyFromBuildEnv();

// Listener to open Options Page
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// Message Coordinator
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keeps channel open for asynchronous reply
});

async function handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  try {
    switch (message.action) {
      
      case 'openOptionsPage':
        chrome.runtime.openOptionsPage();
        sendResponse({ success: true });
        break;

      case 'notifyDataUpdated':
        notifyContentScriptsDataUpdated();
        sendResponse({ success: true });
        break;

      case 'getProfiles': {
        const profiles = await getProfiles();
        sendResponse({ profiles });
        break;
      }

      case 'getActiveProfileId': {
        const id = await getActiveProfileId();
        sendResponse({ activeProfileId: id });
        break;
      }

      case 'setActiveProfileId': {
        await setActiveProfileId(message.activeProfileId);
        notifyContentScriptsDataUpdated();
        sendResponse({ success: true });
        break;
      }

      case 'saveProfile': {
        await saveProfile(message.profile);
        notifyContentScriptsDataUpdated();
        sendResponse({ success: true });
        break;
      }

      case 'getCredentials': {
        const credentials = await getCredentials();
        sendResponse({ credentials });
        break;
      }

      case 'getCredentialForDomain': {
        const credential = await getCredentialByDomain(message.domain);
        sendResponse({ credential });
        break;
      }

      case 'saveCredential': {
        await saveCredential({
          id: message.credential.id || Math.random().toString(36).substring(2),
          createdAt: new Date().toISOString(),
          ...message.credential
        });
        notifyContentScriptsDataUpdated();
        sendResponse({ success: true });
        break;
      }

      case 'deleteCredential': {
        await deleteCredential(message.id);
        notifyContentScriptsDataUpdated();
        sendResponse({ success: true });
        break;
      }

      case 'getDomainRule': {
        const rule = await getDomainRule(message.domain);
        sendResponse({ rule });
        break;
      }

      case 'getAppSettings': {
        const settings = await getAppSettings();
        sendResponse({ settings });
        break;
      }

      case 'saveDomainRule': {
        await saveDomainRule(message.rule);
        notifyContentScriptsDataUpdated();
        sendResponse({ success: true });
        break;
      }

      case 'getResumes': {
        const resumes = await getResumes();
        sendResponse({ resumes });
        break;
      }

      case 'saveResume': {
        await saveResume(message.resume);
        notifyContentScriptsDataUpdated();
        sendResponse({ success: true });
        break;
      }

      // Fields Matcher (incorporates Heuristic + Manual Mappings + website templates + Gemini API)
      case 'matchFields': {
        const fields = message.fields as ScannedFieldMetadata[];
        const profileId = message.profileId;
        const jobDescription =
          typeof message.jobDescription === 'string' ? message.jobDescription : '';

        const profiles = await getProfiles();
        const profile = profiles.find((p) => p.id === profileId) || profiles[0];

        if (!profile) {
          sendResponse({ matches: {} });
          return;
        }

        const settings = await getAppSettings();
        const learningMappings = await getLearningMappings();
        const domain = sender.url ? new URL(sender.url).hostname : '';
        const manualMappings = await getManualMappingsByDomain(domain);
        const template = await getTemplateByDomain(domain);

        const matches: Record<string, MatchResult> = {};
        const apiKey = settings.ai.geminiApiKey?.trim();
        const useJobDescription =
          settings.ai.useJobDescriptionContext !== false && jobDescription.length > 0;
        const jdContext = useJobDescription ? jobDescription : '';

        const applyHeuristicMatch = async (field: ScannedFieldMetadata) => {
          const heur = matchFieldHeuristically(field, profile, learningMappings);
          if (!heur) return;
          if (heur.fieldPath === 'system.resume') {
            const resumes = await getResumes();
            const defaultResume = resumes.find((r) => r.isDefault) || resumes[0];
            if (defaultResume) {
              matches[field.scanId] = {
                fieldPath: 'system.resume',
                confidence: 0.95,
                matchedValue: JSON.stringify({
                  fileName: defaultResume.fileName,
                  fileType: defaultResume.fileType,
                  base64Data: defaultResume.base64Data,
                }),
              };
            }
          } else {
            matches[field.scanId] = heur;
          }
        };

        for (const field of fields) {
          const mMapping = manualMappings.find((m) => {
            if (
              field.htmlId &&
              (m.selector === field.htmlId ||
                m.selector === `#${field.htmlId}` ||
                m.selector.endsWith(`#${field.htmlId}`))
            ) {
              return true;
            }
            if (
              field.htmlName &&
              (m.selector.includes(`name="${field.htmlName}"`) ||
                m.selector.includes(field.htmlName))
            ) {
              return true;
            }
            return false;
          });
          if (mMapping) {
            const val = getProfileValueByPath(profile, mMapping.fieldPath);
            if (val) {
              matches[field.scanId] = {
                fieldPath: mMapping.fieldPath,
                confidence: 1.0,
                matchedValue: val,
              };
              continue;
            }
          }

          if (template) {
            const rule = template.rules.find(
              (r) =>
                r.selector === field.htmlId ||
                r.selector === `#${field.htmlId}` ||
                r.selector.includes(field.htmlName)
            );
            if (rule) {
              const val = rule.customValue || getProfileValueByPath(profile, rule.fieldPath);
              if (val) {
                matches[field.scanId] = {
                  fieldPath: rule.fieldPath,
                  confidence: 1.0,
                  matchedValue: val,
                };
                continue;
              }
            }
          }

          await applyHeuristicMatch(field);
        }

        const stillUnmatched = fields.filter((f) => !matches[f.scanId]);
        const provider = settings.ai.provider;
        const hasApiKey = Boolean(apiKey);
        const wantsGeminiMapping =
          hasApiKey && (provider === 'hybrid' || provider === 'gemini');
        const wantsGeminiAnswers =
          hasApiKey && settings.ai.answerOpenQuestions !== false;

        if (stillUnmatched.length > 0 && (wantsGeminiMapping || wantsGeminiAnswers)) {
          const aiFilled = await resolveUnmatchedFieldsWithGemini(
            stillUnmatched,
            profile,
            apiKey!,
            settings.ai.geminiModel,
            {
              jobDescription: jdContext,
              includeProfileMapping: wantsGeminiMapping,
              includeGeneratedAnswers: wantsGeminiAnswers,
            }
          );
          for (const [scanId, match] of Object.entries(aiFilled)) {
            if (!matches[scanId]) {
              matches[scanId] = match;
            }
          }
        }

        sendResponse({ matches });
        break;
      }

      case 'autofillPage': {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (activeTab && activeTab.id) {
          const profileId = message.profileId || (await getActiveProfileId());
          chrome.tabs.sendMessage(
            activeTab.id,
            {
              action: 'triggerAutofill',
              profileId,
              force: message.force === true,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: 'Autofill not loaded. Please reload the webpage.' });
              } else {
                sendResponse(response || { success: false, filledCount: 0 });
              }
            }
          );
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
        break;
      }

      case 'saveManualMapping': {
        await saveManualMapping({
          id: Math.random().toString(36).substring(2),
          createdAt: new Date().toISOString(),
          ...message.mapping
        });
        sendResponse({ success: true });
        break;
      }

      case 'saveWebsiteTemplate': {
        // Scanner gets currently filled values and creates rules
        // In this implementation, background can query active tab input fields
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (activeTab && activeTab.id) {
          // Inject script or send message to fetch currently loaded form fields and their values
          chrome.tabs.sendMessage(activeTab.id, { action: 'triggerAutofill', profileId: 'default' }, async () => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: 'Cannot connect to tab. Please reload the webpage.' });
              return;
            }
            // Placeholder template save
            const newTemplate = {
              id: Math.random().toString(36).substring(2),
              domain: message.domain,
              name: `${message.domain} Template`,
              rules: [],
              createdAt: new Date().toISOString()
            };
            await saveTemplate(newTemplate);
            sendResponse({ success: true });
          });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
        break;
      }

      case 'learnCorrection': {
        const { label, currentValue, previousPath } = message;
        const activeId = await getActiveProfileId();
        const profiles = await getProfiles();
        const profile = profiles.find(p => p.id === activeId) || profiles[0];
        
        if (profile) {
          const correctedPath = findProfilePathForValue(profile, currentValue);
          if (correctedPath) {
            await learnUserCorrection(label, correctedPath);
          } else {
            // Keep previous but lower score if it was changed to something not in profile
            await learnUserCorrection(label, previousPath);
          }
        }
        sendResponse({ success: true });
        break;
      }

      case 'logHistory': {
        const profiles = await getProfiles();
        const profile = profiles.find(p => p.id === message.profileId) || profiles[0];
        
        await addHistoryEntry({
          id: Math.random().toString(36).substring(2),
          domain: message.domain,
          timestamp: new Date().toISOString(),
          fieldsCount: message.fieldsCount,
          profileName: profile ? profile.name : 'Unknown Profile'
        });
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error: any) {
    console.error("Background message handler error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Find key path inside profile object matching value
function findProfilePathForValue(profile: UserProfile, value: string): string | null {
  const checkVal = String(value).toLowerCase().trim();
  if (!checkVal) return null;

  // Search personal
  for (const [key, val] of Object.entries(profile.personal)) {
    if (String(val).toLowerCase().trim() === checkVal) {
      return `personal.${key}`;
    }
  }
  // Search professional
  for (const [key, val] of Object.entries(profile.professional)) {
    if (String(val).toLowerCase().trim() === checkVal) {
      return `professional.${key}`;
    }
  }
  // Search jobInfo
  for (const [key, val] of Object.entries(profile.jobInfo)) {
    if (String(val).toLowerCase().trim() === checkVal) {
      return `jobInfo.${key}`;
    }
  }
  // Search education
  if (profile.education) {
    for (const [level, levelObj] of Object.entries(profile.education)) {
      if (levelObj && typeof levelObj === 'object') {
        for (const [key, val] of Object.entries(levelObj)) {
          if (String(val).toLowerCase().trim() === checkVal) {
            return `education.${level}.${key}`;
          }
        }
      }
    }
  }

  // Search custom fields
  for (const cf of profile.customFields) {
    if (String(cf.value).toLowerCase().trim() === checkVal) {
      return `custom:${cf.id}`;
    }
  }
  return null;
}

// Notify all open tabs/content scripts that extension data has changed
function notifyContentScriptsDataUpdated() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'dataUpdated' }, () => {
          // Access lastError to silence connection errors on un-injected tabs
          const err = chrome.runtime.lastError;
        });
      }
    }
  });
}
