import { ScannedFieldMetadata } from './ai';

/** Small sentinels — actual file bytes are fetched via getProfileDocument in the background. */
export const DEFAULT_RESUME_MATCH_VALUE = '__ONECLICK_DEFAULT_RESUME__';
export const DEFAULT_COVER_LETTER_FILE_VALUE = '__ONECLICK_COVER_LETTER_FILE__';

/** Minimum score to assign the active resume file to a field. */
export const RESUME_FILE_ASSIGN_MIN_SCORE = 90;

export type ResumeFilePayload = {
  fileName: string;
  fileType: string;
  base64Data: string;
};

export function isDefaultResumeMatchValue(value: string | undefined | null): boolean {
  if (!value) return false;
  if (value === DEFAULT_RESUME_MATCH_VALUE || value === 'system.resume') return true;
  return value.includes('"base64Data"') && value.includes('"fileName"');
}

export function isCoverLetterFileMatchValue(value: string | undefined | null): boolean {
  return value === DEFAULT_COVER_LETTER_FILE_VALUE || value === 'system.coverLetterFile';
}

function resumeFieldBlob(field: ScannedFieldMetadata): string {
  return `${field.label} ${field.placeholder} ${field.ariaLabel} ${field.surroundingText} ${field.htmlName} ${field.htmlId} ${field.inputAccept || ''}`.toLowerCase();
}

/** Primary label/name/id text (avoid matching incidental page copy in surroundingText). */
function resumeFieldPrimaryBlob(field: ScannedFieldMetadata): string {
  return `${field.label} ${field.placeholder} ${field.ariaLabel} ${field.htmlName} ${field.htmlId} ${field.inputAccept || ''}`.toLowerCase();
}

const COVER_LETTER_PATTERN = /cover\s*letter|coverletter|cover_letter|motivation\s*letter/;

const RESUME_PATTERN = /\b(resume|résumé|curriculum vitae|\bcv\b)\b/;

/** File inputs that must never receive the profile resume PDF. */
const NON_RESUME_FILE_PATTERN =
  /cover\s*letter|coverletter|cover_letter|motivation\s*letter|photo|picture|avatar|headshot|profile\s*pic|portrait|selfie|portfolio|transcript|certificate|certification|license|licence|passport|government\s*id|\bid\s*card|visa|work\s*permit|writing\s*sample|reference\s*letter|recommendation|offer\s*letter|immigration|ssn|social\s*security|driver'?s?\s*license|utility\s*bill|proof\s*of|supporting\s*document|additional\s*document|other\s*document|miscellaneous|letter\s*of|transcript|diploma|degree\s*scan|national\s*id|pan\s*card|aadhaar/;

export function isNonResumeDocumentFileField(field: ScannedFieldMetadata): boolean {
  if ((field.type || '').toLowerCase() !== 'file') return false;
  const primary = resumeFieldPrimaryBlob(field);
  if (COVER_LETTER_PATTERN.test(primary)) return true;
  if (NON_RESUME_FILE_PATTERN.test(primary)) return true;
  return false;
}

export function scoreCoverLetterFileField(field: ScannedFieldMetadata): number {
  if ((field.type || '').toLowerCase() !== 'file') return 0;
  if (isNonResumeDocumentFileField(field) && !COVER_LETTER_PATTERN.test(resumeFieldPrimaryBlob(field))) {
    return 0;
  }
  const primary = resumeFieldPrimaryBlob(field);
  if (COVER_LETTER_PATTERN.test(primary)) return 100;
  if (COVER_LETTER_PATTERN.test(resumeFieldBlob(field))) return 85;
  return 0;
}

export function isCoverLetterFileField(field: ScannedFieldMetadata): boolean {
  return scoreCoverLetterFileField(field) >= 100;
}

export function scoreResumeFileField(field: ScannedFieldMetadata): number {
  if ((field.type || '').toLowerCase() !== 'file') return 0;
  if (isCoverLetterFileField(field)) return 0;
  if (isNonResumeDocumentFileField(field)) return 0;
  const primary = resumeFieldPrimaryBlob(field);
  if (RESUME_PATTERN.test(primary)) return 100;
  if (RESUME_PATTERN.test(resumeFieldBlob(field))) return 92;
  return 0;
}

export function isResumeFileField(field: ScannedFieldMetadata): boolean {
  if ((field.type || '').toLowerCase() !== 'file') return false;
  return scoreResumeFileField(field) >= RESUME_FILE_ASSIGN_MIN_SCORE;
}

export function isCoverLetterTextField(field: ScannedFieldMetadata): boolean {
  const type = (field.type || '').toLowerCase();
  if (type === 'file') return false;
  return COVER_LETTER_PATTERN.test(
    `${field.label} ${field.placeholder} ${field.ariaLabel} ${field.htmlName} ${field.htmlId}`.toLowerCase()
  );
}
