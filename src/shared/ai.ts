import { UserProfile, AppSettings, LearningMapping } from './types';

export interface ScannedFieldMetadata {
  scanId: string; // Internal unique scan ID
  type: string; // text, email, tel, select, checkbox, etc.
  label: string;
  placeholder: string;
  ariaLabel: string;
  htmlId: string;
  htmlName: string;
  surroundingText: string;
  autocomplete: string;
  /** How the control should be filled (combobox search, radio group, etc.) */
  controlKind?: 'standard' | 'combobox' | 'radio-group' | 'checkbox-group' | 'select';
  /** Radio/checkbox group name or internal group key */
  groupName?: string;
  /** Visible choices for radios, checkboxes, and selects (helps AI pick options) */
  optionLabels?: string[];
}

export interface MatchResult {
  fieldPath: string; // e.g. 'personal.fullName' or 'custom:id'
  confidence: number; // 0 to 1
  matchedValue: string; // The value from profile to fill
}

// Map profile fields to keywords
const KEYWORDS: Record<string, string[]> = {
  'personal.fullName': ['full name', 'your name', 'candidate name', 'name', 'fname lname', 'fullname', 'contact name', 'owner name', 'billing name', 'applicant name'],
  'personal.firstName': ['first name', 'given name', 'fname', 'first_name', 'first', 'forename'],
  'personal.lastName': ['last name', 'surname', 'lname', 'last_name', 'family name', 'last'],
  'personal.email': ['email', 'e-mail', 'mail address', 'email address', 'email_address', 'e-mail address'],
  'personal.phone': ['phone', 'mobile', 'tel', 'telephone', 'contact number', 'phone number', 'contact no', 'mobile number', 'cellphone', 'cell'],
  'personal.address': ['address', 'street', 'street address', 'address line', 'line 1', 'line1', 'addr', 'residential address', 'mailing address', 'address information'],
  'personal.city': ['city', 'town', 'location_city', 'suburb'],
  'personal.state': ['state', 'province', 'state/province', 'state or province', 'region', 'territory'],
  'personal.country': ['country', 'nation'],
  'personal.postalCode': ['zip', 'postal', 'zipcode', 'pincode', 'pin code', 'postal code', 'zip code'],
  'professional.jobTitle': ['job title', 'title', 'role', 'designation', 'position', 'current role', 'desired role'],
  'professional.experience': ['experience', 'years of experience', 'yoe', 'work experience', 'years exp', 'total experience'],
  'professional.currentCompany': ['current company', 'company', 'employer', 'organization', 'current employer', 'firm name'],
  'professional.skills': ['skills', 'core skills', 'technologies', 'programming languages', 'key skills', 'areas of expertise'],
  'professional.education': ['education', 'qualification', 'academic'],
  'professional.degree': ['degree', 'qualification', 'major', 'education degree', 'study field', 'specialization'],
  'professional.college': ['college', 'university', 'school', 'institute', 'education institution', 'academic institution', 'institution name', 'search college', 'college name', 'university name', 'name of college', 'name of institution'],
  'professional.linkedin': ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin profile url', 'linkedin.com', 'linked in'],
  'professional.github': ['github', 'github url', 'github profile', 'github.com'],
  'professional.portfolio': ['portfolio', 'website', 'portfolio url', 'personal website', 'personal link', 'portfolio link', 'other website'],
  'education.tenth.schoolOrCollege': ['10th school', 'class 10 school', 'ssc school', 'matriculation school', '10th board school', 'high school name', 'tenth school', 'class x school', '10th institution', 'school (10th)'],
  'education.tenth.degree': ['10th board', 'ssc board', 'class 10 board', '10th degree', 'matriculation degree', 'ssc qualification', '10th certificate', 'tenth degree'],
  'education.tenth.fieldOfStudy': ['10th stream', '10th subject', 'ssc subject', 'matriculation subject'],
  'education.tenth.passingYear': ['10th passing year', 'ssc passing year', 'class 10 year', '10th graduation year', 'matriculation passing year', 'tenth passing year', '10th year of passing'],
  'education.tenth.grade': ['10th marks', '10th cgpa', 'ssc marks', 'ssc percentage', 'class 10 marks', '10th grade', 'matriculation percentage', 'tenth marks', 'ssc grade'],
  'education.twelfthOrDiploma.schoolOrCollege': ['12th school', 'class 12 school', 'hsc school', 'diploma college', 'intermediate college', '12th board school', 'high school name 12', 'twelfth school', 'class xii school', '12th institution', 'school (12th)', 'junior college'],
  'education.twelfthOrDiploma.degree': ['12th board', 'hsc board', 'class 12 board', 'diploma degree', 'intermediate board', '12th degree', 'hsc qualification', '12th certificate', 'twelfth degree'],
  'education.twelfthOrDiploma.fieldOfStudy': ['12th stream', '12th subject', 'hsc stream', 'diploma branch', 'diploma specialization', 'intermediate stream', 'intermediate specialization'],
  'education.twelfthOrDiploma.passingYear': ['12th passing year', 'hsc passing year', 'diploma passing year', '12th graduation year', 'intermediate passing year', 'twelfth passing year', '12th year of passing'],
  'education.twelfthOrDiploma.grade': ['12th marks', '12th cgpa', 'hsc marks', 'hsc percentage', 'diploma percentage', 'diploma gpa', '12th grade', 'intermediate percentage', 'twelfth marks', 'hsc grade'],
  'education.ug.schoolOrCollege': ['ug college', 'ug university', 'undergrad college', 'undergrad university', 'graduation college', 'bachelor college', 'graduation university', 'bachelor university', 'college name', 'university name', 'search college', 'institution', 'affiliated college', 'name of college'],
  'education.ug.degree': ['ug degree', 'undergrad degree', 'graduation degree', 'bachelors degree', 'bachelor degree', 'ug qualification', 'graduation qualification', 'degree name'],
  'education.ug.fieldOfStudy': ['ug stream', 'ug major', 'ug specialization', 'graduation stream', 'undergrad major', 'bachelors stream', 'graduation branch', 'graduation specialization', 'major', 'branch'],
  'education.ug.passingYear': ['ug passing year', 'ug graduation year', 'graduation passing year', 'ug year of passing', 'graduation year'],
  'education.ug.grade': ['ug marks', 'ug cgpa', 'ug percentage', 'ug gpa', 'graduation percentage', 'graduation cgpa', 'graduation grade', 'gpa', 'cgpa'],
  'education.pg.schoolOrCollege': ['pg college', 'pg university', 'postgrad college', 'postgrad university', 'masters college', 'masters university', 'post graduation university', 'post-graduation university', 'post graduate college'],
  'education.pg.degree': ['pg degree', 'postgrad degree', 'masters degree', 'pg qualification', 'masters qualification', 'post graduation degree'],
  'education.pg.fieldOfStudy': ['pg stream', 'pg major', 'pg specialization', 'masters stream', 'postgrad major', 'masters major', 'post graduation specialization', 'post graduation stream'],
  'education.pg.passingYear': ['pg passing year', 'pg graduation year', 'postgrad passing year', 'pg year of passing', 'post graduation passing year', 'post graduation graduation year'],
  'education.pg.grade': ['pg marks', 'pg cgpa', 'pg percentage', 'pg gpa', 'masters percentage', 'masters cgpa', 'post graduation percentage', 'post graduation cgpa'],
  'jobInfo.currentCTC': ['current ctc', 'current salary', 'ctc', 'present ctc', 'present salary', 'current compensation', 'current c.t.c'],
  'jobInfo.expectedCTC': ['expected ctc', 'expected salary', 'expecting ctc', 'expecting salary', 'desired salary', 'desired compensation', 'expected compensation', 'expected c.t.c'],
  'jobInfo.noticePeriod': ['notice period', 'notice', 'availability', 'joining date', 'how soon', 'earliest join', 'notice period (days)'],
  'jobInfo.preferredLocation': ['preferred location', 'desired location', 'work location preference', 'preferred work location', 'location preference']
};

