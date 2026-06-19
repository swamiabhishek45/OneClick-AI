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
  getActiveProfileId, 
  setActiveProfileId,
  getCredentials,
  saveCredential,
  deleteCredential,
  getCredentialByDomain
} from '../shared/db';
import { matchFieldHeuristically, matchFieldsWithGemini, MatchResult, ScannedFieldMetadata } from '../shared/ai';
import { learnUserCorrection } from '../shared/learning';
import { UserProfile } from '../shared/types';

// Initialize Database on install or worker start
chrome.runtime.onInstalled.addListener(async () => {
  console.log("OneClick Autofill AI installed.");
  try {
    await initDb();
    // Pre-populate a default profile if none exists
    const profiles = await getProfiles();
    if (profiles.length === 0) {
      const defaultProfile: UserProfile = {
        id: 'default',
        name: 'Default Profile',
        personal: {
          fullName: 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+15551234567',
          address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          country: 'United States',
          postalCode: '94105'
        },
        professional: {
          jobTitle: 'Software Engineer',
          experience: '3',
          currentCompany: 'Tech Corp',
          skills: 'TypeScript, React, Node.js, Python, CSS, HTML',
          education: 'Bachelor of Science',
          degree: 'Computer Science',
          college: 'Stanford University',
          linkedin: 'https://linkedin.com/in/johndoe',
          github: 'https://github.com/johndoe',
          portfolio: 'https://johndoe.dev'
        },
        education: {
          tenth: {
            schoolOrCollege: 'Lincoln High School',
            degree: 'High School',
            fieldOfStudy: 'General',
            passingYear: '2016',
            grade: '92%'
          },
          twelfthOrDiploma: {
            schoolOrCollege: 'Lincoln Junior College',
            degree: 'Higher Secondary',
            fieldOfStudy: 'Science',
            passingYear: '2018',
            grade: '95%'
          },
          ug: {
            schoolOrCollege: 'Stanford University',
            degree: 'Bachelor of Science',
            fieldOfStudy: 'Computer Science',
            passingYear: '2022',
            grade: '3.8 GPA'
          },
          pg: {
            schoolOrCollege: 'Stanford University',
            degree: 'Master of Science',
            fieldOfStudy: 'Computer Science',
            passingYear: '2024',
            grade: '3.9 GPA'
          }
        },
        jobInfo: {
          currentCTC: '100,000 USD',
          expectedCTC: '130,000 USD',
          noticePeriod: '30 Days',
          preferredLocation: 'San Francisco, Remote'
        },
        customFields: []
      };
      await saveProfile(defaultProfile);
    }
  } catch (err) {
    console.error("Database initialization failed on install:", err);
  }
});

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
        
        const profiles = await getProfiles();
        const profile = profiles.find(p => p.id === profileId) || profiles[0];
        
        if (!profile) {
          sendResponse({ matches: {} });
          return;
        }

        const settings = await getAppSettings();
        const learningMappings = await getLearningMappings();
        const domain = sender.url ? new URL(sender.url).hostname : '';
        
        // 1. Load manual mappings for this domain
        const manualMappings = await getManualMappingsByDomain(domain);
        
        // 2. Load template for this domain
        const template = await getTemplateByDomain(domain);

        const matches: Record<string, MatchResult> = {};

        // Run Heuristics/Gemini matching
        let geminiMatches: Record<string, MatchResult> = {};
        if (settings.ai.provider === 'gemini' && settings.ai.geminiApiKey) {
          geminiMatches = await matchFieldsWithGemini(fields, profile, settings.ai.geminiApiKey, settings.ai.geminiModel);
        }

        for (const field of fields) {
          // A. Check manual mapping overlay first
          const mMapping = manualMappings.find(m => m.selector === field.htmlId || m.selector === `#${field.htmlId}` || m.selector.includes(field.htmlName));
          if (mMapping) {
            const val = getProfileValueByPath(profile, mMapping.fieldPath);
            if (val) {
              matches[field.scanId] = {
                fieldPath: mMapping.fieldPath,
                confidence: 1.0,
                matchedValue: val
              };
              continue;
            }
          }

          // B. Check website-specific templates
          if (template) {
            const rule = template.rules.find(r => r.selector === field.htmlId || r.selector === `#${field.htmlId}` || r.selector.includes(field.htmlName));
            if (rule) {
              const val = rule.customValue || getProfileValueByPath(profile, rule.fieldPath);
              if (val) {
                matches[field.scanId] = {
                  fieldPath: rule.fieldPath,
                  confidence: 1.0,
                  matchedValue: val
                };
                continue;
              }
            }
          }

          // C. If Gemini matched this field, use it
          if (geminiMatches[field.scanId]) {
            matches[field.scanId] = geminiMatches[field.scanId];
            continue;
          }

          // D. Fallback to offline heuristic/learning matching
          const heur = matchFieldHeuristically(field, profile, learningMappings);
          if (heur) {
            if (heur.fieldPath === 'system.resume') {
              const resumes = await getResumes();
              const defaultResume = resumes.find(r => r.isDefault) || resumes[0];
              if (defaultResume) {
                matches[field.scanId] = {
                  fieldPath: 'system.resume',
                  confidence: 0.95,
                  matchedValue: JSON.stringify({
                    fileName: defaultResume.fileName,
                    fileType: defaultResume.fileType,
                    base64Data: defaultResume.base64Data
                  })
                };
              }
            } else {
              matches[field.scanId] = heur;
            }
          }
        }

        sendResponse({ matches });
        break;
      }

      case 'autofillPage': {
        // Find active tab and trigger autofill
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (activeTab && activeTab.id) {
          chrome.tabs.sendMessage(activeTab.id, {
            action: 'triggerAutofill',
            profileId: message.profileId
          }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: 'Autofill not loaded. Please reload the webpage.' });
            } else {
              sendResponse(response || { success: false });
            }
          });
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

// Helper to get nested value from profile object
function getProfileValueByPath(profile: UserProfile, path: string): string {
  if (path.startsWith('custom:')) {
    const customId = path.split(':')[1];
    const field = profile.customFields.find((f) => f.id === customId);
    return field ? field.value : '';
  }

  const parts = path.split('.');
  let current: any = profile;
  for (const part of parts) {
    if (current && current[part] !== undefined) {
      current = current[part];
    } else {
      return '';
    }
  }
  return typeof current === 'string' ? current : '';
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
