import React from 'react';
import { createRoot } from 'react-dom/client';
import WidgetApp from './WidgetApp';
import { scanFormFields } from './FormScanner';
import { extractJobDescription } from './JobDescriptionScanner';
import { fillFormFields, fillFormFieldsAsync, isFieldEmpty } from './AutofillEngine';
import { AI_GENERATED_FIELD_PATH, AUTO_FILL_CONFIDENCE_THRESHOLD } from '../shared/ai';
import { isDefaultResumeMatchValue } from '../shared/resumeAutofill';
import { AppSettings } from '../shared/types';
import { isHostAllowed } from '../shared/siteAccess';
import {
  addExtensionMessageListener,
  getExtensionURL,
  isExtensionContextValid,
  notifyExtensionContextInvalidated,
  onExtensionContextInvalidated,
  sendExtensionMessage,
} from '../shared/extensionRuntime';
import '../index.css';

const AUTOFILL_MSG_SOURCE = 'oneclick-autofill';

type AutofillRunResult = { success: boolean; filledCount: number; error?: string };

function isTopFrame(): boolean {
  try {
    return window.self === window.top;
  } catch {
    return true;
  }
}

/** Same-origin iframes (e.g. some embedded apply flows). */
function getAccessibleDocuments(): Document[] {
  const docs: Document[] = [document];
  const seen = new Set<Document>([document]);
  const queue = Array.from(document.querySelectorAll('iframe'));

  for (const iframe of queue) {
    try {
      const doc = iframe.contentDocument;
      if (doc && !seen.has(doc)) {
        seen.add(doc);
        docs.push(doc);
        queue.push(...Array.from(doc.querySelectorAll('iframe')));
      }
    } catch {
      /* cross-origin */
    }
  }
  return docs;
}

function scanAllFormFields(): { elements: HTMLElement[]; metadata: import('../shared/ai').ScannedFieldMetadata[] } {
  const elements: HTMLElement[] = [];
  const metadata: import('../shared/ai').ScannedFieldMetadata[] = [];
  for (const doc of getAccessibleDocuments()) {
    const scan = scanFormFields(doc);
    elements.push(...scan.elements);
    metadata.push(...scan.metadata);
  }
  return { elements, metadata };
}

function installGlobalInvalidationHandlers(): void {
  const swallowIfInvalidated = (event: ErrorEvent | PromiseRejectionEvent) => {
    const message =
      event instanceof PromiseRejectionEvent
        ? String(event.reason?.message ?? event.reason)
        : String(event.message ?? '');
    if (
      message.includes('Extension context invalidated') ||
      message.includes('Receiving end does not exist')
    ) {
      event.preventDefault?.();
      notifyExtensionContextInvalidated();
      teardownContentScript();
    }
  };
  window.addEventListener('error', swallowIfInvalidated);
  window.addEventListener('unhandledrejection', swallowIfInvalidated);
}

const filledFieldsMap = new Map<HTMLElement, {
  label: string;
  fieldPath: string;
  originalValue: string;
}>();

let autofillInProgress = false;
let lastAutofillAt = 0;
let mutationObserver: MutationObserver | null = null;
let widgetMounted = false;

function initWidget() {
  if (widgetMounted) return;
  if (!isExtensionContextValid()) return;
  if (document.getElementById('oneclick-autofill-root')) return;

  const cssUrl = getExtensionURL('content.css');
  if (!cssUrl) return;

  const hostDiv = document.createElement('div');
  hostDiv.id = 'oneclick-autofill-root';
  hostDiv.style.cssText =
    'position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; overflow: visible;';

  const shadowRoot = hostDiv.attachShadow({ mode: 'open' });

  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = cssUrl;
  shadowRoot.appendChild(linkEl);

  const container = document.createElement('div');
  container.id = 'oneclick-widget-container';
  container.style.pointerEvents = 'auto';
  shadowRoot.appendChild(container);

  document.body.appendChild(hostDiv);

  const root = createRoot(container);
  root.render(<WidgetApp />);
  widgetMounted = true;
}

function scheduleWidgetInit() {
  if (widgetMounted || !isTopFrame()) return;
  initWidget();
}

function setupLazyWidgetMount() {
  const tryDetectForms = () => {
    const { elements } = scanAllFormFields();
    if (elements.length > 0) {
      scheduleWidgetInit();
    }
  };

  window.setTimeout(tryDetectForms, 800);

  const onFirstInteraction = () => {
    scheduleWidgetInit();
    window.removeEventListener('pointerdown', onFirstInteraction, true);
    window.removeEventListener('keydown', onFirstInteraction, true);
  };
  window.addEventListener('pointerdown', onFirstInteraction, true);
  window.addEventListener('keydown', onFirstInteraction, true);
}