const AUTOCOMPLETE_TO_PATH: Record<string, string> = {
  name: 'personal.fullName',
  'given-name': 'personal.firstName',
  'family-name': 'personal.lastName',
  email: 'personal.email',
  tel: 'personal.phone',
  'tel-national': 'personal.phone',
  'street-address': 'personal.address',
  'address-line1': 'personal.address',
  'address-line2': 'personal.address',
  'address-level2': 'personal.city',
  'address-level1': 'personal.state',
  country: 'personal.country',
  'country-name': 'personal.country',
  'postal-code': 'personal.postalCode',
  organization: 'professional.currentCompany',
  'organization-title': 'professional.jobTitle',
  url: 'professional.portfolio',
};

function normalizeFieldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/[:\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchByInputType(field: ScannedFieldMetadata): MatchResult | null {
  const type = (field.type || '').toLowerCase();
  const pathByType: Record<string, string> = {
    email: 'personal.email',
    tel: 'personal.phone',
    url: 'professional.portfolio',
  };
  const path = pathByType[type];
  if (!path) return null;
  return { fieldPath: path, confidence: 0.88, matchedValue: '' };
}

function matchByAutocomplete(field: ScannedFieldMetadata): MatchResult | null {
  const token = (field.autocomplete || '').toLowerCase().split(/\s+/)[0];
  if (!token || token === 'off' || token === 'on') return null;
  const path = AUTOCOMPLETE_TO_PATH[token];
  if (!path) return null;
  return { fieldPath: path, confidence: 0.92, matchedValue: '' };
}

// Heuristic matching logic
export function matchFieldHeuristically(
  field: ScannedFieldMetadata,
  profile: UserProfile,
  learningMappings: LearningMapping[]
): MatchResult | null {
  const label = normalizeFieldText(field.label || '');
  const placeholder = normalizeFieldText(field.placeholder || '');
  const ariaLabel = normalizeFieldText(field.ariaLabel || '');
  const name = normalizeFieldText(field.htmlName || '');
  const id = normalizeFieldText(field.htmlId || '');
  const surrounding = normalizeFieldText(field.surroundingText || '');

  // Radio/checkbox option text must not drive mapping — use group question label only
  const fieldType = (field.type || '').toLowerCase();
  if (fieldType === 'radio' && field.controlKind !== 'radio-group') {
    return null;
  }
  if (
    fieldType === 'checkbox' &&
    field.controlKind !== 'checkbox-group' &&
    label.length > 0 &&
    label.length < 24
  ) {
    const optionLike = ['male', 'female', 'other', 'yes', 'no', 'true', 'false'];
    if (optionLike.includes(label)) {
      return null;
    }
  }

  if (field.controlKind === 'checkbox-group') {
    const groupText = normalizeFieldText(
      `${field.label} ${field.surroundingText} ${field.placeholder}`
    );
    if (groupText.includes('skill') && profile.professional.skills?.trim()) {
      return {
        fieldPath: 'professional.skills',
        confidence: 0.86,
        matchedValue: profile.professional.skills.trim(),
      };
    }
  }

  const autocompleteMatch = matchByAutocomplete(field);
  if (autocompleteMatch) {
    const val = getProfileValueByPath(profile, autocompleteMatch.fieldPath);
    if (val) {
      return { ...autocompleteMatch, matchedValue: val };
    }
  }

  let typeHintMatch = matchByInputType(field);

  const fieldTypeLower = (field.type || '').toLowerCase();
  if (fieldTypeLower === 'textarea' || fieldTypeLower === 'contenteditable' || fieldTypeLower === 'textbox') {
    // Long-form answers are handled by Gemini (or manual profile custom fields via learning only).
    for (const labelText of [label, placeholder, ariaLabel, name, id].filter(Boolean)) {
      const learned = learningMappings.find((m) => m.label.toLowerCase() === labelText.toLowerCase());
      if (learned && learned.confidenceScore > 0.5) {
        const val = getProfileValueByPath(profile, learned.matchedFieldPath);
        if (val) {
          return {
            fieldPath: learned.matchedFieldPath,
            confidence: Math.min(1.0, learned.confidenceScore),
            matchedValue: val,
          };
        }
      }
    }
    return null;
  }

  // 1. Check AI Learning history mappings first (100% confidence boost)
  const allLabelsToCheck = [label, placeholder, ariaLabel, name, id].filter(Boolean);
  for (const labelText of allLabelsToCheck) {
    const learned = learningMappings.find((m) => m.label.toLowerCase() === labelText.toLowerCase());
    if (learned && learned.confidenceScore > 0.5) {
      const val = getProfileValueByPath(profile, learned.matchedFieldPath);
      if (val !== undefined) {
        return {
          fieldPath: learned.matchedFieldPath,
          confidence: Math.min(1.0, learned.confidenceScore),
          matchedValue: val
        };
      }
    }
  }

  // 2. Exact or near-exact match on keywords
  let bestMatchPath: string | null = null;
  let maxConfidence = 0;

  for (const [path, keywords] of Object.entries(KEYWORDS)) {
    for (const kw of keywords) {
      // Priority 1: Label exact match
      if (label === kw) {
        updateBestMatch(path, 0.95);
      }
      // Priority 2: Label contains keyword as word boundary
      else if (label.includes(kw)) {
        updateBestMatch(path, 0.85);
      }
      // Priority 3: Placeholder match
      else if (placeholder === kw || placeholder.includes(kw)) {
        updateBestMatch(path, 0.80);
      }
      // Priority 4: Aria Label match
      else if (ariaLabel === kw || ariaLabel.includes(kw)) {
        updateBestMatch(path, 0.80);
      }
      // Priority 5: HTML Name/ID attribute contains keyword
      else if (name === kw || name.includes(kw) || id === kw || id.includes(kw)) {
        updateBestMatch(path, 0.75);
      }
      // Priority 6: Surrounding text matches keyword
      else if (surrounding.includes(kw)) {
        updateBestMatch(path, 0.65);
      }
    }
  }

  function updateBestMatch(path: string, confidence: number) {
    // Avoid mapping firstName or lastName keywords to fullName if specific fields exist
    if (path === 'personal.fullName' && (label.includes('first name') || label.includes('last name') || placeholder.includes('first name') || placeholder.includes('last name'))) {
      return;
    }

    // Avoid mapping company, school/education, job/role, or reference fields to candidate personal name fields
    const personalNamePaths = ['personal.fullName', 'personal.firstName', 'personal.lastName'];
    if (personalNamePaths.includes(path)) {
      const isCompanyField = 
        label.includes('company') || label.includes('employer') || label.includes('organization') || label.includes('firm') || label.includes('business') || label.includes('workplace') ||
        placeholder.includes('company') || placeholder.includes('employer') || placeholder.includes('organization') || placeholder.includes('firm') || placeholder.includes('business') || placeholder.includes('workplace') ||
        name.includes('company') || name.includes('employer') || name.includes('organization') || name.includes('firm') || name.includes('business') || name.includes('workplace') ||
        id.includes('company') || id.includes('employer') || id.includes('organization') || id.includes('firm') || id.includes('business') || id.includes('workplace');

      const isSchoolField = 
        label.includes('school') || label.includes('college') || label.includes('university') || label.includes('institute') || label.includes('institution') || label.includes('academy') ||
        placeholder.includes('school') || placeholder.includes('college') || placeholder.includes('university') || placeholder.includes('institute') || placeholder.includes('institution') || placeholder.includes('academy') ||
        name.includes('school') || name.includes('college') || name.includes('university') || name.includes('institute') || name.includes('institution') || name.includes('academy') ||
        id.includes('school') || id.includes('college') || id.includes('university') || id.includes('institute') || id.includes('institution') || id.includes('academy');

      const isJobOrEduField = 
        label.includes('degree') || label.includes('qualification') || label.includes('major') || label.includes('course') || label.includes('subject') || label.includes('specialization') ||
        placeholder.includes('degree') || placeholder.includes('qualification') || placeholder.includes('major') || placeholder.includes('course') || placeholder.includes('subject') || placeholder.includes('specialization') ||
        name.includes('degree') || name.includes('qualification') || name.includes('major') || name.includes('course') || name.includes('subject') || name.includes('specialization') ||
        id.includes('degree') || id.includes('qualification') || id.includes('major') || id.includes('course') || id.includes('subject') || id.includes('specialization') ||
        label.includes('job') || label.includes('role') || label.includes('position') || label.includes('designation') || label.includes('title') || label.includes('experience') ||
        placeholder.includes('job') || placeholder.includes('role') || placeholder.includes('position') || placeholder.includes('designation') || placeholder.includes('title') || placeholder.includes('experience') ||
        name.includes('job') || name.includes('role') || name.includes('position') || name.includes('designation') || name.includes('title') || name.includes('experience') ||
        id.includes('job') || id.includes('role') || id.includes('position') || id.includes('designation') || id.includes('title') || id.includes('experience') ||
        label.includes('salary') || label.includes('ctc') || placeholder.includes('salary') || placeholder.includes('ctc');

      const isReferenceField =
        label.includes('referee') || label.includes('reference') || label.includes('emergency contact') || label.includes('emergency_contact') || label.includes('parent') || label.includes('spouse') || label.includes('guardian') ||
        placeholder.includes('referee') || placeholder.includes('reference') || placeholder.includes('emergency contact') || placeholder.includes('emergency_contact') || placeholder.includes('parent') || placeholder.includes('spouse') || placeholder.includes('guardian') ||
        name.includes('referee') || name.includes('reference') || name.includes('emergency contact') || name.includes('emergency_contact') || name.includes('parent') || name.includes('spouse') || name.includes('guardian') ||
        id.includes('referee') || id.includes('reference') || id.includes('emergency contact') || id.includes('emergency_contact') || id.includes('parent') || id.includes('spouse') || id.includes('guardian');

      if (isCompanyField || isSchoolField || isJobOrEduField || isReferenceField) {
        return;
      }
    }

    if (confidence > maxConfidence) {
      maxConfidence = confidence;
      bestMatchPath = path;
    }
  }

  // 3. Fallback: Check custom fields
  if (maxConfidence < 0.8) {
    for (const cf of profile.customFields) {
      const cfName = cf.name.toLowerCase().trim();
      if (!cfName) continue;

      // Check for exact/contains matches in label, name, id, surrounding text
      const nameMatch = name.includes(cfName) || (cfName.includes(name) && name.length >= 3);
      const idMatch = id.includes(cfName) || (cfName.includes(id) && id.length >= 3);
      const labelMatch = label.includes(cfName) || (cfName.includes(label) && label.length >= 3);
      const surroundingMatch = surrounding.includes(cfName);

      // Synonyms / stemming support (e.g. "sponsor" matches "sponsorship", "auth" matches "authorization")
      let synonymMatch = false;
      const hasSponsor = cfName.includes('sponsor');
      const hasAuth = cfName.includes('auth') || cfName.includes('work') || cfName.includes('citizenship') || cfName.includes('legal');
      const hasGender = cfName.includes('gender') || cfName.includes('sex');

      if (hasSponsor && (name.includes('sponsor') || id.includes('sponsor') || label.includes('sponsor') || surrounding.includes('sponsor'))) {
        synonymMatch = true;
      }
      if (hasAuth && (name.includes('auth') || id.includes('auth') || label.includes('auth') || label.includes('work') || surrounding.includes('auth') || surrounding.includes('work'))) {
        synonymMatch = true;
      }
      if (hasGender && (name.includes('sex') || id.includes('sex') || label.includes('sex') || surrounding.includes('sex') || name.includes('gender') || id.includes('gender') || label.includes('gender') || surrounding.includes('gender'))) {
        synonymMatch = true;
      }

      // Word-based partial match (e.g. "visa status" matches "visa")
      let wordMatch = false;
      const cfWords = cfName.split(/\s+/).filter(w => w.length >= 4);
      if (cfWords.length > 0) {
        for (const word of cfWords) {
          if (name === word || id === word || label.includes(word) || surrounding.includes(word)) {
            wordMatch = true;
            break;
          }
        }
      }

      if (labelMatch || nameMatch || idMatch || surroundingMatch || synonymMatch || wordMatch) {
        return {
          fieldPath: `custom:${cf.id}`,
          confidence: 0.90,
          matchedValue: cf.value
        };
      }
    }
  }

  // 4. Special Case: Auto-check terms, agreement, consent, privacy policies
  if (field.type === 'checkbox') {
    const isAgreement = 
      label.includes('agree') || label.includes('accept') || label.includes('consent') || 
      label.includes('terms') || label.includes('policy') || label.includes('privacy') ||
      name.includes('agree') || name.includes('accept') || name.includes('consent') ||
      id.includes('agree') || id.includes('accept') || id.includes('consent');
      
    if (isAgreement) {
      return {
        fieldPath: 'system.agreement',
        confidence: 0.85,
        matchedValue: 'true'
      };
    }
  }

  // Check for resume upload input
  if (field.type === 'file') {
    const isResumeInput = 
      label.includes('resume') || label.includes('cv') || label.includes('curriculum') ||
      name.includes('resume') || name.includes('cv') || name.includes('curriculum') ||
      id.includes('resume') || id.includes('cv') ||
      surrounding.includes('resume') || surrounding.includes('cv') || surrounding.includes('curriculum vitae');
      
    if (isResumeInput) {
      return {
        fieldPath: 'system.resume',
        confidence: 0.95,
        matchedValue: 'system.resume'
      };
    }
  }

  if (bestMatchPath) {
    const val = getProfileValueByPath(profile, bestMatchPath);
    if (val !== undefined && val !== '') {
      return {
        fieldPath: bestMatchPath,
        confidence: maxConfidence,
        matchedValue: val
      };
    }
  }

  if (typeHintMatch) {
    const val = getProfileValueByPath(profile, typeHintMatch.fieldPath);
    if (val) {
      return { ...typeHintMatch, matchedValue: val };
    }
  }

  return null;
}

/** Minimum confidence to auto-fill without manual confirmation */
export const AUTO_FILL_CONFIDENCE_THRESHOLD = 0.62;

export const AI_GENERATED_FIELD_PATH = 'ai.generated';

const GEMINI_BATCH_SIZE = 18;

const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

/** Essay / motivation fields that should use Gemini generate, not salary heuristics. */
export function isOpenEndedQuestionField(field: ScannedFieldMetadata): boolean {
  const type = (field.type || '').toLowerCase();
  if (type === 'textarea' || type === 'contenteditable' || type === 'textbox') {
    return true;
  }
  const q = `${field.label} ${field.placeholder} ${field.surroundingText} ${field.ariaLabel}`.toLowerCase();
  return (
    q.includes('?') ||
    /proud|achiev|motivat|why (this|us|you)|tell us|describe|explain|want this|cover letter|personal statement|anything else|additional information|relevant experience|about yourself|interest in/.test(
      q
    )
  );
}

export function isLikelyMotivationQuestion(field: ScannedFieldMetadata): boolean {
  const q = `${field.label} ${field.surroundingText}`.toLowerCase();
  return /how much do you want|want this role|why do you want|excited about|interested in this/.test(q);
}

function buildProfileSchema(profile: UserProfile) {
  return {
    personal: profile.personal,
    professional: profile.professional,
    education: profile.education,
    jobInfo: profile.jobInfo,
    customFields: profile.customFields.map((f) => ({ name: f.name, value: f.value })),
  };
}

function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!cleaned) {
    throw new Error('Gemini returned empty response body');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Gemini returned invalid JSON');
  }
}

