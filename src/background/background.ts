import {
  initDb,
  getProfiles,
  saveProfile,
  getResumes,
  saveResume,
  getManualMappingsByDomain,
  saveManualMapping,
  getLearningMappings,
  getDomainRule,
  saveDomainRule,
  getAppSettings,
  saveAppSettings,
  getActiveProfileId,
  setActiveProfileId,
  clearLearningMappings,
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
import {
  DEFAULT_RESUME_MATCH_VALUE,
  ResumeFilePayload,
  scoreResumeFileField,
} from '../shared/resumeAutofill';
import { buildExportBundle, parseExportBundle } from '../shared/profileExport';

async function loadDefaultResumePayload(): Promise<ResumeFilePayload | null> {
  const resumes = await getResumes();
  const defaultResume = resumes.find((r) => r.isDefault) || resumes[0];
  if (!defaultResume?.base64Data?.trim()) return null;
  return {
    fileName: defaultResume.fileName,
    fileType: defaultResume.fileType,
    base64Data: defaultResume.base64Data,
  };
}

function assignResumeMatch(
  matches: Record<string, MatchResult>,
  scanId: string,
  confidence: number
): void {
  matches[scanId] = {
    fieldPath: 'system.resume',
    confidence,
    matchedValue: DEFAULT_RESUME_MATCH_VALUE,
  };
}

function getEffectiveGeminiApiKey(settings: { ai: { geminiApiKey?: string } }): string {
  return settings.ai.geminiApiKey?.trim() || '';
}

void initDb().catch((err) => {
  console.error('Database initialization failed on worker start:', err);
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('OneClick Autofill AI installed.');
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
    console.error('Database initialization failed on install:', err);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'fill-active-page') return;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (!tabId) return;
  const profileId = await getActiveProfileId();
  chrome.tabs.sendMessage(tabId, {
    action: 'triggerAutofill',
    profileId,
    force: false,
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

async function handleMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  try {
    await initDb();
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

      case 'saveAppSettings': {
        await saveAppSettings(message.settings);
        notifyContentScriptsDataUpdated();
        sendResponse({ success: true });
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

      case 'getDefaultResume': {
        const resume = await loadDefaultResumePayload();
        sendResponse({ resume });
        break;
      }

      case 'exportData': {
        const profiles = await getProfiles();
        const resumes = await getResumes();
        sendResponse({ bundle: buildExportBundle(profiles, resumes) });
        break;
      }

      case 'importData': {
        const bundle = parseExportBundle(message.json);
        for (const profile of bundle.profiles) {
          await saveProfile(profile);
        }
        for (const resume of bundle.resumes) {
          await saveResume(resume);
        }
        notifyContentScriptsDataUpdated();
        sendResponse({ success: true, profileCount: bundle.profiles.length });
        break;
      }

      case 'clearLearnedMappings': {
        await clearLearningMappings();
        sendResponse({ success: true });
        break;
      }

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
        const learningMappings = settings.learnFromCorrections
          ? await getLearningMappings()
          : [];
        const domain = sender.url ? new URL(sender.url).hostname : '';
        const manualMappings = await getManualMappingsByDomain(domain);

        const matches: Record<string, MatchResult> = {};
        let geminiWarning: string | undefined;
        const apiKey = getEffectiveGeminiApiKey(settings);
        const useJobDescription =
          settings.ai.useJobDescriptionContext !== false && jobDescription.length > 0;
        const jdContext = useJobDescription ? jobDescription : '';

        const defaultResumeReady = Boolean(await loadDefaultResumePayload());

        const applyHeuristicMatch = async (field: ScannedFieldMetadata) => {
          const heur = matchFieldHeuristically(field, profile, learningMappings);
          if (!heur) return;
          if (heur.fieldPath === 'system.resume') {
            if (defaultResumeReady) {
              assignResumeMatch(matches, field.scanId, heur.confidence);
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

          await applyHeuristicMatch(field);
        }

        const unmatchedFileFields = fields.filter(
          (f) => f.type === 'file' && !matches[f.scanId]?.matchedValue?.trim()
        );
        if (unmatchedFileFields.length > 0 && defaultResumeReady) {
          const ranked = unmatchedFileFields
            .map((f) => ({ field: f, score: scoreResumeFileField(f) }))
            .sort((a, b) => b.score - a.score);
          const top = ranked[0];
          const second = ranked[1];
          const pick =
            unmatchedFileFields.length === 1 ||
            top.score >= 90 ||
            (top.score >= 50 && (!second || top.score >= second.score + 12));
          if (pick && top.score >= 35) {
            assignResumeMatch(matches, top.field.scanId, Math.min(0.95, 0.75 + top.score / 400));
          }
        }

        for (const scanId of Object.keys(matches)) {
          const val = matches[scanId].matchedValue;
          if (val === undefined || val === null || String(val).trim() === '') {
            delete matches[scanId];
          }
        }

        for (const field of fields) {
          if (isOpenEndedQuestionField(field) && !matches[field.scanId]?.matchedValue?.trim()) {
            delete matches[field.scanId];
          }
        }

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
        const offlineOnly = provider === 'heuristic';
        const wantsGemini =
          !offlineOnly && hasApiKey;
        const wantsGeminiAnswers =
          wantsGemini && settings.ai.answerOpenQuestions !== false;

        if (offlineOnly && stillUnmatched.length > 0) {
          /* offline only */
        } else if (!hasApiKey && stillUnmatched.some(isOpenEndedQuestionField)) {
          geminiWarning = 'Gemini API key missing. Add your key in Dashboard → Settings.';
        }

        if (stillUnmatched.length > 0 && wantsGemini) {
          try {
            const aiFilled = await resolveUnmatchedFieldsWithGemini(
              stillUnmatched,
              profile,
              apiKey,
              settings.ai.geminiModel,
              {
                jobDescription: jdContext,
                includeProfileMapping: true,
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
        const tabId = sender.tab?.id ?? tabs[0]?.id;
        if (tabId) {
          const profileId = message.profileId || (await getActiveProfileId());
          chrome.tabs.sendMessage(
            tabId,
            {
              action: 'triggerAutofill',
              profileId,
              force: message.force === true,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                sendResponse({
                  success: false,
                  error: 'Autofill not loaded. Refresh this page after reloading the extension.',
                });
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
          ...message.mapping,
        });
        sendResponse({ success: true });
        break;
      }

      case 'learnCorrection': {
        const settings = await getAppSettings();
        if (!settings.learnFromCorrections) {
          sendResponse({ success: true, skipped: true });
          break;
        }
        const { label, currentValue, previousPath } = message;
        const activeId = await getActiveProfileId();
        const profiles = await getProfiles();
        const profile = profiles.find((p) => p.id === activeId) || profiles[0];

        if (profile) {
          const correctedPath = findProfilePathForValue(profile, currentValue);
          if (correctedPath) {
            await learnUserCorrection(label, correctedPath);
          } else {
            await learnUserCorrection(label, previousPath);
          }
        }
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error: any) {
    console.error('Background message handler error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function findProfilePathForValue(profile: UserProfile, value: string): string | null {
  const checkVal = String(value).toLowerCase().trim();
  if (!checkVal) return null;

  for (const [key, val] of Object.entries(profile.personal)) {
    if (String(val).toLowerCase().trim() === checkVal) {
      return `personal.${key}`;
    }
  }
  for (const [key, val] of Object.entries(profile.professional)) {
    if (String(val).toLowerCase().trim() === checkVal) {
      return `professional.${key}`;
    }
  }
  for (const [key, val] of Object.entries(profile.jobInfo)) {
    if (String(val).toLowerCase().trim() === checkVal) {
      return `jobInfo.${key}`;
    }
  }
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

  for (const cf of profile.customFields) {
    if (String(cf.value).toLowerCase().trim() === checkVal) {
      return `custom:${cf.id}`;
    }
  }
  return null;
}

function notifyContentScriptsDataUpdated() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'dataUpdated' }, () => {
          void chrome.runtime.lastError;
        });
      }
    }
  });
}
