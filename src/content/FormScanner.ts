import { ScannedFieldMetadata } from '../shared/ai';

export function scanFormFields(root: Element | Document = document): {
  elements: HTMLElement[];
  metadata: ScannedFieldMetadata[];
} {
  const elements: HTMLElement[] = [];
  const metadata: ScannedFieldMetadata[] = [];
  const seenRadioGroups = new Set<string>();

  function recursiveScan(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      // If it is an input, select, textarea, or a custom input role (radio, checkbox, listbox)
      const role = el.getAttribute('role');
      const isCustomInput = role === 'radio' || role === 'checkbox' || role === 'listbox';
      const isRichTextField =
        (el.isContentEditable && el.getAttribute('contenteditable') !== 'false') ||
        (role === 'textbox' && !(el instanceof HTMLInputElement));

      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        isCustomInput ||
        isRichTextField
      ) {
        // Exclude hidden fields and submit buttons
        let type = el instanceof HTMLInputElement ? el.type : (role || el.tagName.toLowerCase());
        if (isRichTextField) {
          type = el.isContentEditable ? 'contenteditable' : 'textbox';
        }
        const shouldExclude =
          type === 'hidden' ||
          type === 'submit' ||
          type === 'button' ||
          type === 'image' ||
          type === 'reset' ||
          el.hasAttribute('disabled') ||
          el.getAttribute('aria-disabled') === 'true' ||
          ('readOnly' in el && (el as any).readOnly) ||
          (isRichTextField &&
            !el.closest('form, [role="form"], main, [class*="application"], [class*="apply"]') &&
            el === document.body);

        if (!shouldExclude) {
          if (el instanceof HTMLInputElement && type === 'radio' && el.name) {
            if (seenRadioGroups.has(el.name)) {
              return;
            }
            seenRadioGroups.add(el.name);
          }

          elements.push(el);

          const scanId =
            el.getAttribute('data-autofill-scan-id') ||
            (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
          el.setAttribute('data-autofill-scan-id', scanId);

          const isRadioGroup =
            el instanceof HTMLInputElement && type === 'radio' && Boolean(el.name);
          const isCombobox = isComboboxInput(el);
          const isSelect = el instanceof HTMLSelectElement;

          const label = isRadioGroup
            ? findRadioGroupLabel(el as HTMLInputElement)
            : findLabel(el);
          const surrounding = getSurroundingContext(el);

          let controlKind: ScannedFieldMetadata['controlKind'] = 'standard';
          if (isRadioGroup) controlKind = 'radio-group';
          else if (isSelect) controlKind = 'select';
          else if (isCombobox) controlKind = 'combobox';

          el.setAttribute('data-autofill-control-kind', controlKind);

          metadata.push({
            scanId,
            type: isRadioGroup ? 'radio-group' : type,
            label,
            placeholder: el.getAttribute('placeholder') || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            htmlId: el.id || '',
            htmlName: el.getAttribute('name') || '',
            surroundingText: surrounding,
            autocomplete: el.getAttribute('autocomplete') || '',
            controlKind,
            groupName: isRadioGroup ? (el as HTMLInputElement).name : undefined,
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

function findLabel(input: HTMLElement): string {
  // For custom elements, fallback to data-value, aria-label, or textContent
  const role = input.getAttribute('role');
  if (role === 'radio' || role === 'checkbox') {
    const dataVal = input.getAttribute('data-value');
    if (dataVal && dataVal.trim()) return dataVal.trim();
    
    const ariaLabelVal = input.getAttribute('aria-label');
    if (ariaLabelVal && ariaLabelVal.trim()) return ariaLabelVal.trim();
    
    if (input.textContent && input.textContent.trim()) {
      return input.textContent.trim();
    }
  }

  // 1. Aria attributes
  let ariaLabel = input.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  let ariaLabelledBy = input.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const rootNode = input.getRootNode() as Document | DocumentFragment;
    const ids = ariaLabelledBy.split(/\s+/).filter(Boolean);
    const labelParts = ids.map(id => rootNode.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (labelParts.length > 0) {
      const combinedText = labelParts.map(el => el.textContent?.trim()).filter(Boolean).join(' ');
      if (combinedText && combinedText.trim()) return combinedText.trim();
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

  // 4. Question label in field wrapper (common on modern apply forms)
  const wrapper = input.closest(
    '[class*="field"], [class*="question"], [class*="FormField"], fieldset, li, form > div, section > div'
  );
  if (wrapper) {
    const directLabel = wrapper.querySelector(
      ':scope > label, :scope > p, :scope > span, :scope > h3, :scope > h4, :scope > legend'
    );
    if (directLabel && !directLabel.contains(input)) {
      const wrapperLabel = directLabel.textContent?.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
      if (wrapperLabel && wrapperLabel.length >= 5 && wrapperLabel.length <= 200) {
        return wrapperLabel;
      }
    }
  }

  // 5. Preceding sibling label or text
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

  // 6. Table row label (common in ATS / CRM forms)
  const row = input.closest('tr');
  if (row) {
    const headerCell = row.querySelector('th, td.label, td:first-child');
    if (headerCell && !headerCell.contains(input) && headerCell.textContent?.trim()) {
      const rowLabel = headerCell.textContent.replace(/\*/g, '').trim();
      if (rowLabel.length > 0 && rowLabel.length < 120) {
        return rowLabel;
      }
    }
  }

  // 7. Fieldset legend
  const fieldset = input.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend?.textContent?.trim()) {
      return legend.textContent.replace(/\*/g, '').trim();
    }
  }

  // 8. Parent wrapper text search (common in React/SPA design systems)
  const cell = input.closest('div, td, li, p, section');
  if (cell) {
    const labelCandidates = cell.querySelectorAll('label, span, p, b, strong, h1, h2, h3, h4, h5, h6');
    for (let i = 0; i < labelCandidates.length; i++) {
      const textNode = labelCandidates[i] as HTMLElement;
      if (textNode === input || textNode.contains(input)) continue;
      const text = textNode.textContent?.replace(/\*/g, '').trim();
      if (text && text.length >= 2 && text.length <= 80) {
        return text;
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

// Helper to find login fields (username and password)
export function findLoginFields(): { username: HTMLInputElement | null; password: HTMLInputElement | null } {
  const password = document.querySelector('input[type="password"]') as HTMLInputElement;
  if (!password) return { username: null, password: null };
  
  const form = password.closest('form');
  let username: HTMLInputElement | null = null;
  
  if (form) {
    username = form.querySelector('input[type="email"], input[type="text"]:not([type="password"])') as HTMLInputElement;
  }
  
  if (!username) {
    const inputs = Array.from(document.querySelectorAll('input'));
    const passIdx = inputs.indexOf(password);
    if (passIdx > 0) {
      for (let i = passIdx - 1; i >= 0; i--) {
        const input = inputs[i];
        if (input.type === 'text' || input.type === 'email') {
          username = input;
          break;
        }
      }
    }
  }
  
  return { username, password };
}

function isComboboxInput(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  const type = el.type.toLowerCase();
  if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'file') {
    return false;
  }
  const role = el.getAttribute('role');
  if (role === 'combobox') return true;
  if (el.getAttribute('aria-autocomplete') === 'list') return true;
  if (el.getAttribute('aria-haspopup') === 'listbox') return true;
  if (el.hasAttribute('list')) return true;
  const cls = (el.className || '').toString().toLowerCase();
  return (
    cls.includes('autocomplete') ||
    cls.includes('typeahead') ||
    cls.includes('select2') ||
    cls.includes('react-select') ||
    cls.includes('awesomplete')
  );
}

function findRadioGroupLabel(radio: HTMLInputElement): string {
  const fieldset = radio.closest('fieldset');
  const legend = fieldset?.querySelector('legend')?.textContent?.replace(/\*/g, '').trim();
  if (legend) return legend;

  const radioGroup = radio.closest('[role="radiogroup"]');
  const labelledBy = radioGroup?.getAttribute('aria-labelledby');
  if (labelledBy) {
    const root = radio.getRootNode() as Document | DocumentFragment;
    const labelEl = root.getElementById(labelledBy);
    if (labelEl?.textContent?.trim()) {
      return labelEl.textContent.replace(/\*/g, '').trim();
    }
  }

  const container = radio.closest('.form-group, tr, li, div, section, td');
  if (container) {
    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, select, textarea, label, button').forEach((n) => n.remove());
    const text = clone.textContent?.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    if (text && text.length >= 3 && text.length <= 120) {
      return text;
    }
  }

  return findLabel(radio);
}
