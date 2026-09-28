import { ScannedFieldMetadata } from '../shared/ai';

export function scanFormFields(root: Element | Document = document): {
  elements: HTMLElement[];
  metadata: ScannedFieldMetadata[];
} {
  const elements: HTMLElement[] = [];
  const metadata: ScannedFieldMetadata[] = [];
  const seenRadioGroups = new Set<string>();
  const seenCheckboxGroups = new Set<string>();
  const seenAriaRadioGroups = new Set<string>();
  const seenAriaCheckboxGroups = new Set<string>();

  function recursiveScan(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      const role = el.getAttribute('role');

      if (role === 'radiogroup') {
        const groupKey =
          el.id ||
          el.getAttribute('aria-labelledby') ||
          el.getAttribute('name') ||
          hashGroupKey(el.textContent?.slice(0, 80) || '');
        if (!seenAriaRadioGroups.has(groupKey)) {
          seenAriaRadioGroups.add(groupKey);
          registerField(el, {
            type: 'radio-group',
            controlKind: 'radio-group',
            groupName: `aria:${groupKey}`,
            label: findAriaGroupLabel(el),
            optionLabels: collectAriaRadioOptions(el),
          });
        }
      }

      if (role === 'group' && el.querySelector('[role="checkbox"]')) {
        const boxes = el.querySelectorAll('[role="checkbox"]');
        if (boxes.length > 1) {
          const groupKey =
            el.id ||
            el.getAttribute('aria-labelledby') ||
            hashGroupKey(findAriaGroupLabel(el));
          if (!seenAriaCheckboxGroups.has(groupKey)) {
            seenAriaCheckboxGroups.add(groupKey);
            registerField(el, {
              type: 'checkbox-group',
              controlKind: 'checkbox-group',
              groupName: `aria-cb:${groupKey}`,
              label: findAriaGroupLabel(el),
              optionLabels: collectAriaCheckboxOptions(el),
            });
          }
        }
      }

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

          if (el instanceof HTMLInputElement && type === 'checkbox') {
            const cbGroupKey = resolveNativeCheckboxGroupKey(el);
            if (cbGroupKey) {
              if (seenCheckboxGroups.has(cbGroupKey)) {
                return;
              }
              seenCheckboxGroups.add(cbGroupKey);
              tagNativeCheckboxGroup(cbGroupKey, el);
            }
          }

          if (role === 'radio' && el.closest('[role="radiogroup"]')) {
            return;
          }
          if (role === 'checkbox' && el.closest('[role="group"]')) {
            const grp = el.closest('[role="group"]');
            if (grp && grp.querySelectorAll('[role="checkbox"]').length > 1) {
              return;
            }
          }

          const isRadioGroup =
            el instanceof HTMLInputElement && type === 'radio' && Boolean(el.name);
          const checkboxGroupKey =
            el instanceof HTMLInputElement && type === 'checkbox'
              ? el.getAttribute('data-autofill-checkbox-group')
              : null;
          const isCheckboxGroup = Boolean(checkboxGroupKey);
          const isCombobox = isComboboxInput(el);
          const isSelect = el instanceof HTMLSelectElement;

          const label = isRadioGroup
            ? findRadioGroupLabel(el as HTMLInputElement)
            : isCheckboxGroup
              ? findCheckboxGroupLabel(el as HTMLInputElement, checkboxGroupKey!)
              : type === 'file'
                ? findFileInputLabel(el as HTMLInputElement)
                : findLabel(el);
          const surrounding = getSurroundingContext(el);

          let controlKind: ScannedFieldMetadata['controlKind'] = 'standard';
          if (isRadioGroup) controlKind = 'radio-group';
          else if (isCheckboxGroup) controlKind = 'checkbox-group';
          else if (isSelect) controlKind = 'select';
          else if (isCombobox) controlKind = 'combobox';

          let optionLabels: string[] | undefined;
          if (isRadioGroup) {
            optionLabels = collectNativeRadioOptions((el as HTMLInputElement).name);
          } else if (isCheckboxGroup && checkboxGroupKey) {
            optionLabels = collectNativeCheckboxOptions(checkboxGroupKey);
          } else if (isSelect) {
            optionLabels = collectSelectOptions(el as HTMLSelectElement);
          }

          registerField(el, {
            type: isRadioGroup
              ? 'radio-group'
              : isCheckboxGroup
                ? 'checkbox-group'
                : type,
            controlKind,
            groupName: isRadioGroup
              ? (el as HTMLInputElement).name
              : isCheckboxGroup
                ? checkboxGroupKey!
                : undefined,
            label,
            surroundingText: surrounding,
            optionLabels,
            placeholder: el.getAttribute('placeholder') || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            htmlId: el.id || '',
            htmlName: el.getAttribute('name') || '',
            autocomplete: el.getAttribute('autocomplete') || '',
          });
        }
      }

      const children = el.childNodes;
      for (let i = 0; i < children.length; i++) {
        recursiveScan(children[i]);
      }

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

  function registerField(
    el: HTMLElement,
    info: {
      type: string;
      controlKind: ScannedFieldMetadata['controlKind'];
      groupName?: string;
      label: string;
      surroundingText?: string;
      optionLabels?: string[];
      placeholder?: string;
      ariaLabel?: string;
      htmlId?: string;
      htmlName?: string;
      autocomplete?: string;
    }
  ) {
    elements.push(el);

    const scanId =
      el.getAttribute('data-autofill-scan-id') ||
      (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
    el.setAttribute('data-autofill-scan-id', scanId);
    el.setAttribute('data-autofill-control-kind', info.controlKind || 'standard');
    if (info.groupName) {
      el.setAttribute('data-autofill-group-name', info.groupName);
    }

    metadata.push({
      scanId,
      type: info.type,
      label: info.label,
      placeholder: info.placeholder || '',
      ariaLabel: info.ariaLabel || '',
      htmlId: info.htmlId || el.id || '',
      htmlName: info.htmlName || el.getAttribute('name') || '',
      surroundingText: info.surroundingText || getSurroundingContext(el),
      autocomplete: info.autocomplete || el.getAttribute('autocomplete') || '',
      controlKind: info.controlKind,
      groupName: info.groupName,
      optionLabels: info.optionLabels,
      inputAccept:
        el instanceof HTMLInputElement && el.type === 'file'
          ? el.getAttribute('accept') || ''
          : undefined,
    });
  }

  recursiveScan(root);
  return { elements, metadata };
}

