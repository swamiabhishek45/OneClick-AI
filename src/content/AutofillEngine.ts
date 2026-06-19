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

// Bypasses browser restrictions to assign a File object to an input element
function setFileInputValue(element: HTMLInputElement, base64Data: string, fileName: string, fileType: string): boolean {
  try {
    // Convert base64 to blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    
    // Create File object
    const file = new File([blob], fileName, { type: blob.type });
    
    // Use DataTransfer to assign files
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    element.files = dataTransfer.files;
    
    // Dispatch events to notify page scripts
    const event = new Event('change', { bubbles: true });
    element.dispatchEvent(event);
    return true;
  } catch (err) {
    console.error("Failed to set file input value programmatically:", err);
    return false;
  }
}

// Extract option value from custom components (Google Forms checkboxes/radios)
function getCustomOptionValue(element: HTMLElement): string {
  const dataVal = element.getAttribute('data-value');
  if (dataVal) return dataVal.trim();
  
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  
  if (element.textContent) {
    const txt = element.textContent.trim();
    if (txt) return txt;
  }
  
  return '';
}

export function fillField(
  element: HTMLElement,
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
      } else if (type === 'file') {
        try {
          const fileData = JSON.parse(value);
          if (fileData.base64Data && fileData.fileName) {
            return setFileInputValue(element, fileData.base64Data, fileData.fileName, fileData.fileType);
          }
        } catch (e) {
          console.error("AutofillEngine failed to parse serialized file payload:", e);
        }
      } else {
        // Text, email, tel, date, number, etc.
        setReactValue(element, value, 'value');
      }
    } else if (element instanceof HTMLTextAreaElement) {
      setReactValue(element, value, 'value');
    } else if (element instanceof HTMLSelectElement) {
      const targetVal = value.toLowerCase().trim();
      let matchedOptionValue = '';

      for (let i = 0; i < element.options.length; i++) {
        const opt = element.options[i];
        const optVal = opt.value.toLowerCase().trim();
        const optText = opt.text.toLowerCase().trim();

        if (optVal === targetVal || optText === targetVal || optText.includes(targetVal) || targetVal.includes(optText)) {
          matchedOptionValue = opt.value;
          break;
        }
      }

      if (matchedOptionValue) {
        setReactValue(element, matchedOptionValue, 'value');
      }
    } else {
      // Custom Elements (Google Forms radio/checkbox/listbox)
      const role = element.getAttribute('role');
      if (role === 'radio') {
        const optionVal = getCustomOptionValue(element).toLowerCase();
        const profileVal = String(value).toLowerCase().trim();
        
        let shouldSelect = (optionVal === profileVal);
        if (!shouldSelect && isTruthy(profileVal) && (optionVal === 'yes' || optionVal === 'true' || optionVal === '1')) {
          shouldSelect = true;
        } else if (!shouldSelect && isFalsey(profileVal) && (optionVal === 'no' || optionVal === 'false' || optionVal === '0')) {
          shouldSelect = true;
        }

        if (shouldSelect) {
          const isChecked = element.getAttribute('aria-checked') === 'true';
          if (!isChecked) {
            element.click();
          }
        }
      } else if (role === 'checkbox') {
        const optionVal = getCustomOptionValue(element).toLowerCase();
        const profileVal = String(value).toLowerCase().trim();
        
        let shouldSelect = false;
        if (optionVal === profileVal) {
          shouldSelect = true;
        } else {
          // Check for comma-separated items
          const items = profileVal.split(',').map(s => s.trim().toLowerCase());
          if (items.includes(optionVal)) {
            shouldSelect = true;
          }
        }

        if (!shouldSelect && isTruthy(profileVal) && (optionVal === 'yes' || optionVal === 'true' || optionVal === '1' || optionVal === 'y')) {
          shouldSelect = true;
        }

        const isChecked = element.getAttribute('aria-checked') === 'true';
        if (shouldSelect !== isChecked) {
          element.click();
        }
      } else if (role === 'listbox') {
        const profileVal = String(value).trim();
        if (profileVal) {
          // Click to open custom dropdown
          element.click();
          // Short delay for options menu rendering
          setTimeout(() => {
            const options = document.querySelectorAll('[role="option"]');
            for (let i = 0; i < options.length; i++) {
              const opt = options[i] as HTMLElement;
              const optVal = (opt.getAttribute('data-value') || opt.textContent || '').trim();
              if (optVal.toLowerCase() === profileVal.toLowerCase()) {
                opt.click();
                break;
              }
            }
          }, 100);
        }
      }
    }

    return true;
  } catch (error) {
    console.error("AutofillEngine failed to fill field:", error, element);
    return false;
  }
}

// Bypasses React and Vue value tracking by calling the native prototype setters directly
function setReactValue(
  element: HTMLElement,
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
  mappings: { element: HTMLElement; value: string }[]
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