async function callGeminiJsonOnce<T>(
  apiKey: string,
  modelName: string,
  prompt: string
): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Gemini API HTTP ${response.status} (${modelName}): ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text || '';
  if (!text) {
    const reason = candidate?.finishReason || data.promptFeedback?.blockReason || 'unknown';
    throw new Error(`Gemini returned no text (finishReason: ${reason})`);
  }
  return parseJsonLoose(text) as T;
}

async function callGeminiJson<T>(
  apiKey: string,
  modelName: string,
  prompt: string
): Promise<T | null> {
  const models = [modelName, ...GEMINI_MODEL_FALLBACKS.filter((m) => m !== modelName)];
  let lastError: unknown;
  for (const model of models) {
    try {
      return await callGeminiJsonOnce<T>(apiKey, model, prompt);
    } catch (error) {
      lastError = error;
      const msg = String(error);
      const retryable =
        msg.includes('404') ||
        msg.includes('400') ||
        msg.includes('403') ||
        msg.includes('invalid JSON') ||
        msg.includes('empty response');
      if (!retryable) {
        break;
      }
    }
  }
  throw lastError;
}

function fieldSummary(fields: ScannedFieldMetadata[]) {
  return fields.map((f) => ({
    scanId: f.scanId,
    type: f.type,
    controlKind: f.controlKind,
    label: f.label,
    placeholder: f.placeholder,
    ariaLabel: f.ariaLabel,
    name: f.htmlName,
    id: f.htmlId,
    surroundingText: f.surroundingText,
    optionLabels: f.optionLabels?.length ? f.optionLabels : undefined,
  }));
}