function hashGroupKey(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim().slice(0, 64);
  return t || Math.random().toString(36).slice(2, 10);
}

function resolveNativeCheckboxGroupKey(cb: HTMLInputElement): string | null {
  const name = cb.name;
  if (name) {
    const all = document.querySelectorAll(
      `input[type="checkbox"][name="${CSS.escape(name)}"]`
    );
    if (all.length > 1) return `cb-name:${name}`;
  }

  const fieldset = cb.closest('fieldset');
  if (fieldset) {
    const boxes = fieldset.querySelectorAll('input[type="checkbox"]');
    if (boxes.length > 1) {
      const legend = fieldset.querySelector('legend')?.textContent?.trim().slice(0, 60) || '';
      return `cb-fs:${fieldset.id || hashGroupKey(legend)}`;
    }
  }

  const group = cb.closest(
    '[role="group"], [class*="checkbox-group" i], [class*="CheckboxGroup" i], [data-checkbox-group]'
  );
  if (group) {
    const boxes = group.querySelectorAll('input[type="checkbox"]');
    if (boxes.length > 1) {
      const label =
        group.getAttribute('aria-label') ||
        group.getAttribute('data-checkbox-group') ||
        group.id ||
        '';
      return `cb-grp:${hashGroupKey(label || group.textContent?.slice(0, 40) || '')}`;
    }
  }

  return null;
}

