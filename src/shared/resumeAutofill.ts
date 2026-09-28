import { ScannedFieldMetadata } from './ai';

/** Small sentinel — actual file bytes are fetched via getDefaultResume in the background. */
export const DEFAULT_RESUME_MATCH_VALUE = '__ONECLICK_DEFAULT_RESUME__';

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

function resumeFieldBlob(field: ScannedFieldMetadata): string {
  return `${field.label} ${field.placeholder} ${field.ariaLabel} ${field.surroundingText} ${field.htmlName} ${field.htmlId} ${field.inputAccept || ''}`.toLowerCase();
}

export function scoreResumeFileField(field: ScannedFieldMetadata): number {
  const blob = resumeFieldBlob(field);
  if (/\b(resume|résumé|curriculum vitae|\bcv\b)\b/.test(blob)) return 100;
  if (/cover\s*letter|coverletter|motivation letter/.test(blob)) return 5;
  if (/photo|picture|avatar|headshot|portfolio|transcript|certificate|license/.test(blob)) return 10;
  if (/\battach\b|\bupload\b|application\/pdf|\.pdf|\.doc/.test(blob)) return 70;
  if (/\bfile\b|\bdocument\b/.test(blob)) return 55;
  return 35;
}

export function isResumeFileField(field: ScannedFieldMetadata): boolean {
  if ((field.type || '').toLowerCase() !== 'file') return false;
  const blob = resumeFieldBlob(field);
  if (scoreResumeFileField(field) >= 55) return true;
  return (
    /\b(resume|résumé|curriculum vitae|\bcv\b|attach|upload)\b/i.test(blob) &&
    !/cover\s*letter|photo|avatar|picture/.test(blob)
  );
}
