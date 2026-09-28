import React from 'react';
import { createRoot } from 'react-dom/client';
import WidgetApp from './WidgetApp';
import { scanFormFields, findLoginFields } from './FormScanner';
import { extractJobDescription } from './JobDescriptionScanner';
import { fillFormFields, fillFormFieldsAsync, isFieldEmpty } from './AutofillEngine';
import { AI_GENERATED_FIELD_PATH, AUTO_FILL_CONFIDENCE_THRESHOLD } from '../shared/ai';
import { DomainRule } from '../shared/types';
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

function initWidget() {
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
}

async function fetchDomainRule(): Promise<DomainRule | null> {
  const response = await sendExtensionMessage<{ rule?: DomainRule }>({
    action: 'getDomainRule',
    domain: window.location.hostname,
  });
  return response?.rule ?? null;
}

async function fetchGlobalEnabled(): Promise<boolean> {
  const response = await sendExtensionMessage<{ settings?: { globalEnabled?: boolean } }>({
    action: 'getAppSettings',
  });
  if (!response) return false;
  return response.settings?.globalEnabled !== false;
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
}): Promise<{ allowed: boolean; rule: DomainRule | null; reason?: string }> {
  const globalEnabled = await fetchGlobalEnabled();
  if (!globalEnabled) {
    return { allowed: false, rule: null, reason: 'Extension is disabled in settings.' };
  }

  const rule = await fetchDomainRule();
  if (!rule) {
    return { allowed: options.manual, rule: null };
  }

  if (!rule.enabled && !options.manual) {
    return { allowed: false, rule, reason: 'Automatic autofill is off for this site.' };
  }

  if (
    !options.manual &&
    rule.requireConfirmation &&
    !options.skipConfirmation &&
    !window.confirm('OneClick Autofill AI: Fill detected form fields with your active profile?')
  ) {
    return { allowed: false, rule, reason: 'Autofill cancelled.' };
  }

  return { allowed: true, rule };
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

    const credResponse = await sendExtensionMessage<{
      credential?: { username?: string; password?: string };
    }>({ action: 'getCredentialForDomain', domain: window.location.hostname });
    if (credResponse?.credential) {
      const { username, password } = findLoginFields();
      if (username && credResponse.credential.username && (force || isFieldEmpty(username))) {
        fillFormFields([{ element: username, value: credResponse.credential.username }]);
      }
      if (password && credResponse.credential.password && (force || isFieldEmpty(password))) {
        fillFormFields([{ element: password, value: credResponse.credential.password }]);
      }
    }

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

    const jobDescription = extractJobDescription(document);

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

    for (const el of eligibleElements) {
      const scanId = el.getAttribute('data-autofill-scan-id');
      if (!scanId || !matches[scanId]) continue;

      const match = matches[scanId];
      if (!match.matchedValue) continue;
      const minForField =
        match.fieldPath === AI_GENERATED_FIELD_PATH ? 0.35 : minConfidence;
      if (match.confidence < minForField) continue;

      const meta = eligibleMetadata.find((m) => m.scanId === scanId);
      fillPayload.push({
        element: el,
        value: match.matchedValue,
        controlKind: meta?.controlKind,
      });

      const labelText = meta?.label || meta?.placeholder || '';

      filledFieldsMap.set(el, {
        label: labelText,
        fieldPath: match.fieldPath,
        originalValue: match.matchedValue,
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
          'No confident field matches for this form. Add your Gemini API key in Settings & AI.',
      };
    }

    const count = await fillFormFieldsAsync(fillPayload);
    lastAutofillAt = Date.now();

    void sendExtensionMessage({
      action: 'logHistory',
      domain: window.location.hostname,
      fieldsCount: count,
      profileId: targetProfileId,
    });

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

      const rule = await fetchDomainRule();
      const globalEnabled = await fetchGlobalEnabled();
      if (!globalEnabled || !rule?.enabled || !rule.autoFillOnLoad) return;

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
  const rule = await fetchDomainRule();
  const globalEnabled = await fetchGlobalEnabled();
  if (!globalEnabled || !rule?.enabled || !rule.autoFillOnLoad) return;

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
    initWidget();
  }
  checkAutoFillOnLoad();
  setupMutationObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapContentScript);
} else {
  bootstrapContentScript();
}