function highlightFilledElements(elements: HTMLElement[]) {
  for (const el of elements) {
    const prevOutline = el.style.outline;
    const prevOffset = el.style.outlineOffset;
    el.style.outline = '2px solid #22c55e';
    el.style.outlineOffset = '2px';
    window.setTimeout(() => {
      el.style.outline = prevOutline;
      el.style.outlineOffset = prevOffset;
    }, 3500);
  }
}

async function fetchAppSettings(): Promise<AppSettings | null> {
  const response = await sendExtensionMessage<{ settings?: AppSettings }>({
    action: 'getAppSettings',
  });
  return response?.settings ?? null;
}

async function fetchActiveProfileId(): Promise<string> {
  const response = await sendExtensionMessage<{ activeProfileId?: string }>({
    action: 'getActiveProfileId',
  });
  return response?.activeProfileId || 'default';
}

async function shouldRunAutofill(options: {
  manual: boolean;
  skipConfirmation?: boolean;
}): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await fetchAppSettings();
  const globalEnabled = settings?.globalEnabled !== false;
  if (!globalEnabled) {
    return { allowed: false, reason: 'Extension is disabled in settings.' };
  }

  if (settings && !isHostAllowed(window.location.hostname, settings.siteAllowlist)) {
    return {
      allowed: false,
      reason: 'This site is not on your allowlist. Add it in Dashboard → Settings.',
    };
  }

  if (!options.manual && settings?.autoFillOnLoad !== true) {
    return { allowed: false, reason: 'Auto-fill on page load is off.' };
  }

  return { allowed: true };
}