function chunkFields(fields: ScannedFieldMetadata[]): ScannedFieldMetadata[][] {
  const chunks: ScannedFieldMetadata[][] = [];
  for (let i = 0; i < fields.length; i += GEMINI_BATCH_SIZE) {
    chunks.push(fields.slice(i, i + GEMINI_BATCH_SIZE));
  }
  return chunks;
}

// Helper to get nested value from profile object
export function getProfileValueByPath(profile: UserProfile, path: string): string {
  if (path === 'system.agreement') {
    return 'true';
  }
  if (path.startsWith('custom:')) {
    const customId = path.split(':')[1];
    const field = profile.customFields.find((f) => f.id === customId);
    return field ? field.value : '';
  }

  const parts = path.split('.');
  let current: any = profile;
  for (const part of parts) {
    if (current && current[part] !== undefined) {
      current = current[part];
    } else {
      return '';
    }
  }
  return typeof current === 'string' ? current : '';
}

type GeminiFieldResolution = {
  strategy?: 'profile' | 'generate' | 'skip';
  fieldPath?: string | null;
  answer?: string | null;
  confidence?: number;
};

const GEMINI_RESPONSE_WRAPPER_KEYS = ['results', 'fields', 'responses', 'data', 'mappings'];

function isChoiceControlField(field: ScannedFieldMetadata): boolean {
  const type = (field.type || '').toLowerCase();
  const kind = field.controlKind;
  return (
    kind === 'radio-group' ||
    kind === 'checkbox-group' ||
    kind === 'select' ||
    type === 'select' ||
    type === 'radio-group' ||
    type === 'checkbox-group' ||
    type === 'radio' ||
    type === 'checkbox'
  );
}

