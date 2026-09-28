import {
  fillDatalistInput,
  parseMultiSelectValue,
  pickBestOption,
  queryDropdownOptions,
  scoreOptionMatch,
  sleep,
} from './DropdownController';

function isTruthy(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on' || s === 'checked';
}

function isFalsey(val: unknown): boolean {
  if (typeof val === 'boolean') return !val;
  const s = String(val).toLowerCase().trim();
  return s === 'false' || s === '0' || s === 'no' || s === 'n' || s === 'off' || s === 'unchecked';
}

function setFileInputValue(
  element: HTMLInputElement,
  base64Data: string,
  fileName: string,
  fileType: string
): boolean {
  try {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type:
        fileType === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const file = new File([blob], fileName, { type: blob.type });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    element.files = dataTransfer.files;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch (err) {
    console.error('Failed to set file input value programmatically:', err);
    return false;
  }
}

function getCustomOptionValue(element: HTMLElement): string {
  const dataVal = element.getAttribute('data-value');
  if (dataVal) return dataVal.trim();
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  if (element.textContent) return element.textContent.trim();
  return '';
}

function getRadioOptionText(radio: HTMLInputElement): string {
  if (radio.id) {
    const root = radio.getRootNode() as Document | DocumentFragment;
    const labelEl = root.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
    if (labelEl?.textContent?.trim()) {
      return labelEl.textContent.replace(/\s+/g, ' ').trim();
    }
  }
  const wrap = radio.closest('label')?.textContent?.replace(/\s+/g, ' ').trim();
  if (wrap) return wrap;
  return radio.value?.trim() || radio.getAttribute('aria-label')?.trim() || '';
}

function getCheckboxOptionText(checkbox: HTMLInputElement): string {
  return getRadioOptionText(checkbox);
}

function activateRadioInput(radio: HTMLInputElement): void {
  const root = radio.getRootNode() as Document | DocumentFragment;
  const label =
    (radio.id ? root.querySelector(`label[for="${CSS.escape(radio.id)}"]`) : null) ||
    radio.closest('label');
  if (label instanceof HTMLElement) {
    label.click();
    return;
  }
  radio.click();
  if (!radio.checked) {
    setReactValue(radio, true, 'checked');
  }
}

function scoreRadioOption(radio: HTMLInputElement, value: string): number {
  const labelText = getRadioOptionText(radio);
  const elVal = radio.value?.trim() || '';
  const ariaLabel = radio.getAttribute('aria-label')?.trim() || '';
  const profileVal = String(value).toLowerCase().trim();

  let score = Math.max(
    scoreOptionMatch(labelText, value),
    scoreOptionMatch(elVal, value),
    scoreOptionMatch(ariaLabel, value)
  );

  if (isTruthy(profileVal) && (elVal.toLowerCase() === 'yes' || labelText.toLowerCase().includes('yes'))) {
    score = Math.max(score, 0.9);
  }
  if (isFalsey(profileVal) && (elVal.toLowerCase() === 'no' || labelText.toLowerCase().includes('no'))) {
    score = Math.max(score, 0.9);
  }

  return score;
}

export function fillRadioGroup(groupName: string, value: string): boolean {
  if (!groupName || !value) return false;
  const radios = Array.from(
    document.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`)
  ) as HTMLInputElement[];
  if (radios.length === 0) return false;

  let bestRadio: HTMLInputElement | null = null;
  let bestScore = 0.45;

  for (const radio of radios) {
    const score = scoreRadioOption(radio, value);
    if (score > bestScore) {
      bestScore = score;
      bestRadio = radio;
    }
  }

  if (!bestRadio || bestRadio.checked) {
    return Boolean(bestRadio?.checked);
  }

  activateRadioInput(bestRadio);
  return true;
}

function fillAriaRadioGroup(container: HTMLElement, value: string): boolean {
  const options = Array.from(container.querySelectorAll('[role="radio"]')) as HTMLElement[];
  if (options.length === 0) return false;

  let best: HTMLElement | null = null;
  let bestScore = 0.45;
  for (const opt of options) {
    const text = getCustomOptionValue(opt);
    const score = scoreOptionMatch(text, value);
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }

  if (!best) return false;
  if (best.getAttribute('aria-checked') !== 'true') {
    best.click();
  }
  return true;
}

export function fillCheckboxGroup(groupKey: string, value: string): boolean {
  if (!groupKey || !value) return false;

  const targets = parseMultiSelectValue(value);
  const profileVal = String(value).toLowerCase().trim();
  const checkboxes = Array.from(
    document.querySelectorAll(
      `input[type="checkbox"][data-autofill-checkbox-group="${CSS.escape(groupKey)}"]`
    )
  ) as HTMLInputElement[];

  if (checkboxes.length === 0) return false;

  let changed = false;

  for (const checkbox of checkboxes) {
    const optionText = getCheckboxOptionText(checkbox);
    const optionVal = (checkbox.value || optionText).toLowerCase().trim();

    let shouldCheck =
      targets.length > 0 &&
      targets.some(
        (t) =>
          scoreOptionMatch(optionText, t) >= 0.55 ||
          scoreOptionMatch(optionVal, t) >= 0.55 ||
          optionVal === t.toLowerCase()
      );

    if (!shouldCheck && targets.length === 0) {
      shouldCheck =
        isTruthy(value) ||
        optionVal === profileVal ||
        scoreOptionMatch(optionText, value) >= 0.88;
    }

    if (shouldCheck !== checkbox.checked) {
      const root = checkbox.getRootNode() as Document | DocumentFragment;
      const label =
        (checkbox.id ? root.querySelector(`label[for="${CSS.escape(checkbox.id)}"]`) : null) ||
        checkbox.closest('label');
      if (label instanceof HTMLElement) {
        label.click();
      } else {
        setReactValue(checkbox, shouldCheck, 'checked');
      }
      changed = true;
    }
  }

  return changed || checkboxes.some((cb) => cb.checked);
}

function fillAriaCheckboxGroup(container: HTMLElement, value: string): boolean {
  const options = Array.from(container.querySelectorAll('[role="checkbox"]')) as HTMLElement[];
  if (options.length === 0) return false;

  const targets = parseMultiSelectValue(value);
  let changed = false;

  for (const opt of options) {
    const optionText = getCustomOptionValue(opt);
    const shouldCheck =
      targets.length > 0
        ? targets.some((t) => scoreOptionMatch(optionText, t) >= 0.55)
        : isTruthy(value) || scoreOptionMatch(optionText, value) >= 0.88;

    const isChecked = opt.getAttribute('aria-checked') === 'true';
    if (shouldCheck !== isChecked) {
      opt.click();
      changed = true;
    }
  }

  return changed || options.some((o) => o.getAttribute('aria-checked') === 'true');
}

function fillNativeSelect(element: HTMLSelectElement, value: string): boolean {
  if (element.multiple) {
    return fillNativeMultiSelect(element, value);
  }

  let matchedOptionValue = '';
  let bestScore = 0.4;

  for (let i = 0; i < element.options.length; i++) {
    const opt = element.options[i];
    const optVal = opt.value.trim();
    const optText = opt.text.trim();
    if (!optVal && !optText) continue;
    const lower = optText.toLowerCase();
    if ((lower.includes('none') || lower.includes('select') || lower.includes('choose')) && !optVal) {
      continue;
    }

    const score = Math.max(scoreOptionMatch(optText, value), scoreOptionMatch(optVal, value));
    if (score > bestScore) {
      bestScore = score;
      matchedOptionValue = opt.value;
    }
  }

  if (!matchedOptionValue && bestScore <= 0.4) return false;
  setReactValue(element, matchedOptionValue, 'value');
  return true;
}

function fillNativeMultiSelect(element: HTMLSelectElement, value: string): boolean {
  const targets = parseMultiSelectValue(value);
  if (targets.length === 0) return false;

  let changed = false;
  for (let i = 0; i < element.options.length; i++) {
    const opt = element.options[i];
    const optText = opt.text.trim();
    const optVal = opt.value.trim();
    const shouldSelect = targets.some(
      (t) =>
        scoreOptionMatch(optText, t) >= 0.55 ||
        scoreOptionMatch(optVal, t) >= 0.55
    );
    if (opt.selected !== shouldSelect) {
      opt.selected = shouldSelect;
      changed = true;
    }
  }

  if (changed) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return changed || [...element.selectedOptions].length > 0;
}

async function typeIntoInput(input: HTMLInputElement, value: string): Promise<void> {
  input.focus();
  input.click();
  setReactValue(input, '', 'value');
  await sleep(40);
  setReactValue(input, value, 'value');
  input.dispatchEvent(
    new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value })
  );
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function fillComboboxInput(input: HTMLInputElement, value: string): Promise<boolean> {
  if (input.hasAttribute('list')) {
    return fillDatalistInput(input, value);
  }

  await typeIntoInput(input, value);
  await sleep(350);

  let options = queryDropdownOptions(input);
  let best = pickBestOption(options, value);

  if (!best && value.length > 8) {
    const shortQuery = value.split(/[\s,]+/).slice(0, 3).join(' ');
    if (shortQuery.length >= 4 && shortQuery !== value) {
      await typeIntoInput(input, shortQuery);
      await sleep(400);
      options = queryDropdownOptions(input);
      best = pickBestOption(options, value);
    }
  }

  if (best) {
    best.scrollIntoView({ block: 'nearest' });
    best.click();
    await sleep(80);
    return true;
  }

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await sleep(80);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return input.value.trim().length > 0;
}

async function openSelectTrigger(element: HTMLElement): Promise<HTMLElement> {
  if (element instanceof HTMLSelectElement) return element;

  const trigger =
    element.closest('[role="combobox"]') ||
    element.querySelector('[role="combobox"]') ||
    element;

  if (trigger instanceof HTMLElement) {
    trigger.focus();
    trigger.click();
    await sleep(220);
  }
  return trigger instanceof HTMLElement ? trigger : element;
}

async function fillCustomListbox(element: HTMLElement, value: string): Promise<boolean> {
  const anchor = await openSelectTrigger(element);
  let options = queryDropdownOptions(anchor);
  let best = pickBestOption(options, value);

  if (!best) {
    anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await sleep(120);
    options = queryDropdownOptions(anchor);
    best = pickBestOption(options, value);
  }

  if (best) {
    best.scrollIntoView({ block: 'nearest' });
    best.click();
    await sleep(80);
    return true;
  }
  return false;
}

export function isFieldEmpty(element: HTMLElement): boolean {
  const controlKind = element.getAttribute('data-autofill-control-kind');

  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (type === 'radio') {
      const name = element.name;
      if (name) {
        const checked = document.querySelector(
          `input[type="radio"][name="${CSS.escape(name)}"]:checked`
        );
        return !checked;
      }
      return !element.checked;
    }
    if (type === 'checkbox') {
      const groupKey = element.getAttribute('data-autofill-checkbox-group');
      if (groupKey && controlKind === 'checkbox-group') {
        const anyChecked = document.querySelector(
          `input[type="checkbox"][data-autofill-checkbox-group="${CSS.escape(groupKey)}"]:checked`
        );
        return !anyChecked;
      }
      return !element.checked;
    }
    if (type === 'file') return !element.files || element.files.length === 0;
    if (type === 'hidden') return true;
    return element.value.trim().length === 0;
  }
  if (element instanceof HTMLTextAreaElement) {
    return element.value.trim().length === 0;
  }
  if (element.isContentEditable || element.getAttribute('role') === 'textbox') {
    const text = (element.innerText || element.textContent || '').trim().toLowerCase();
    return !text || text === 'type here...' || text === 'type here';
  }
  if (element instanceof HTMLSelectElement) {
    if (element.multiple) {
      return element.selectedOptions.length === 0;
    }
    const val = element.value.trim();
    if (!val) return true;
    const selectedText = element.options[element.selectedIndex]?.text?.toLowerCase() || '';
    if (
      selectedText.includes('none') ||
      selectedText.includes('select') ||
      selectedText.includes('choose')
    ) {
      return true;
    }
    return false;
  }
  const role = element.getAttribute('role');
  if (role === 'radiogroup') {
    return !element.querySelector('[role="radio"][aria-checked="true"], input[type="radio"]:checked');
  }
  if (role === 'group' && controlKind === 'checkbox-group') {
    return !element.querySelector('[role="checkbox"][aria-checked="true"], input[type="checkbox"]:checked');
  }
  if (role === 'checkbox' || role === 'radio') {
    return element.getAttribute('aria-checked') !== 'true';
  }
  return controlKind === 'combobox' || controlKind === 'select';
}

export function fillField(element: HTMLElement, value: string): boolean {
  try {
    const controlKind = element.getAttribute('data-autofill-control-kind');

    if (controlKind === 'radio-group') {
      if (element instanceof HTMLInputElement && element.name) {
        return fillRadioGroup(element.name, value);
      }
      if (element.getAttribute('role') === 'radiogroup') {
        return fillAriaRadioGroup(element, value);
      }
      const groupName = element.getAttribute('data-autofill-group-name');
      if (groupName?.startsWith('aria:')) {
        return fillAriaRadioGroup(element, value);
      }
    }

    if (controlKind === 'checkbox-group') {
      const groupKey =
        element.getAttribute('data-autofill-checkbox-group') ||
        element.getAttribute('data-autofill-group-name') ||
        '';
      if (groupKey.startsWith('aria-cb:') || element.getAttribute('role') === 'group') {
        return fillAriaCheckboxGroup(element, value);
      }
      if (groupKey) {
        return fillCheckboxGroup(groupKey, value);
      }
    }

    if (element instanceof HTMLInputElement) {
      const type = element.type;

      if (type === 'checkbox') {
        const optionLabel = getCheckboxOptionText(element);
        const optionVal = (
          element.value ||
          optionLabel ||
          ''
        )
          .toLowerCase()
          .trim();
        const profileVal = String(value).toLowerCase().trim();
        const items = parseMultiSelectValue(value).map((s) => s.toLowerCase());

        let targetChecked =
          isTruthy(value) ||
          optionVal === profileVal ||
          items.some(
            (item) =>
              item &&
              (scoreOptionMatch(optionVal, item) >= 0.55 ||
                scoreOptionMatch(optionLabel, item) >= 0.55)
          );

        if (
          !targetChecked &&
          (profileVal.includes('agree') ||
            profileVal.includes('authorized') ||
            profileVal.includes('consent') ||
            profileVal === 'true')
        ) {
          const label = (element.closest('label')?.textContent || '').toLowerCase();
          if (
            label.includes('agree') ||
            label.includes('authorized') ||
            label.includes('consent') ||
            label.includes('terms')
          ) {
            targetChecked = true;
          }
        }

        if (element.checked !== targetChecked) {
          setReactValue(element, targetChecked, 'checked');
        }
        return true;
      }

      if (type === 'radio') {
        return fillRadioGroup(element.name, value);
      }

      if (type === 'file') {
        try {
          const fileData = JSON.parse(value);
          if (fileData.base64Data && fileData.fileName) {
            return setFileInputValue(element, fileData.base64Data, fileData.fileName, fileData.fileType);
          }
        } catch (e) {
          console.error('AutofillEngine failed to parse serialized file payload:', e);
        }
        return false;
      }

      if (controlKind === 'combobox') {
        return false;
      }

      setReactValue(element, value, 'value');
      return true;
    }

    if (element instanceof HTMLTextAreaElement) {
      setReactValue(element, value, 'value');
      return true;
    }

    if (element.isContentEditable || element.getAttribute('role') === 'textbox') {
      element.focus();
      element.textContent = value;
      element.dispatchEvent(
        new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value })
      );
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    if (element instanceof HTMLSelectElement) {
      return fillNativeSelect(element, value);
    }

    const role = element.getAttribute('role');
    if (role === 'radio') {
      const optionVal = getCustomOptionValue(element).toLowerCase();
      const profileVal = String(value).toLowerCase().trim();
      let shouldSelect = optionVal === profileVal || scoreOptionMatch(optionVal, value) >= 0.88;
      if (!shouldSelect && isTruthy(profileVal)) {
        shouldSelect = optionVal === 'yes' || optionVal === 'true' || optionVal === '1';
      }
      if (shouldSelect && element.getAttribute('aria-checked') !== 'true') {
        element.click();
      }
      return shouldSelect;
    }

    if (role === 'checkbox') {
      const optionVal = getCustomOptionValue(element).toLowerCase();
      const profileVal = String(value).toLowerCase().trim();
      const items = parseMultiSelectValue(value).map((s) => s.toLowerCase());
      let shouldSelect =
        optionVal === profileVal ||
        items.some((item) => scoreOptionMatch(optionVal, item) >= 0.55) ||
        isTruthy(profileVal);
      const isChecked = element.getAttribute('aria-checked') === 'true';
      if (shouldSelect !== isChecked) element.click();
      return shouldSelect;
    }

    if (role === 'listbox' || role === 'combobox') {
      return false;
    }

    return false;
  } catch (error) {
    console.error('AutofillEngine failed to fill field:', error, element);
    return false;
  }
}

export async function fillFieldAsync(element: HTMLElement, value: string): Promise<boolean> {
  const controlKind = element.getAttribute('data-autofill-control-kind');

  if (controlKind === 'combobox' && element instanceof HTMLInputElement) {
    return fillComboboxInput(element, value);
  }

  if (controlKind === 'select' && element instanceof HTMLSelectElement) {
    return fillNativeSelect(element, value);
  }

  const role = element.getAttribute('role');
  if (role === 'listbox' || role === 'combobox') {
    return fillCustomListbox(element, value);
  }

  if (
    element instanceof HTMLButtonElement &&
    (element.getAttribute('aria-haspopup') === 'listbox' ||
      element.getAttribute('aria-haspopup') === 'true')
  ) {
    return fillCustomListbox(element, value);
  }

  return fillField(element, value);
}

function setReactValue(element: HTMLElement, value: unknown, property: 'value' | 'checked') {
  let prototype: object | undefined;
  if (element instanceof HTMLInputElement) {
    prototype = window.HTMLInputElement.prototype;
  } else if (element instanceof HTMLTextAreaElement) {
    prototype = window.HTMLTextAreaElement.prototype;
  } else if (element instanceof HTMLSelectElement) {
    prototype = window.HTMLSelectElement.prototype;
  }

  if (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      (element as HTMLInputElement)[property] = value as never;
    }
  } else {
    (element as HTMLInputElement)[property] = value as never;
  }

  const events = property === 'checked' ? ['click', 'change'] : ['input', 'change'];
  events.forEach((eventName) => {
    element.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true }));
  });
}

export function fillFormFields(mappings: { element: HTMLElement; value: string }[]): number {
  let count = 0;
  for (const item of mappings) {
    if (fillField(item.element, item.value)) count++;
  }
  return count;
}

export async function fillFormFieldsAsync(
  mappings: { element: HTMLElement; value: string; controlKind?: string }[]
): Promise<number> {
  const syncItems: typeof mappings = [];
  const asyncItems: typeof mappings = [];

  for (const item of mappings) {
    const kind =
      item.controlKind || item.element.getAttribute('data-autofill-control-kind') || 'standard';
    const role = item.element.getAttribute('role');
    const isAsyncDropdown =
      kind === 'combobox' ||
      role === 'listbox' ||
      role === 'combobox' ||
      (item.element instanceof HTMLButtonElement &&
        (item.element.getAttribute('aria-haspopup') === 'listbox' ||
          item.element.getAttribute('aria-haspopup') === 'true'));

    if (isAsyncDropdown) {
      asyncItems.push(item);
    } else {
      syncItems.push(item);
    }
  }

  let count = 0;
  for (const item of syncItems) {
    if (fillField(item.element, item.value)) count++;
  }

  for (const item of asyncItems) {
    if (await fillFieldAsync(item.element, item.value)) count++;
    await sleep(120);
  }

  return count;
}
