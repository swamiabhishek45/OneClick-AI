import React from 'react';
import { createRoot } from 'react-dom/client';
import WidgetApp from './WidgetApp';
import { scanFormFields } from './FormScanner';
import { fillFormFields } from './AutofillEngine';
import '../index.css';

// Keep track of what we filled to detect user manual overrides/corrections
const filledFieldsMap = new Map<HTMLElement, {
  label: string;
  fieldPath: string;
  originalValue: string;
}>();

// Initialize the React Floating Widget inside a Shadow DOM
function initWidget() {
  // Check if widget is already injected
  if (document.getElementById('oneclick-autofill-root')) return;

  const hostDiv = document.createElement('div');
  hostDiv.id = 'oneclick-autofill-root';
  
  // Isolate widget styles from the host page using Shadow DOM
  const shadowRoot = hostDiv.attachShadow({ mode: 'open' });
  
  // Create stylesheet link pointing to our chrome extension css
  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = chrome.runtime.getURL('content.css');
  shadowRoot.appendChild(linkEl);

  const container = document.createElement('div');
  container.id = 'oneclick-widget-container';
  shadowRoot.appendChild(container);

  document.body.appendChild(hostDiv);

  // Render Widget
  const root = createRoot(container);
  root.render(<WidgetApp />);
}

// Check if domain rule allows autofill on load
function checkAutoFillOnLoad() {
  chrome.runtime.sendMessage({
    action: 'getDomainRule',
    domain: window.location.hostname
  }, (response) => {
    if (response && response.rule) {
      const { enabled, autoFillOnLoad } = response.rule;
      if (enabled && autoFillOnLoad) {
        // Trigger automatic fill after a brief delay
        setTimeout(() => {
          triggerAutofill();
        }, 1000);
      }
    }
  });
}

// Function to trigger scan and fill
function triggerAutofill(profileId?: string) {
  const targetProfileId = profileId || 'default';
  
  // Send scan request to background to match fields with AI (heuristic or LLM)
  const { elements, metadata } = scanFormFields(document);
  if (elements.length === 0) return;

  chrome.runtime.sendMessage({
    action: 'matchFields',
    fields: metadata,
    profileId: targetProfileId
  }, (response) => {
    if (response && response.matches) {
      const matches = response.matches; // map of scanId -> MatchResult
      const fillPayload: { element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; value: string }[] = [];

      for (const el of elements) {
        const scanId = el.getAttribute('data-autofill-scan-id');
        if (scanId && matches[scanId]) {
          const match = matches[scanId];
          fillPayload.push({
            element: el,
            value: match.matchedValue
          });

          // Track this element for corrections detection
          const labelText = metadata.find(m => m.scanId === scanId)?.label || 
                            metadata.find(m => m.scanId === scanId)?.placeholder || '';

          filledFieldsMap.set(el, {
            label: labelText,
            fieldPath: match.fieldPath,
            originalValue: match.matchedValue
          });

          // Add listener to check for manual user changes
          el.addEventListener('blur', handleFieldBlur);
        }
      }

      if (fillPayload.length > 0) {
        const count = fillFormFields(fillPayload);
        // Log to history
        chrome.runtime.sendMessage({
          action: 'logHistory',
          domain: window.location.hostname,
          fieldsCount: count,
          profileId: targetProfileId
        });
      }
    }
  });
}

// Listener for manual corrections
function handleFieldBlur(e: Event) {
  const el = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const tracking = filledFieldsMap.get(el);
  if (!tracking) return;

  const currentValue = el.type === 'checkbox' ? String((el as HTMLInputElement).checked) : el.value;
  
  if (currentValue !== tracking.originalValue) {
    // Value was modified by the user!
    // Send background message to learn this correction
    chrome.runtime.sendMessage({
      action: 'learnCorrection',
      label: tracking.label,
      currentValue: currentValue,
      previousPath: tracking.fieldPath
    });

    // Remove tracking to prevent duplicate logs
    filledFieldsMap.delete(el);
    el.removeEventListener('blur', handleFieldBlur);
  }
}

// Observe dynamic changes (MutationObserver)
let mutationTimeout: any;
function setupMutationObserver() {
  chrome.runtime.sendMessage({
    action: 'getDomainRule',
    domain: window.location.hostname
  }, (response) => {
    if (!response || !response.rule || !response.rule.enabled) return;

    const observer = new MutationObserver(() => {
      clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(() => {
        // If autoFillOnLoad is enabled, run auto-fill on newly detected fields
        if (response.rule.autoFillOnLoad) {
          triggerAutofill();
        }
      }, 1000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// Listen to message calls from background or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'triggerAutofill') {
    triggerAutofill(message.profileId);
    sendResponse({ success: true });
  }
  return true;
});

// Run Init
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
