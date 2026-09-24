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
}

export interface JobInfo {
  currentCTC: string;
  expectedCTC: string;
  noticePeriod: string;
  preferredLocation: string;
}

export interface CustomField {
  id: string;
  name: string;
  value: string;
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

export interface Resume {
  id: string;
  name: string;
  fileName: string;
  fileType: string; // 'pdf' | 'docx'
  base64Data: string; // Base64 data content of file
  uploadedAt: string;
  isDefault?: boolean;
}

export interface SavedCredential {
  id: string;
  domain: string;
  username: string;
  password: string;
  createdAt: string;
}

export interface ManualMapping {
  id: string;
  domain: string;
  selector: string; // CSS selector of input field
  fieldPath: string; // e.g. 'personal.fullName' or 'custom:uuid'
  createdAt: string;
}

export interface TemplateRule {
  selector: string;
  fieldPath: string;
  customValue?: string;
}

export interface WebsiteTemplate {
  id: string;
  domain: string;
  name: string;
  rules: TemplateRule[];
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
  /** heuristic = offline only; hybrid = offline first + Gemini for gaps; gemini = Gemini mapping + answers */
  provider: 'heuristic' | 'hybrid' | 'gemini';
  geminiApiKey: string;
  geminiModel: string; // e.g., 'gemini-2.0-flash'
  /** Use Gemini to answer open-ended / unmatched questions from profile + job description */
  answerOpenQuestions: boolean;
  /** Include scraped job description text in Gemini prompts */
  useJobDescriptionContext: boolean;
}

export interface DomainRule {
  domain: string;
  enabled: boolean;
  autoFillOnLoad: boolean;
  requireConfirmation: boolean;
}

export interface FillHistoryEntry {
  id: string;
  domain: string;
  timestamp: string;
  fieldsCount: number;
  profileName: string;
}

export interface AppSettings {
  ai: AISettings;
  theme: 'light' | 'dark' | 'system';
  keyboardShortcut: string;
  globalEnabled: boolean;
}