function tagNativeCheckboxGroup(groupKey: string, representative: HTMLInputElement) {
  let selector = '';
  if (groupKey.startsWith('cb-name:')) {
    const name = groupKey.slice('cb-name:'.length);
    selector = `input[type="checkbox"][name="${CSS.escape(name)}"]`;
  } else if (groupKey.startsWith('cb-fs:')) {
    const fieldset = representative.closest('fieldset');
    if (fieldset) {
      fieldset.querySelectorAll('input[type="checkbox"]').forEach((el) => {
        el.setAttribute('data-autofill-checkbox-group', groupKey);
      });
    }
    return;
  } else if (groupKey.startsWith('cb-grp:')) {
    const group = representative.closest(
      '[role="group"], [class*="checkbox-group" i], [class*="CheckboxGroup" i], [data-checkbox-group]'
    );
    if (group) {
      group.querySelectorAll('input[type="checkbox"]').forEach((el) => {
        el.setAttribute('data-autofill-checkbox-group', groupKey);
      });
    }
    return;
  }

  if (selector) {
    document.querySelectorAll(selector).forEach((el) => {
      el.setAttribute('data-autofill-checkbox-group', groupKey);
    });
  }
  representative.setAttribute('data-autofill-checkbox-group', groupKey);
}

function getInputOptionLabel(input: HTMLInputElement): string {
  if (input.id) {
    const root = input.getRootNode() as Document | DocumentFragment;
    const labelEl = root.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (labelEl?.textContent?.trim()) {
      return labelEl.textContent.replace(/\s+/g, ' ').trim();
    }
  }
  const wrapLabel = input.closest('label')?.textContent?.replace(/\s+/g, ' ').trim();
  if (wrapLabel) return wrapLabel;
  return input.value?.trim() || input.getAttribute('aria-label')?.trim() || '';
}

function collectNativeRadioOptions(groupName: string): string[] {
  const radios = document.querySelectorAll(
    `input[type="radio"][name="${CSS.escape(groupName)}"]`
  ) as NodeListOf<HTMLInputElement>;
  return [...radios].map(getInputOptionLabel).filter(Boolean);
}

function collectNativeCheckboxOptions(groupKey: string): string[] {
  const boxes = document.querySelectorAll(
    `input[type="checkbox"][data-autofill-checkbox-group="${CSS.escape(groupKey)}"]`
  ) as NodeListOf<HTMLInputElement>;
  return [...boxes].map(getInputOptionLabel).filter(Boolean);
}

function collectSelectOptions(select: HTMLSelectElement): string[] {
  const labels: string[] = [];
  for (let i = 0; i < select.options.length; i++) {
    const opt = select.options[i];
    const text = opt.text?.trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    if (lower.includes('select') || lower.includes('choose') || lower === 'none') continue;
    labels.push(text);
  }
  return labels;
}

function findCheckboxGroupLabel(representative: HTMLInputElement, groupKey: string): string {
  const fieldset = representative.closest('fieldset');
  const legend = fieldset?.querySelector('legend')?.textContent?.replace(/\*/g, '').trim();
  if (legend) return legend;

  const group = representative.closest('[role="group"]');
  const labelledBy = group?.getAttribute('aria-labelledby');
  if (labelledBy) {
    const root = representative.getRootNode() as Document | DocumentFragment;
    const labelEl = root.getElementById(labelledBy);
    if (labelEl?.textContent?.trim()) {
      return labelEl.textContent.replace(/\*/g, '').trim();
    }
  }

  const container = representative.closest('.form-group, tr, li, div, section, td');
  if (container) {
    const clone = container.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('input, select, textarea, label, button, [role="checkbox"]')
      .forEach((n) => n.remove());
    const text = clone.textContent?.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    if (text && text.length >= 3 && text.length <= 160) {
      return text;
    }
  }

  if (groupKey.startsWith('cb-name:')) {
    return findLabel(representative);
  }

  return findLabel(representative);
}

function findAriaGroupLabel(groupEl: HTMLElement): string {
  const labelledBy = groupEl.getAttribute('aria-labelledby');
  if (labelledBy) {
    const root = groupEl.getRootNode() as Document | DocumentFragment;
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => root.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(' ').replace(/\*/g, '').trim();
  }
  const ariaLabel = groupEl.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;
  return getSurroundingContext(groupEl).slice(0, 120);
}