function normalizeGeminiFieldMap(
  raw: unknown,
  batchScanIds: Set<string>
): Record<string, GeminiFieldResolution> {
  const out: Record<string, GeminiFieldResolution> = {};

  const assign = (scanId: string, resolution: GeminiFieldResolution) => {
    if (!batchScanIds.has(scanId)) return;
    if (!out[scanId]) {
      out[scanId] = resolution;
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as GeminiFieldResolution & { scanId?: string };
      if (rec.scanId && typeof rec.scanId === 'string') {
        assign(rec.scanId, rec);
      }
    }
    return out;
  }

  if (!raw || typeof raw !== 'object') {
    return out;
  }

  let obj = raw as Record<string, unknown>;
  for (const wrap of GEMINI_RESPONSE_WRAPPER_KEYS) {
    const nested = obj[wrap];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      obj = nested as Record<string, unknown>;
      break;
    }
  }

  for (const [key, val] of Object.entries(obj)) {
    if (!val || typeof val !== 'object') continue;
    const resolution = val as GeminiFieldResolution;
    if (batchScanIds.has(key)) {
      assign(key, resolution);
      continue;
    }
    const exact = [...batchScanIds].find((id) => id === key.trim());
    if (exact) {
      assign(exact, resolution);
      continue;
    }
    const partial = [...batchScanIds].find((id) => key.includes(id) || id.includes(key));
    if (partial) {
      assign(partial, resolution);
    }
  }

  return out;
}

