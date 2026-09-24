import React from 'react';
import { createRoot } from 'react-dom/client';
import WidgetApp from './WidgetApp';
import { scanFormFields, findLoginFields } from './FormScanner';
import { extractJobDescription } from './JobDescriptionScanner';
import { fillFormFields, fillFormFieldsAsync, isFieldEmpty } from './AutofillEngine';
import { AUTO_FILL_CONFIDENCE_THRESHOLD } from '../shared/ai';
import { DomainRule } from '../shared/types';
import '../index.css';

const filledFieldsMap = new Map<HTMLElement, {
  label: string;
  fieldPath: string;
  originalValue: string;
}>();

let autofillInProgress = false;
let lastAutofillAt = 0;

function initWidget() {
  if (document.getElementById('oneclick-autofill-root')) return;

  const hostDiv = document.createElement('div');
  hostDiv.id = 'oneclick-autofill-root';

  const shadowRoot = hostDiv.attachShadow({ mode: 'open' });

  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = chrome.runtime.getURL('content.css');
  shadowRoot.appendChild(linkEl);

  const container = document.createElement('div');
  container.id = 'oneclick-widget-container';
  shadowRoot.appendChild(container);

  document.body.appendChild(hostDiv);

  const root = createRoot(container);
  root.render(<WidgetApp />);
}

function fetchDomainRule(): Promise<DomainRule | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'getDomainRule', domain: window.location.hostname },
      (response) => resolve(response?.rule ?? null)
    );
  });
}

function fetchGlobalEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getAppSettings' }, (response) => {
      resolve(response?.settings?.globalEnabled !== false);
    });
  });
}

function fetchActiveProfileId(): Promise<string> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getActiveProfileId' }, (response) => {
      resolve(response?.activeProfileId || 'default');
    });
  });
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

    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getCredentialForDomain', domain: window.location.hostname },
        (response) => {
          if (response?.credential) {
            const { username, password } = findLoginFields();
            if (username && response.credential.username && (force || isFieldEmpty(username))) {
              fillFormFields([{ element: username, value: response.credential.username }]);
            }
            if (password && response.credential.password && (force || isFieldEmpty(password))) {
              fillFormFields([{ element: password, value: response.credential.password }]);
            }
          }
          resolve();
        }
      );
    });

    const { elements, metadata } = scanFormFields(document);
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

    const matches: Record<string, { fieldPath: string; confidence: number; matchedValue: string }> =
      await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'matchFields',
            fields: eligibleMetadata,
            profileId: targetProfileId,
            jobDescription,
          },
          (response) => resolve(response?.matches || {})
        );
      });

    const fillPayload: { element: HTMLElement; value: string; controlKind?: string }[] = [];
    const minConfidence = manual ? 0.4 : AUTO_FILL_CONFIDENCE_THRESHOLD;

    for (const el of eligibleElements) {
      const scanId = el.getAttribute('data-autofill-scan-id');
      if (!scanId || !matches[scanId]) continue;

      const match = matches[scanId];
      if (match.confidence < minConfidence || !match.matchedValue) continue;

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
      return { success: false, filledCount: 0, error: 'No confident field matches for this form.' };
    }

    const count = await fillFormFieldsAsync(fillPayload);
    lastAutofillAt = Date.now();

    chrome.runtime.sendMessage({
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
    chrome.runtime.sendMessage({
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
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(async () => {
      if (Date.now() - lastAutofillAt < 800) return;

      const rule = await fetchDomainRule();
      const globalEnabled = await fetchGlobalEnabled();
      if (!globalEnabled || !rule?.enabled || !rule.autoFillOnLoad) return;

      await runAutofill({ manual: false });
    }, 1200);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

async function checkAutoFillOnLoad() {
  const rule = await fetchDomainRule();
  const globalEnabled = await fetchGlobalEnabled();
  if (!globalEnabled || !rule?.enabled || !rule.autoFillOnLoad) return;

  setTimeout(() => {
    runAutofill({ manual: false });
  }, 900);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'triggerAutofill') {
    runAutofill({
      profileId: message.profileId,
      manual: true,
      force: message.force === true,
    }).then(sendResponse);
    return true;
  }
  return false;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initWidget();
    checkAutoFillOnLoad();
    setupMutationObserver();
  });
} else {
  initWidget();
  checkAutoFillOnLoad();
  setupMutationObserver();
}
