function isTruthy(val: any): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on' || s === 'checked';
}

function isFalsey(val: any): boolean {
  if (typeof val === 'boolean') return !val;
  const s = String(val).toLowerCase().trim();
  return s === 'false' || s === '0' || s === 'no' || s === 'n' || s === 'off' || s === 'unchecked';
}

export function fillField(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
): boolean {
  try {
    if (element instanceof HTMLInputElement) {
      const type = element.type;

      if (type === 'checkbox') {
        const targetChecked = isTruthy(value) || String(element.value).toLowerCase() === String(value).toLowerCase();
        if (element.checked !== targetChecked) {
          setReactValue(element, targetChecked, 'checked');
        }
      } else if (type === 'radio') {
        const elVal = String(element.value).toLowerCase().trim();
        const profileVal = String(value).toLowerCase().trim();
        
        let shouldCheck = false;
        if (elVal === profileVal) {
          shouldCheck = true;
        } else if (isTruthy(profileVal) && (elVal === 'yes' || elVal === 'true' || elVal === '1' || elVal === 'y')) {
          shouldCheck = true;
        } else if (isFalsey(profileVal) && (elVal === 'no' || elVal === 'false' || elVal === '0' || elVal === 'n')) {
          shouldCheck = true;
        }

        if (shouldCheck && !element.checked) {
          setReactValue(element, true, 'checked');
        }
      } else {
        // Text, email, tel, date, number, etc.
        setReactValue(element, value, 'value');
      }
    } else if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      setReactValue(element, value, 'value');
    }

    return true;
  } catch (error) {
    console.error("AutofillEngine failed to fill field:", error, element);
    return false;
  }
}

// Bypasses React and Vue value tracking by calling the native prototype setters directly
function setReactValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: any,
  property: 'value' | 'checked'
) {
  let prototype: any;
  if (element instanceof HTMLInputElement) {
    prototype = window.HTMLInputElement.prototype;
  } else if (element instanceof HTMLTextAreaElement) {
    prototype = window.HTMLTextAreaElement.prototype;
  } else if (element instanceof HTMLSelectElement) {
    prototype = window.HTMLSelectElement.prototype;
  }

  if (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      (element as any)[property] = value;
    }
  } else {
    (element as any)[property] = value;
  }

  // Trigger events so that Vue/Angular/React model observers register changes
  const events = property === 'checked' ? ['click', 'change'] : ['input', 'change'];
  events.forEach((eventName) => {
    const event = new Event(eventName, { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
  });
}

// Fills multiple fields synchronously
export function fillFormFields(
  mappings: { element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; value: string }[]
): number {
  let count = 0;
  for (const item of mappings) {
    const success = fillField(item.element, item.value);
    if (success) {
      count++;
    }
  }
  return count;
}
