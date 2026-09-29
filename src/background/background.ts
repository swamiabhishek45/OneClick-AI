import {
  initDb,
  getProfiles,
  saveProfile,
  getResumes,
  saveResume,
  getProfileDocument,
  assignLegacyDocuments,
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
import { ProfileDocumentType, UserProfile } from '../shared/types';
import { createEmptyStarterProfile, DUMMY_DEMO_PROFILE } from '../shared/profileSeeds';
import {
  DEFAULT_COVER_LETTER_FILE_VALUE,
  DEFAULT_RESUME_MATCH_VALUE,
  ResumeFilePayload,
  scoreCoverLetterFileField,
  scoreResumeFileField,
  RESUME_FILE_ASSIGN_MIN_SCORE,
} from '../shared/resumeAutofill';
import { buildExportBundle, parseExportBundle } from '../shared/profileExport';
import { syncProfilesCache } from '../shared/profilesCache';

async function loadProfileDocumentPayload(
  profileId: string,
  documentType: ProfileDocumentType
): Promise<ResumeFilePayload | null> {
  const doc = await getProfileDocument(profileId, documentType);
  if (!doc?.base64Data?.trim()) return null;
  return {
    fileName: doc.fileName,
    fileType: doc.fileType,
    base64Data: doc.base64Data,
  };
}

function assignFileDocumentMatch(
  matches: Record<string, MatchResult>,
  scanId: string,
  confidence: number,
  kind: ProfileDocumentType
): void {
  matches[scanId] = {
    fieldPath: kind === 'resume' ? 'system.resume' : 'system.coverLetterFile',
    confidence,
    matchedValue:
      kind === 'resume' ? DEFAULT_RESUME_MATCH_VALUE : DEFAULT_COVER_LETTER_FILE_VALUE,
  };
}

async function refreshProfilesCache(): Promise<void> {
  await syncProfilesCache(await getProfiles());
}

async function prepareStoredData(): Promise<void> {
  await initDb();
  await assignLegacyDocuments(await getActiveProfileId());
  await refreshProfilesCache();
}

function getEffectiveGeminiApiKey(settings: { ai: { geminiApiKey?: string } }): string {
  return settings.ai.geminiApiKey?.trim() || '';
}

void initDb().catch((err) => {
  console.error('Database initialization failed on worker start:', err);
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('OneClick AI installed.');
  try {
    await initDb();
    const profiles = await getProfiles();

    if (!profiles.some((p) => p.id === DUMMY_DEMO_PROFILE.id)) {
      await saveProfile(DUMMY_DEMO_PROFILE);
    }

    if (profiles.length === 0) {
      await saveProfile(createEmptyStarterProfile());
    }
    await prepareStoredData();
  } catch (err) {
    console.error('Database initialization failed on install:', err);
  }
});

chrome.runtime.onStartup.addListener(() => {
  void prepareStoredData().catch((err) => {
    console.error('Startup data preparation failed:', err);
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'fill-active-page') return;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (!tabId) return;
  const profileId = await getActiveProfileId();
  chrome.tabs.sendMessage(
    tabId,
    { action: 'triggerAutofill', profileId, force: false },
    { frameId: 0 },
    () => void chrome.runtime.lastError
  );
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
        await refreshProfilesCache();
        notifyContentScriptsDataUpdated();
        sendResponse({ success: true });
        break;

      case 'getProfiles': {
        const profiles = await getProfiles();
        await syncProfilesCache(profiles);
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
        await refreshProfilesCache();
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

      case 'getProfileDocument': {
        const profileId = message.profileId || (await getActiveProfileId());
        const documentType: ProfileDocumentType =
          message.documentType === 'coverLetter' ? 'coverLetter' : 'resume';
        const resume = await loadProfileDocumentPayload(profileId, documentType);
        sendResponse({ resume, documentType });
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
        await assignLegacyDocuments(await getActiveProfileId());
        await refreshProfilesCache();
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

        const resumeReady = Boolean(await loadProfileDocumentPayload(profile.id, 'resume'));
        const coverLetterFileReady = Boolean(
          await loadProfileDocumentPayload(profile.id, 'coverLetter')
        );

        const applyHeuristicMatch = async (field: ScannedFieldMetadata) => {
          const heur = matchFieldHeuristically(field, profile, learningMappings);
          if (!heur) return;
          if (heur.fieldPath === 'system.resume') {
            if (resumeReady) {
              assignFileDocumentMatch(matches, field.scanId, heur.confidence, 'resume');
            }
          } else if (heur.fieldPath === 'system.coverLetterFile') {
            if (coverLetterFileReady) {
              assignFileDocumentMatch(matches, field.scanId, heur.confidence, 'coverLetter');
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

        const isUnmatchedFile = (f: ScannedFieldMetadata) =>
          f.type === 'file' && !matches[f.scanId]?.matchedValue?.trim();

        const coverCandidates = fields
          .filter((f) => isUnmatchedFile(f) && scoreCoverLetterFileField(f) >= 100)
          .sort((a, b) => scoreCoverLetterFileField(b) - scoreCoverLetterFileField(a));
        if (coverCandidates[0] && coverLetterFileReady) {
          const top = coverCandidates[0];
          assignFileDocumentMatch(
            matches,
            top.scanId,
            Math.min(0.95, 0.75 + scoreCoverLetterFileField(top) / 400),
            'coverLetter'
          );
        }

        const hasResumeMatch = Object.values(matches).some((m) => m.fieldPath === 'system.resume');
        const unmatchedFileFields = fields.filter(
          (f) =>
            isUnmatchedFile(f) &&
            scoreCoverLetterFileField(f) < 100 &&
            scoreResumeFileField(f) >= RESUME_FILE_ASSIGN_MIN_SCORE
        );
        if (unmatchedFileFields.length > 0 && resumeReady && !hasResumeMatch) {
          const ranked = unmatchedFileFields
            .map((f) => ({ field: f, score: scoreResumeFileField(f) }))
            .sort((a, b) => b.score - a.score);
          const top = ranked[0];
          const second = ranked[1];
          const pick =
            unmatchedFileFields.length === 1 ||
            top.score >= 95 ||
            (top.score >= RESUME_FILE_ASSIGN_MIN_SCORE &&
              (!second || top.score >= second.score + 8));
          if (pick) {
            assignFileDocumentMatch(
              matches,
              top.field.scanId,
              Math.min(0.95, 0.75 + top.score / 400),
              'resume'
            );
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
            existing.fieldPath === 'professional.coverLetter' ||
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
        const wantsGemini = !offlineOnly && hasApiKey && message.manual !== false;
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
                applicationMemory: settings.ai.applicationMemory?.trim() ?? '',
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
            { frameId: 0 },
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
