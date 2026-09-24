const JOB_DESC_SELECTORS = [
  '[data-automation="job-description"]',
  '[data-testid="job-description"]',
  '[class*="job-description" i]',
  '[class*="jobDescription" i]',
  '[id*="job-description" i]',
  '[id*="jobDescription" i]',
  '.description__text',
  '.posting-description',
  '.job-details',
  'section[aria-label*="job description" i]',
  'div[aria-label*="job description" i]',
];

const JOB_HEADING_PATTERN =
  /job description|about the role|about this role|role overview|position overview|what you.ll do|responsibilities|requirements|qualifications/i;

const MAX_JOB_DESC_CHARS = 12000;

function visibleText(el: Element): string {
  const htmlEl = el as HTMLElement;
  if (htmlEl.offsetParent === null && htmlEl.tagName !== 'BODY') {
    const style = window.getComputedStyle(htmlEl);
    if (style.display === 'none' || style.visibility === 'hidden') return '';
  }
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

export function extractJobDescription(root: Document = document): string {
  const chunks: string[] = [];

  for (const selector of JOB_DESC_SELECTORS) {
    root.querySelectorAll(selector).forEach((el) => {
      const text = visibleText(el);
      if (text.length > 120) chunks.push(text);
    });
  }

  if (chunks.length === 0) {
    root.querySelectorAll('h1, h2, h3, h4, section, article, main').forEach((el) => {
      const heading = el.querySelector('h1,h2,h3,h4')?.textContent || '';
      if (!JOB_HEADING_PATTERN.test(heading) && !JOB_HEADING_PATTERN.test(el.getAttribute('aria-label') || '')) {
        return;
      }
      const text = visibleText(el);
      if (text.length > 120) chunks.push(text);
    });
  }

  if (chunks.length === 0) {
    const meta = root.querySelector('meta[name="description"], meta[property="og:description"]');
    const metaContent = meta?.getAttribute('content')?.trim();
    if (metaContent && metaContent.length > 80) {
      chunks.push(metaContent);
    }
  }

  if (chunks.length === 0) return '';

  const unique = Array.from(new Set(chunks));
  unique.sort((a, b) => b.length - a.length);
  const combined = unique[0];
  return combined.length > MAX_JOB_DESC_CHARS
    ? combined.slice(0, MAX_JOB_DESC_CHARS) + '…'
    : combined;
}