async function runAutofill(options: {
  profileId?: string;
  manual?: boolean;
  force?: boolean;
  skipConfirmation?: boolean;
}): Promise<{ success: boolean; filledCount: number; error?: string }> {
  if (autofillInProgress) {
    return { success: false, filledCount: 0, error: 'Autofill already in progress.' };
  }

  const manual = options.manual === true;
  const gate = await shouldRunAutofill({ manual, skipConfirmation: options.skipConfirmation });
  if (!gate.allowed) {
    return { success: false, filledCount: 0, error: gate.reason };
  }

  autofillInProgress = true;
  try {
    const targetProfileId = options.profileId || (await fetchActiveProfileId());
    const force = options.force === true;

    const { elements, metadata } = scanAllFormFields();
    if (elements.length === 0) {
      return { success: false, filledCount: 0, error: 'No fillable fields found on this page.' };
    }

    const eligibleElements: HTMLElement[] = [];
    const eligibleMetadata = metadata.filter((m) => {
      const el = elements.find((e) => e.getAttribute('data-autofill-scan-id') === m.scanId);
      if (!el) return false;
      if (!force && !isFieldEmpty(el)) return false;
      eligibleElements.push(el);
      return true;
    });

    if (eligibleMetadata.length === 0) {
      return { success: true, filledCount: 0, error: 'All detected fields are already filled.' };
    }

    const appSettings = await fetchAppSettings();
    const jobDescription =
      manual && appSettings?.ai.useJobDescriptionContext !== false
        ? extractJobDescription(document)
        : '';

    const matchResponse = (await sendExtensionMessage<{
      matches?: Record<string, { fieldPath: string; confidence: number; matchedValue: string }>;
      geminiWarning?: string;
    }>({
      action: 'matchFields',
      fields: eligibleMetadata,
      profileId: targetProfileId,
      jobDescription,
    })) ?? {};
    const matches = matchResponse.matches || {};
    const geminiWarning = matchResponse.geminiWarning;

    const fillPayload: { element: HTMLElement; value: string; controlKind?: string }[] = [];
    const minConfidence = manual ? 0.4 : AUTO_FILL_CONFIDENCE_THRESHOLD;
    let cachedResumePayloadJson: string | null = null;
    const previewElements: HTMLElement[] = [];
    let aiFieldCount = 0;
    let resumeFieldCount = 0;

    const resolveFillValue = async (match: {
      fieldPath: string;
      matchedValue: string;
    }): Promise<string | null> => {
      if (
        match.fieldPath !== 'system.resume' &&
        !isDefaultResumeMatchValue(match.matchedValue)
      ) {
        return match.matchedValue;
      }
      if (match.matchedValue.startsWith('{') && match.matchedValue.includes('base64Data')) {
        return match.matchedValue;
      }
      if (!cachedResumePayloadJson) {
        const resumeResponse = await sendExtensionMessage<{
          resume?: { fileName: string; fileType: string; base64Data: string };
        }>({ action: 'getDefaultResume' });
        if (!resumeResponse?.resume?.base64Data) return null;
        cachedResumePayloadJson = JSON.stringify(resumeResponse.resume);
      }
      return cachedResumePayloadJson;
    };

    for (const el of eligibleElements) {
      const scanId = el.getAttribute('data-autofill-scan-id');
      if (!scanId || !matches[scanId]) continue;

      const match = matches[scanId];
      if (!match.matchedValue) continue;
      const minForField =
        match.fieldPath === AI_GENERATED_FIELD_PATH ? 0.35 : minConfidence;
      if (match.confidence < minForField) continue;

      const fillValue = await resolveFillValue(match);
      if (!fillValue) continue;

      const meta = eligibleMetadata.find((m) => m.scanId === scanId);
      fillPayload.push({
        element: el,
        value: fillValue,
        controlKind: meta?.controlKind,
      });
      previewElements.push(el);
      if (match.fieldPath === AI_GENERATED_FIELD_PATH) aiFieldCount += 1;
      if (match.fieldPath === 'system.resume' || isDefaultResumeMatchValue(match.matchedValue)) {
        resumeFieldCount += 1;
      }

      const labelText = meta?.label || meta?.placeholder || '';

      filledFieldsMap.set(el, {
        label: labelText,
        fieldPath: match.fieldPath,
        originalValue: fillValue,
      });

      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        el.addEventListener('blur', handleFieldBlur);
      }
    }

    if (fillPayload.length === 0) {
      return {
        success: false,
        filledCount: 0,
        error:
          geminiWarning ||
          'No confident field matches for this form. Add your Gemini API key in Settings.',
      };
    }

    if (
      manual &&
      !options.skipConfirmation &&
      appSettings?.showFillPreview !== false
    ) {
      const parts = [`Fill ${fillPayload.length} field${fillPayload.length === 1 ? '' : 's'}?`];
      if (aiFieldCount > 0) {
        parts.push(`${aiFieldCount} will use AI-generated text`);
      }
      if (resumeFieldCount > 0) {
        parts.push(`${resumeFieldCount} resume upload${resumeFieldCount === 1 ? '' : 's'}`);
      }
      if (!window.confirm(`OneClick Autofill AI\n\n${parts.join('\n')}`)) {
        return { success: false, filledCount: 0, error: 'Autofill cancelled.' };
      }
    }

    const count = await fillFormFieldsAsync(fillPayload);
    lastAutofillAt = Date.now();
    highlightFilledElements(previewElements);

    window.dispatchEvent(
      new CustomEvent('oneclick-autofill-complete', { detail: { filledCount: count } })
    );

    return { success: true, filledCount: count };
  } finally {
    autofillInProgress = false;
  }
}

function handleFieldBlur(e: Event) {
  const el = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const tracking = filledFieldsMap.get(el);
  if (!tracking) return;

  const currentValue =
    el.type === 'checkbox' ? String((el as HTMLInputElement).checked) : el.value;

  if (currentValue !== tracking.originalValue) {
    void sendExtensionMessage({
      action: 'learnCorrection',
      label: tracking.label,
      currentValue,
      previousPath: tracking.fieldPath,
    });

    filledFieldsMap.delete(el);
    el.removeEventListener('blur', handleFieldBlur);
  }
}

let mutationTimeout: ReturnType<typeof setTimeout> | undefined;

