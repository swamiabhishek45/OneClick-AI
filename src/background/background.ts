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
  isOpenEndedQuestionField,
  AI_GENERATED_FIELD_PATH,
  MatchResult,
  ScannedFieldMetadata,
} from '../shared/ai';
import { learnUserCorrection } from '../shared/learning';
import { UserProfile } from '../shared/types';
import { createEmptyStarterProfile, DUMMY_DEMO_PROFILE } from '../shared/profileSeeds';

function getEffectiveGeminiApiKey(settings: { ai: { geminiApiKey?: string } }): string {
  return settings.ai.geminiApiKey?.trim() || '';
}

// Initialize Database on install or worker start
chrome.runtime.onInstalled.addListener(async () => {
  console.log("OneClick Autofill AI installed.");
  try {
    await initDb();
    const profiles = await getProfiles();

    if (!profiles.some((p) => p.id === DUMMY_DEMO_PROFILE.id)) {
      await saveProfile(DUMMY_DEMO_PROFILE);
    }

    if (profiles.length === 0) {
      await saveProfile(createEmptyStarterProfile());
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
        let geminiWarning: string | undefined;
        const apiKey = getEffectiveGeminiApiKey(settings);
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

        for (const scanId of Object.keys(matches)) {
          if (!matches[scanId].matchedValue?.trim()) {
            delete matches[scanId];
          }
        }

        for (const field of fields) {
          if (isOpenEndedQuestionField(field) && !matches[field.scanId]?.matchedValue?.trim()) {
            delete matches[field.scanId];
          }
        }

        // Long-form fields need generated answers — drop short heuristic keyword hits (e.g. "experience" → "1+").
        for (const field of fields) {
          const type = (field.type || '').toLowerCase();
          if (type !== 'textarea' && type !== 'contenteditable' && type !== 'textbox') {
            continue;
          }
          const existing = matches[field.scanId];
          if (!existing?.matchedValue?.trim()) continue;
          if (
            existing.fieldPath === AI_GENERATED_FIELD_PATH ||
            existing.fieldPath.startsWith('custom:')
          ) {
            continue;
          }
          delete matches[field.scanId];
        }

        const stillUnmatched = fields.filter((f) => !matches[f.scanId]?.matchedValue?.trim());
        const provider = settings.ai.provider;
        const hasApiKey = Boolean(apiKey);
        const hasNonOpenEndedGaps = stillUnmatched.some((f) => !isOpenEndedQuestionField(f));
        const wantsGeminiMapping =
          hasApiKey &&
          (provider === 'hybrid' ||
            provider === 'gemini' ||
            (provider === 'heuristic' && hasNonOpenEndedGaps));
        const wantsGeminiAnswers =
          hasApiKey && settings.ai.answerOpenQuestions !== false;

        if (!hasApiKey && stillUnmatched.some(isOpenEndedQuestionField)) {
          geminiWarning =
            'Gemini API key missing. Add your key in Dashboard → Settings & AI.';
        }

        if (stillUnmatched.length > 0 && (wantsGeminiMapping || wantsGeminiAnswers)) {
          try {
            const aiFilled = await resolveUnmatchedFieldsWithGemini(
              stillUnmatched,
              profile,
              apiKey,
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
            if (
              Object.keys(aiFilled).length === 0 &&
              stillUnmatched.some(isOpenEndedQuestionField)
            ) {
              geminiWarning =
                geminiWarning ||
                'Gemini did not return answers. Check API key, model name, and quota in Google AI Studio.';
            }
          } catch (error) {
            console.error('Gemini autofill error:', error);
            geminiWarning = `Gemini error: ${error instanceof Error ? error.message : String(error)}`;
          }
        }

        sendResponse({ matches, geminiWarning });
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