function inferGeminiStrategy(resolution: GeminiFieldResolution): 'profile' | 'generate' | 'skip' {
  if (resolution.strategy === 'profile' || resolution.strategy === 'generate' || resolution.strategy === 'skip') {
    return resolution.strategy;
  }
  if (resolution.answer?.trim()) return 'generate';
  if (resolution.fieldPath?.trim()) return 'profile';
  return 'skip';
}

function effectiveGeminiConfidence(
  resolution: GeminiFieldResolution,
  strategy: 'profile' | 'generate' | 'skip',
  hasFillValue: boolean
): number {
  if (typeof resolution.confidence === 'number' && resolution.confidence > 0) {
    return resolution.confidence;
  }
  if (strategy === 'skip' || !hasFillValue) return 0;
  if (strategy === 'generate') return 0.78;
  if (strategy === 'profile') return 0.82;
  return 0;
}

function resolutionToMatchResult(
  resolution: GeminiFieldResolution,
  profile: UserProfile,
  field: ScannedFieldMetadata | undefined
): MatchResult | null {
  const strategy = inferGeminiStrategy(resolution);
  if (strategy === 'skip') return null;

  const choiceField = field ? isChoiceControlField(field) : false;
  const answerText = resolution.answer?.trim() || '';

  if (strategy === 'profile' && resolution.fieldPath) {
    let val = getProfileValueByPath(profile, resolution.fieldPath);
    if (choiceField && answerText) {
      val = answerText;
    } else if (!val && answerText) {
      val = answerText;
    }
    if (!val) return null;
    const conf = effectiveGeminiConfidence(resolution, strategy, Boolean(val));
    if (conf < 0.35) return null;
    return {
      fieldPath: resolution.fieldPath,
      confidence: conf,
      matchedValue: val,
    };
  }

  if (strategy === 'generate') {
    const generated = answerText;
    if (!generated) return null;
    const conf = effectiveGeminiConfidence(resolution, strategy, true);
    if (conf < 0.35) return null;
    return {
      fieldPath: AI_GENERATED_FIELD_PATH,
      confidence: conf,
      matchedValue: generated,
    };
  }

  return null;
}

