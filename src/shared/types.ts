export interface PersonalInfo {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface ProfessionalInfo {
  jobTitle: string;
  experience: string; // e.g. "3 years" or "3"
  currentCompany: string;
  skills: string; // Comma separated or textarea
  education: string;
  degree: string;
  college: string;
  linkedin: string;
  github: string;
  portfolio: string;
  /** Plain-text cover letter for textarea fields */
  coverLetter?: string;
}

export interface JobInfo {
  currentCTC: string;
  expectedCTC: string;
  noticePeriod: string;
  preferredLocation: string;
}

export type CustomFieldSection = 'personal' | 'professional' | 'education' | 'jobInfo';

export interface CustomField {
  id: string;
  name: string;
  value: string;
  /** Which profile section this extra field belongs to (used for autofill mapping). */
  section?: CustomFieldSection;
}

export interface EducationLevel {
  schoolOrCollege: string;
  degree: string;
  fieldOfStudy: string;
  passingYear: string;
  grade: string;
}

export interface EducationInfo {
  tenth: EducationLevel;
  twelfthOrDiploma: EducationLevel;
  ug: EducationLevel;
  pg: EducationLevel;
}

export interface UserProfile {
  id: string;
  name: string;
  personal: PersonalInfo;
  professional: ProfessionalInfo;
  education: EducationInfo;
  jobInfo: JobInfo;
  customFields: CustomField[];
  isDefault?: boolean;
}

export type ProfileDocumentType = 'resume' | 'coverLetter';

export interface Resume {
  id: string;
  name: string;
  fileName: string;
  fileType: string; // 'pdf' | 'docx'
  base64Data: string; // Base64 data content of file
  uploadedAt: string;
  /** Owning profile; legacy files without one are assigned on startup */
  profileId?: string;
  documentType?: ProfileDocumentType;
  /** Active file for autofill within this profile + documentType */
  isDefault?: boolean;
}

export interface ManualMapping {
  id: string;
  domain: string;
  selector: string; // CSS selector of input field
  fieldPath: string; // e.g. 'personal.fullName' or 'custom:uuid'
  createdAt: string;
}

export interface LearningMapping {
  id: string; // unique hash or label key
  label: string; // label or placeholder name
  matchedFieldPath: string; // the corrected profile field path
  correctionsCount: number;
  confidenceScore: number; // calculated score
}

export interface AISettings {
  /** heuristic = offline only; hybrid = offline first + Gemini for gaps */
  provider: 'heuristic' | 'hybrid';
  geminiApiKey: string;
  geminiModel: string;
  answerOpenQuestions: boolean;
  /** Include job description text in Gemini prompts (manual fill only) */
  useJobDescriptionContext: boolean;
}

export interface DomainRule {
  domain: string;
  enabled: boolean;
  autoFillOnLoad: boolean;
  requireConfirmation: boolean;
}

export interface AppSettings {
  ai: AISettings;
  theme: 'light' | 'dark' | 'system';
  globalEnabled: boolean;
  /** Remember field label corrections after you edit autofilled values */
  learnFromCorrections: boolean;
  /** Empty = all sites; otherwise only these hostnames (e.g. greenhouse.io) */
  siteAllowlist: string[];
  /** Confirm how many fields will be filled before applying */
  showFillPreview: boolean;
  /** Opt-in: scan and fill empty fields when a page loads (allowed sites only) */
  autoFillOnLoad: boolean;
}
