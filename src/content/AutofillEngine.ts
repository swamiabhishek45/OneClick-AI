import {
  fillDatalistInput,
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

export function fillRadioGroup(groupName: string, value: string): boolean {
  if (!groupName || !value) return false;
  const radios = Array.from(
    document.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`)
  ) as HTMLInputElement[];
  if (radios.length === 0) return false;

  const profileVal = String(value).toLowerCase().trim();
  let filled = false;

  for (const radio of radios) {
    const elVal = String(radio.value).toLowerCase().trim();
    const labelText =
      radio.closest('label')?.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
    const ariaLabel = (radio.getAttribute('aria-label') || '').toLowerCase().trim();

    let shouldCheck =
      elVal === profileVal ||
      labelText === profileVal ||
      labelText.includes(profileVal) ||
      profileVal.includes(elVal) ||
      ariaLabel.includes(profileVal) ||
      scoreOptionMatch(labelText || elVal || ariaLabel, value) >= 0.88;

    if (!shouldCheck && isTruthy(profileVal) && (elVal === 'yes' || labelText.includes('yes'))) {
      shouldCheck = true;
    }
    if (!shouldCheck && isFalsey(profileVal) && (elVal === 'no' || labelText.includes('no'))) {
      shouldCheck = true;
    }

    if (shouldCheck && !radio.checked) {
      setReactValue(radio, true, 'checked');
      filled = true;
    }
  }

  return filled;
}

function fillNativeSelect(element: HTMLSelectElement, value: string): boolean {
  const targetVal = value.toLowerCase().trim();
  let matchedOptionValue = '';
  let bestScore = 0.42;

  for (let i = 0; i < element.options.length; i++) {
    const opt = element.options[i];
    const optVal = opt.value.toLowerCase().trim();
    const optText = opt.text.toLowerCase().trim();
    if (!optVal && !optText) continue;
    if (optText.includes('none') && optVal === '') continue;
    if (optText.includes('select') && optVal === '') continue;

    const score = Math.max(scoreOptionMatch(optText, value), scoreOptionMatch(optVal, value));
    if (score > bestScore) {
      bestScore = score;
      matchedOptionValue = opt.value;
    }
  }

  if (!matchedOptionValue && bestScore <= 0.42) return false;
  setReactValue(element, matchedOptionValue, 'value');
  return true;
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

async function fillCustomListbox(element: HTMLElement, value: string): Promise<boolean> {
  element.click();
  await sleep(200);
  const options = queryDropdownOptions(element);
  const best = pickBestOption(options, value);
  if (best) {
    best.click();
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
    if (type === 'checkbox') return !element.checked;
    if (type === 'file') return !element.files || element.files.length === 0;
    if (type === 'hidden') return true;
    return element.value.trim().length === 0;
  }
  if (element instanceof HTMLTextAreaElement) {
    return element.value.trim().length === 0;
  }
  if (element instanceof HTMLSelectElement) {
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
  if (role === 'checkbox' || role === 'radio') {
    return element.getAttribute('aria-checked') !== 'true';
  }
  return controlKind === 'combobox';
}

export function fillField(element: HTMLElement, value: string): boolean {
  try {
    const controlKind = element.getAttribute('data-autofill-control-kind');

    if (controlKind === 'radio-group' && element instanceof HTMLInputElement) {
      return fillRadioGroup(element.name, value);
    }

    if (element instanceof HTMLInputElement) {
      const type = element.type;

      if (type === 'checkbox') {
        const optionVal = (
          element.value ||
          element.closest('label')?.textContent ||
          ''
        )
          .toLowerCase()
          .trim();
        const profileVal = String(value).toLowerCase().trim();
        const items = profileVal.split(',').map((s) => s.trim());

        let targetChecked =
          isTruthy(value) ||
          optionVal === profileVal ||
          items.some((item) => item && (optionVal.includes(item) || item.includes(optionVal)));

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
      const items = profileVal.split(',').map((s) => s.trim().toLowerCase());
      let shouldSelect =
        optionVal === profileVal ||
        items.includes(optionVal) ||
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

  const role = element.getAttribute('role');
  if (role === 'listbox' || role === 'combobox') {
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
    if (kind === 'combobox' || item.element.getAttribute('role') === 'listbox') {
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