function collectAriaRadioOptions(groupEl: HTMLElement): string[] {
  return [...groupEl.querySelectorAll('[role="radio"]')]
    .map((el) => getCustomRoleOptionText(el as HTMLElement))
    .filter(Boolean);
}

function collectAriaCheckboxOptions(groupEl: HTMLElement): string[] {
  return [...groupEl.querySelectorAll('[role="checkbox"]')]
    .map((el) => getCustomRoleOptionText(el as HTMLElement))
    .filter(Boolean);
}

function getCustomRoleOptionText(el: HTMLElement): string {
  return (
    el.getAttribute('aria-label') ||
    el.getAttribute('data-value') ||
    el.textContent?.replace(/\s+/g, ' ').trim() ||
    ''
  );
}

function findFileInputLabel(input: HTMLInputElement): string {
  const fromLabel = findLabel(input);
  if (fromLabel.trim()) return fromLabel;

  const container = input.closest(
    'div, fieldset, li, td, section, form, [class*="field"], [class*="question"], [class*="attachment"]'
  );
  if (container) {
    const trigger = container.querySelector(
      'button, a, [role="button"], label, span, p'
    ) as HTMLElement | null;
    if (trigger && !trigger.contains(input) && trigger !== input) {
      const text = trigger.textContent?.replace(/\s+/g, ' ').trim();
      if (text && text.length >= 4 && text.length <= 120) {
        return text;
      }
    }
  }

  return fromLabel;
}

function findLabel(input: HTMLElement): string {
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

  let ariaLabel = input.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  let ariaLabelledBy = input.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const rootNode = input.getRootNode() as Document | DocumentFragment;
    const ids = ariaLabelledBy.split(/\s+/).filter(Boolean);
    const labelParts = ids
      .map((id) => rootNode.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (labelParts.length > 0) {
      const combinedText = labelParts.map((el) => el.textContent?.trim()).filter(Boolean).join(' ');
      if (combinedText && combinedText.trim()) return combinedText.trim();
    }
  }

  const id = input.id;
  if (id) {
    const rootNode = input.getRootNode() as Document | DocumentFragment;
    const labelEl = rootNode.querySelector(`label[for="${id}"]`);
    if (labelEl && labelEl.textContent && labelEl.textContent.trim()) {
      return labelEl.textContent.trim();
    }
  }

  let parent = input.parentElement;
  while (parent) {
    if (parent.tagName.toLowerCase() === 'label') {
      const clone = parent.cloneNode(true) as HTMLElement;
      const innerInputs = clone.querySelectorAll('input, select, textarea');
      innerInputs.forEach((el) => el.remove());
      const labelText = clone.textContent?.trim();
      if (labelText) return labelText;
    }
    parent = parent.parentElement;
  }

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

  let prev = input.previousElementSibling;
  if (prev) {
    if (prev.tagName.toLowerCase() === 'label' && prev.textContent && prev.textContent.trim()) {
      return prev.textContent.trim();
    }
    if (prev.classList.contains('label') || prev.classList.contains('field-label')) {
      if (prev.textContent && prev.textContent.trim()) return prev.textContent.trim();
    }
  }

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

  const fieldset = input.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend?.textContent?.trim()) {
      return legend.textContent.replace(/\*/g, '').trim();
    }
  }

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
    const text = container.textContent || '';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length > 150 ? cleaned.substring(0, 150) + '...' : cleaned;
  }
  return '';
}

export function findLoginFields(): { username: HTMLInputElement | null; password: HTMLInputElement | null } {
  const password = document.querySelector('input[type="password"]') as HTMLInputElement;
  if (!password) return { username: null, password: null };

  const form = password.closest('form');
  let username: HTMLInputElement | null = null;

  if (form) {
    username = form.querySelector(
      'input[type="email"], input[type="text"]:not([type="password"])'
    ) as HTMLInputElement;
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
