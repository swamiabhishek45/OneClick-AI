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
  'personal.address': ['address', 'street', 'line 1', 'line1', 'addr', 'residential address', 'mailing address'],
  'personal.city': ['city', 'town', 'location_city', 'suburb'],
  'personal.state': ['state', 'province', 'region', 'territory'],
  'personal.country': ['country', 'nation'],
  'personal.postalCode': ['zip', 'postal', 'zipcode', 'pincode', 'pin code', 'postal code', 'zip code'],
  'professional.jobTitle': ['job title', 'title', 'role', 'designation', 'position', 'current role', 'desired role'],
  'professional.experience': ['experience', 'years of experience', 'yoe', 'work experience', 'years exp', 'total experience'],
  'professional.currentCompany': ['current company', 'company', 'employer', 'organization', 'current employer', 'firm name'],
  'professional.skills': ['skills', 'core skills', 'technologies', 'programming languages', 'key skills', 'areas of expertise'],
  'professional.education': ['education', 'qualification', 'academic'],
  'professional.degree': ['degree', 'qualification', 'major', 'education degree', 'study field', 'specialization'],
  'professional.college': ['college', 'university', 'school', 'institute', 'education institution', 'academic institution'],
  'professional.linkedin': ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin.com'],
  'professional.github': ['github', 'github url', 'github profile', 'github.com'],
  'professional.portfolio': ['portfolio', 'website', 'portfolio url', 'personal website', 'personal link', 'portfolio link', 'other website'],
  'jobInfo.currentCTC': ['current ctc', 'current salary', 'ctc', 'present ctc', 'present salary', 'current compensation', 'current c.t.c'],
  'jobInfo.expectedCTC': ['expected ctc', 'expected salary', 'expecting ctc', 'expecting salary', 'desired salary', 'desired compensation', 'expected compensation', 'expected c.t.c'],
  'jobInfo.noticePeriod': ['notice period', 'notice', 'availability', 'joining date', 'how soon', 'earliest join', 'notice period (days)'],
  'jobInfo.preferredLocation': ['preferred location', 'desired location', 'work location preference', 'preferred work location', 'location preference']
};

// Heuristic matching logic
export function matchFieldHeuristically(
  field: ScannedFieldMetadata,
  profile: UserProfile,
  learningMappings: LearningMapping[]
): MatchResult | null {
  const label = (field.label || '').toLowerCase().trim();
  const placeholder = (field.placeholder || '').toLowerCase().trim();
  const ariaLabel = (field.ariaLabel || '').toLowerCase().trim();
  const name = (field.htmlName || '').toLowerCase().trim();
  const id = (field.htmlId || '').toLowerCase().trim();
  const surrounding = (field.surroundingText || '').toLowerCase().trim();

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

  return null;
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

// Gemini API Matcher
export async function matchFieldsWithGemini(
  fields: ScannedFieldMetadata[],
  profile: UserProfile,
  apiKey: string,
  modelName: string = 'gemini-1.5-flash'
): Promise<Record<string, MatchResult>> {
  const results: Record<string, MatchResult> = {};

  try {
    const profileFieldsSchema = {
      personal: {
        fullName: profile.personal.fullName,
        firstName: profile.personal.firstName,
        lastName: profile.personal.lastName,
        email: profile.personal.email,
        phone: profile.personal.phone,
        address: profile.personal.address,
        city: profile.personal.city,
        state: profile.personal.state,
        country: profile.personal.country,
        postalCode: profile.personal.postalCode
      },
      professional: {
        jobTitle: profile.professional.jobTitle,
        experience: profile.professional.experience,
        currentCompany: profile.professional.currentCompany,
        skills: profile.professional.skills,
        education: profile.professional.education,
        degree: profile.professional.degree,
        college: profile.professional.college,
        linkedin: profile.professional.linkedin,
        github: profile.professional.github,
        portfolio: profile.professional.portfolio
      },
      jobInfo: {
        currentCTC: profile.jobInfo.currentCTC,
        expectedCTC: profile.jobInfo.expectedCTC,
        noticePeriod: profile.jobInfo.noticePeriod,
        preferredLocation: profile.jobInfo.preferredLocation
      },
      customFields: profile.customFields.reduce((acc, field) => {
        acc[field.id] = { name: field.name, value: field.value };
        return acc;
      }, {} as Record<string, { name: string, value: string }>)
    };

    const prompt = `You are an AI assistant designed to map HTML form inputs to a user's profile information.
Below is the list of scanned form inputs (including checkboxes and radio buttons):
${JSON.stringify(fields.map(f => ({ scanId: f.scanId, type: f.type, label: f.label, placeholder: f.placeholder, ariaLabel: f.ariaLabel, name: f.htmlName, id: f.htmlId, surroundingText: f.surroundingText })), null, 2)}

Below is the user profile structure:
${JSON.stringify(profileFieldsSchema, null, 2)}

Task: Match each scanned form input to the most relevant profile field.
Rules:
1. Provide the mapping in JSON format.
2. The JSON keys should be the "scanId" of the inputs.
3. The value for each key should be an object: {"fieldPath": "path_string", "confidence": float_0_to_1}.
4. "fieldPath" must be formatted like "personal.fullName", "professional.skills", "jobInfo.currentCTC", etc., or "custom:customFieldId" for custom fields.
5. For checkbox or radio inputs representing agreements, consent, terms of service, or privacy policies (e.g. "I agree to the terms", "Privacy Policy", "Consent"), set fieldPath to "system.agreement" and confidence to 1.0.
6. If no field fits the form input, do not include it or set fieldPath to null.
7. Provide ONLY the raw JSON block without markdown formatting or code blocks.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API HTTP error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse response
    const rawMappings = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    
    for (const [scanId, match] of Object.entries(rawMappings)) {
      const m = match as { fieldPath: string | null; confidence: number };
      if (m.fieldPath && m.confidence > 0.4) {
        const val = getProfileValueByPath(profile, m.fieldPath);
        if (val !== undefined && val !== '') {
          results[scanId] = {
            fieldPath: m.fieldPath,
            confidence: m.confidence,
            matchedValue: val
          };
        }
      }
    }
  } catch (error) {
    console.error("Gemini API error, falling back to heuristics:", error);
  }

  return results;
}