// Map unmatched fields to profile paths OR generate tailored answers (open questions).
export async function resolveUnmatchedFieldsWithGemini(
  fields: ScannedFieldMetadata[],
  profile: UserProfile,
  apiKey: string,
  modelName: string,
  options: {
    jobDescription?: string;
    includeProfileMapping?: boolean;
    includeGeneratedAnswers?: boolean;
  }
): Promise<Record<string, MatchResult>> {
  const results: Record<string, MatchResult> = {};
  if (fields.length === 0 || !apiKey) return results;

  const includeProfileMapping = options.includeProfileMapping !== false;
  const includeGeneratedAnswers = options.includeGeneratedAnswers !== false;
  const jobDescription = options.jobDescription?.trim() || '';
  let lastBatchError: unknown;

  for (const batch of chunkFields(fields)) {
    const fillable = batch.filter((f) => f.type !== 'file');
    if (fillable.length === 0) continue;

    const batchScanIds = new Set(fillable.map((f) => f.scanId));
    const scanIdList = [...batchScanIds].join(', ');

    const prompt = `You autofill job application forms for a candidate.

JOB DESCRIPTION (context — may be empty):
${jobDescription || '(none detected on page)'}

CANDIDATE PROFILE (JSON):
${JSON.stringify(buildProfileSchema(profile), null, 2)}

UNMATCHED FORM FIELDS (JSON):
${JSON.stringify(fieldSummary(fillable), null, 2)}

Return ONE JSON object. Top-level keys MUST be the exact scanId strings from the fields above.
Valid scanIds for this batch: ${scanIdList}

Each scanId maps to:
{
  "strategy": "profile" | "generate" | "skip",
  "fieldPath": "personal.email" | "professional.skills" | "jobInfo.expectedCTC" | "custom:<id>" | "system.agreement" | null,
  "answer": "string to type/select/check — required when strategy is generate, or for radio/select/checkbox",
  "confidence": number from 0.5 to 1.0 (always include this)
}

Rules:
1. strategy "profile": use when the field clearly maps to profile data. Set fieldPath accordingly. For text inputs the client reads profile; still set answer for select/radio/checkbox.
2. strategy "generate": use for open-ended questions (e.g. proud of, why this company, motivation, summary, cover letter prompts, achievements, "tell us about yourself", role-specific questions). Questions like "How much do you want this?" mean motivation/interest — NOT salary — write a sincere 2–4 sentence answer. Ground answers in profile${jobDescription ? ' and tailor to the job description' : ''}. Do NOT invent employers, degrees, dates, or certifications not in the profile.
3. strategy "skip": file uploads or when insufficient data.
4. Agreements/consent/terms checkboxes: strategy profile, fieldPath "system.agreement", confidence 1.0.
5. Radio/select: set "answer" to ONE exact visible option label to select.
6. checkbox-group (multi-select): set "answer" to comma-separated option labels to tick (e.g. "JavaScript, React, Node.js"). Only use labels from optionLabels when provided.
7. Salary/compensation: prefer jobInfo.currentCTC / jobInfo.expectedCTC from profile; if empty, give a brief professional answer without fabricating numbers unless profile has them.
8. Textarea answers: 2–5 sentences, first person, professional.
9. ${includeProfileMapping ? 'Use profile mapping when possible for standard fields (name, email, phone, location, CTC, notice period, etc.).' : 'Prefer generate for non-standard fields.'}
10. ${includeGeneratedAnswers ? 'Use generate for open-ended questions.' : 'Do not generate — only map to profile or skip.'}
11. Include an entry for EVERY scanId in this batch (use skip only when truly unknown).
12. Return ONLY raw JSON, no markdown.`;

    try {
      const raw = await callGeminiJson<unknown>(apiKey, modelName, prompt);
      if (!raw) continue;

      const normalized = normalizeGeminiFieldMap(raw, batchScanIds);
      const fieldByScanId = new Map(fillable.map((f) => [f.scanId, f]));

      for (const [scanId, resolution] of Object.entries(normalized)) {
        const match = resolutionToMatchResult(resolution, profile, fieldByScanId.get(scanId));
        if (match) {
          results[scanId] = match;
        }
      }
    } catch (error) {
      console.error('Gemini resolveUnmatchedFields error:', error);
      lastBatchError = error;
    }
  }

  if (Object.keys(results).length === 0 && lastBatchError) {
    throw lastBatchError;
  }

  return results;
}

// Legacy: profile-path mapping only (used when provider is gemini).
export async function matchFieldsWithGemini(
  fields: ScannedFieldMetadata[],
  profile: UserProfile,
  apiKey: string,
  modelName: string = 'gemini-2.0-flash',
  jobDescription: string = ''
): Promise<Record<string, MatchResult>> {
  return resolveUnmatchedFieldsWithGemini(fields, profile, apiKey, modelName, {
    jobDescription,
    includeProfileMapping: true,
    includeGeneratedAnswers: false,
  });
}
