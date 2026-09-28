import { ScannedFieldMetadata } from './ai';

/** Small sentinels — actual file bytes are fetched via getProfileDocument in the background. */
export const DEFAULT_RESUME_MATCH_VALUE = '__ONECLICK_DEFAULT_RESUME__';
export const DEFAULT_COVER_LETTER_FILE_VALUE = '__ONECLICK_COVER_LETTER_FILE__';

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

const COVER_LETTER_PATTERN = /cover\s*letter|coverletter|cover_letter|motivation\s*letter/;

export function scoreCoverLetterFileField(field: ScannedFieldMetadata): number {
  if ((field.type || '').toLowerCase() !== 'file') return 0;
  const label = `${field.label} ${field.ariaLabel} ${field.htmlName} ${field.htmlId}`.toLowerCase();
  if (COVER_LETTER_PATTERN.test(label)) return 100;
  if (COVER_LETTER_PATTERN.test(resumeFieldBlob(field))) return 80;
  return 0;
}

export function isCoverLetterFileField(field: ScannedFieldMetadata): boolean {
  return scoreCoverLetterFileField(field) >= 100;
}

export function scoreResumeFileField(field: ScannedFieldMetadata): number {
  const blob = resumeFieldBlob(field);
  if (scoreCoverLetterFileField(field) >= 100) return 5;
  if (/\b(resume|résumé|curriculum vitae|\bcv\b)\b/.test(blob)) return 100;
  if (COVER_LETTER_PATTERN.test(blob)) return 5;
  if (/photo|picture|avatar|headshot|portfolio|transcript|certificate|license/.test(blob)) return 10;
  if (/\battach\b|\bupload\b|application\/pdf|\.pdf|\.doc/.test(blob)) return 70;
  if (/\bfile\b|\bdocument\b/.test(blob)) return 55;
  return 35;
}

export function isResumeFileField(field: ScannedFieldMetadata): boolean {
  if ((field.type || '').toLowerCase() !== 'file') return false;
  if (isCoverLetterFileField(field)) return false;
  const blob = resumeFieldBlob(field);
  if (scoreResumeFileField(field) >= 55) return true;
  return (
    /\b(resume|résumé|curriculum vitae|\bcv\b|attach|upload)\b/i.test(blob) &&
    !/cover\s*letter|photo|avatar|picture/.test(blob)
  );
}

export function isCoverLetterTextField(field: ScannedFieldMetadata): boolean {
  const type = (field.type || '').toLowerCase();
  if (type === 'file') return false;
  return COVER_LETTER_PATTERN.test(
    `${field.label} ${field.placeholder} ${field.ariaLabel} ${field.htmlName} ${field.htmlId}`.toLowerCase()
  );
}
