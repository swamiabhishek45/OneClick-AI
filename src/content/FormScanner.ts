import { ScannedFieldMetadata } from '../shared/ai';

export function scanFormFields(root: Element | Document = document): {
  elements: (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];
  metadata: ScannedFieldMetadata[];
} {
  const elements: (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[] = [];
  const metadata: ScannedFieldMetadata[] = [];

  function recursiveScan(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      // If it is an input, select, or textarea
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        // Exclude hidden fields and submit buttons
        const type = el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase();
        const shouldExclude =
          type === 'hidden' ||
          type === 'submit' ||
          type === 'button' ||
          type === 'image' ||
          type === 'reset' ||
          el.disabled ||
          ('readOnly' in el && (el as any).readOnly);

        if (!shouldExclude) {
          elements.push(el);
          
          // Generate unique scanId for references during this session
          const scanId = el.getAttribute('data-autofill-scan-id') || 
            (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
          el.setAttribute('data-autofill-scan-id', scanId);

          const label = findLabel(el);
          const surrounding = getSurroundingContext(el);

          metadata.push({
            scanId,
            type,
            label,
            placeholder: el.getAttribute('placeholder') || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            htmlId: el.id || '',
            htmlName: el.getAttribute('name') || '',
            surroundingText: surrounding
          });
        }
      }

      // Traverse children inside standard DOM
      const children = el.childNodes;
      for (let i = 0; i < children.length; i++) {
        recursiveScan(children[i]);
      }

      // Traverse inside open Shadow DOM
      if (el.shadowRoot) {
        const shadowChildren = el.shadowRoot.childNodes;
        for (let i = 0; i < shadowChildren.length; i++) {
          recursiveScan(shadowChildren[i]);
        }
      }
    } else if (node.nodeType === Node.DOCUMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      const children = node.childNodes;
      for (let i = 0; i < children.length; i++) {
        recursiveScan(children[i]);
      }
    }
  }

  recursiveScan(root);
  return { elements, metadata };
}

function findLabel(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  // 1. Aria attributes
  let ariaLabel = input.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  let ariaLabelledBy = input.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const rootNode = input.getRootNode() as Document | DocumentFragment;
    const labelEl = rootNode.getElementById(ariaLabelledBy);
    if (labelEl && labelEl.textContent && labelEl.textContent.trim()) {
      return labelEl.textContent.trim();
    }
  }

  // 2. Explicit label via "for" attribute referencing ID
  const id = input.id;
  if (id) {
    const rootNode = input.getRootNode() as Document | DocumentFragment;
    const labelEl = rootNode.querySelector(`label[for="${id}"]`);
    if (labelEl && labelEl.textContent && labelEl.textContent.trim()) {
      return labelEl.textContent.trim();
    }
  }

  // 3. Implicit label where input is nested inside <label>
  let parent = input.parentElement;
  while (parent) {
    if (parent.tagName.toLowerCase() === 'label') {
      // Clone label node, remove input elements, and get text
      const clone = parent.cloneNode(true) as HTMLElement;
      const innerInputs = clone.querySelectorAll('input, select, textarea');
      innerInputs.forEach(el => el.remove());
      const labelText = clone.textContent?.trim();
      if (labelText) return labelText;
    }
    parent = parent.parentElement;
  }

  // 4. Preceding sibling label or text
  let prev = input.previousElementSibling;
  if (prev) {
    if (prev.tagName.toLowerCase() === 'label' && prev.textContent && prev.textContent.trim()) {
      return prev.textContent.trim();
    }
    // E.g., a div that acts as label
    if (prev.classList.contains('label') || prev.classList.contains('field-label')) {
      if (prev.textContent && prev.textContent.trim()) return prev.textContent.trim();
    }
  }

  // 5. Parent wrapper text search (common in React/SPA design systems)
  const cell = input.closest('div, td, tr, li, p');
  if (cell) {
    // Look for text tags inside the same container
    const textNode = cell.querySelector('span, label, p, b, strong');
    if (textNode && textNode !== input && textNode.textContent && textNode.textContent.trim()) {
      // Make sure the text node doesn't contain the input itself
      if (!textNode.contains(input)) {
        return textNode.textContent.trim();
      }
    }
  }

  return '';
}

function getSurroundingContext(input: HTMLElement): string {
  const container = input.closest('div, td, tr, li, p') || input.parentElement;
  if (container) {
    // Extract text content and clean whitespaces
    const text = container.textContent || '';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    // Return a short slice to prevent bloating payload
    return cleaned.length > 150 ? cleaned.substring(0, 150) + '...' : cleaned;
  }
  return '';
}
