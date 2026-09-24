export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Score how well `candidate` matches desired `target` (0–1). */
export function scoreOptionMatch(candidate: string, target: string): number {
  const c = normalizeForMatch(candidate);
  const t = normalizeForMatch(target);
  if (!c || !t) return 0;
  if (c === t) return 1;
  if (c.includes(t) || t.includes(c)) return 0.92;

  const cWords = c.split(' ').filter((w) => w.length > 2);
  const tWords = t.split(' ').filter((w) => w.length > 2);
  if (cWords.length === 0 || tWords.length === 0) return 0;

  let hits = 0;
  for (const tw of tWords) {
    if (cWords.some((cw) => cw.includes(tw) || tw.includes(cw))) hits++;
  }
  return hits / Math.max(tWords.length, 1);
}

function collectNodesDeep(root: Node, selector: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      el.querySelectorAll(selector).forEach((n) => out.push(n as HTMLElement));
      if (el.shadowRoot) visit(el.shadowRoot);
    }
    node.childNodes.forEach(visit);
  };
  visit(root);
  return out;
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function getOptionText(el: HTMLElement): string {
  return (
    el.getAttribute('data-value') ||
    el.getAttribute('data-label') ||
    el.getAttribute('aria-label') ||
    el.textContent ||
    ''
  ).trim();
}

export function queryDropdownOptions(anchor?: HTMLElement): HTMLElement[] {
  const selectors = [
    '[role="option"]',
    '[role="menuitem"]',
    'li.select2-results__option',
    '.MuiAutocomplete-option',
    'mat-option',
    '.dropdown-item',
    '.autocomplete-item',
    '.pac-item',
    'ul[role="listbox"] li',
  ];

  const seen = new Set<HTMLElement>();
  const options: HTMLElement[] = [];

  for (const sel of selectors) {
    for (const el of collectNodesDeep(document, sel)) {
      if (seen.has(el) || !isVisible(el)) continue;
      const text = getOptionText(el);
      if (!text || text.length > 200) continue;
      if (text.toLowerCase().includes('no results')) continue;
      seen.add(el);
      options.push(el);
    }
  }

  if (anchor) {
    const controls = anchor.getAttribute('aria-controls');
    if (controls) {
      const list = document.getElementById(controls);
      if (list) {
        list.querySelectorAll('[role="option"], li').forEach((n) => {
          const el = n as HTMLElement;
          if (!seen.has(el) && isVisible(el)) {
            seen.add(el);
            options.push(el);
          }
        });
      }
    }
  }

  return options;
}

export function pickBestOption(options: HTMLElement[], targetValue: string): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = 0.45;

  for (const opt of options) {
    const text = getOptionText(opt);
    const score = scoreOptionMatch(text, targetValue);
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }

  return best;
}

export async function fillDatalistInput(input: HTMLInputElement, value: string): Promise<boolean> {
  const listId = input.getAttribute('list');
  if (!listId) return false;
  const list = document.getElementById(listId);
  if (!list) return false;

  let bestVal = '';
  let bestScore = 0.45;
  list.querySelectorAll('option').forEach((opt) => {
    const text = opt.value || opt.textContent || '';
    const score = scoreOptionMatch(text, value);
    if (score > bestScore) {
      bestScore = score;
      bestVal = opt.value || text;
    }
  });

  if (!bestVal) return false;
  input.value = bestVal;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