function setupMutationObserver() {
  mutationObserver?.disconnect();
  mutationObserver = new MutationObserver(() => {
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(async () => {
      if (!isExtensionContextValid()) return;
      if (Date.now() - lastAutofillAt < 800) return;

      const settings = await fetchAppSettings();
      const globalEnabled = settings?.globalEnabled !== false;
      if (!globalEnabled || settings?.autoFillOnLoad !== true) return;

      await orchestrateAutofill({ manual: false });
    }, 1200);
  });

  if (document.body) {
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function teardownContentScript() {
  clearTimeout(mutationTimeout);
  mutationObserver?.disconnect();
  mutationObserver = null;
  document.getElementById('oneclick-autofill-root')?.remove();
}

onExtensionContextInvalidated(teardownContentScript);

/** Top frame: run here + ask cross-origin iframe content scripts via postMessage. */
async function orchestrateAutofill(options: {
  profileId?: string;
  manual?: boolean;
  force?: boolean;
  skipConfirmation?: boolean;
}): Promise<AutofillRunResult> {
  if (!isTopFrame()) {
    return runAutofill(options);
  }

  const iframeCount = document.querySelectorAll('iframe').length;
  let iframeFilled = 0;
  let iframeErrors = 0;

  if (iframeCount > 0) {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(() => resolve(), 2500);
      const onMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || data.source !== AUTOFILL_MSG_SOURCE) return;
        if (data.action === 'autofill-result') {
          if (typeof data.filledCount === 'number') {
            iframeFilled += data.filledCount;
          }
          if (data.success === false && data.error) {
            iframeErrors += 1;
          }
        }
        if (data.action === 'autofill-done') {
          window.clearTimeout(timeout);
          window.removeEventListener('message', onMessage);
          resolve();
        }
      };
      window.addEventListener('message', onMessage);

      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          iframe.contentWindow?.postMessage(
            {
              source: AUTOFILL_MSG_SOURCE,
              action: 'run-autofill',
              profileId: options.profileId,
              force: options.force === true,
              skipConfirmation: options.skipConfirmation,
            },
            '*'
          );
        } catch {
          /* ignore */
        }
      }
    });
  }

  const localResult = await runAutofill(options);
  const totalFilled = localResult.filledCount + iframeFilled;

  if (totalFilled > 0) {
    return { success: true, filledCount: totalFilled };
  }
  if (localResult.success && localResult.filledCount === 0 && iframeFilled === 0) {
    return localResult;
  }
  if (!localResult.success && iframeFilled === 0 && iframeErrors > 0) {
    return {
      success: false,
      filledCount: 0,
      error: localResult.error || 'Could not fill fields in embedded application frame.',
    };
  }
  return { ...localResult, filledCount: totalFilled, success: totalFilled > 0 || localResult.success };
}

function handleAutofillPostMessage(event: MessageEvent): void {
  const data = event.data;
  if (!data || data.source !== AUTOFILL_MSG_SOURCE || data.action !== 'run-autofill') {
    return;
  }
  if (isTopFrame()) {
    return;
  }

  void (async () => {
    const result = await runAutofill({
      profileId: data.profileId,
      manual: true,
      force: data.force === true,
      skipConfirmation: data.skipConfirmation,
    });
    try {
      window.parent.postMessage(
        {
          source: AUTOFILL_MSG_SOURCE,
          action: 'autofill-result',
          filledCount: result.filledCount,
          success: result.success,
          error: result.error,
        },
        '*'
      );
    } catch {
      /* ignore */
    } finally {
      try {
        window.parent.postMessage({ source: AUTOFILL_MSG_SOURCE, action: 'autofill-done' }, '*');
      } catch {
        /* ignore */
      }
    }
  })();
}

async function checkAutoFillOnLoad() {
  const settings = await fetchAppSettings();
  const globalEnabled = settings?.globalEnabled !== false;
  if (!globalEnabled || settings?.autoFillOnLoad !== true) return;

  setTimeout(() => {
    if (isTopFrame()) {
      void orchestrateAutofill({ manual: false });
    } else {
      void runAutofill({ manual: false });
    }
  }, 900);
}

addExtensionMessageListener((message, _sender, sendResponse) => {
  const payload = message as { action?: string; profileId?: string; force?: boolean };
  if (payload.action === 'triggerAutofill') {
    orchestrateAutofill({
      profileId: payload.profileId,
      manual: true,
      force: payload.force === true,
    }).then(sendResponse);
    return true;
  }
  return false;
});

function bootstrapContentScript(): void {
  installGlobalInvalidationHandlers();
  window.addEventListener('message', handleAutofillPostMessage);

  window.addEventListener('oneclick-request-autofill', ((event: Event) => {
    const detail = (event as CustomEvent<{
      profileId?: string;
      force?: boolean;
      skipConfirmation?: boolean;
    }>).detail;
    void orchestrateAutofill({
      profileId: detail?.profileId,
      manual: true,
      force: detail?.force === true,
      skipConfirmation: detail?.skipConfirmation,
    }).then((result) => {
      window.dispatchEvent(new CustomEvent('oneclick-autofill-result', { detail: result }));
    });
  }) as EventListener);

  if (isTopFrame()) {
    setupLazyWidgetMount();
  }
  checkAutoFillOnLoad();
  setupMutationObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapContentScript);
} else {
  bootstrapContentScript();
}
