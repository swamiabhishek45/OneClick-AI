import {
  User,
  Briefcase,
  Settings,
  FileText,
  Plus,
  Trash2,
  Save,
  Award,
  Search,
  Settings2,
  HardDriveDownload,
  Sliders,
  GraduationCap,
  Star,
  Download,
  Upload,
} from 'lucide-react';
import {
  getProfiles,
  saveProfile,
  deleteProfile,
  getResumes,
  saveResume,
  setActiveProfileDocument,
  deleteProfileDocument,
  deleteProfileDocuments,
  getDocumentType,
  getManualMappings,
  deleteManualMapping,
  getAppSettings,
  saveAppSettings,
  getActiveProfileId,
  setActiveProfileId,
} from '../shared/db';
import {
  UserProfile,
  Resume,
  ManualMapping,
  AppSettings,
  EducationInfo,
  CustomField,
  CustomFieldSection,
  ProfessionalInfo,
  ProfileDocumentType,
} from '../shared/types';
import { ExtensionLogo } from '../shared/ExtensionLogo';
import { applyThemeSetting } from '../shared/theme';
import { SectionCustomFields } from './SectionCustomFields';
import {
  ProfileSection,
  ProfileField,
  profileSectionGridClass,
  profileInputClass,
  profileTextareaClass,
} from './ProfileFormUi';

import React, { useState, useEffect } from 'react';

const emptyEducation = (): EducationInfo => ({
  tenth: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
  twelfthOrDiploma: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
  ug: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
  pg: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
});

const emptyProfessional = (): ProfessionalInfo => ({
  jobTitle: '',
  experience: '',
  currentCompany: '',
  skills: '',
  education: '',
  degree: '',
  college: '',
  linkedin: '',
  github: '',
  portfolio: '',
  coverLetter: '',
});

const DOCUMENT_LABELS: Record<ProfileDocumentType, { title: string; empty: string }> = {
  resume: { title: 'Resumes', empty: 'No resumes uploaded yet.' },
  coverLetter: { title: 'Cover letters', empty: 'No cover letter files uploaded yet.' },
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function sendBackgroundMessage<T>(payload: object): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      reject(new Error('Extension runtime unavailable'));
      return;
    }
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(response as T);
    });
  });
}

export default function OptionsApp() {
  const [activeTab, setActiveTab] = useState<'profiles' | 'settings'>('profiles');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('default');
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [manualMappings, setManualMappings] = useState<ManualMapping[]>([]);
  const [appSettings, setAppSettingsState] = useState<AppSettings | null>(null);
  const [activeProfileIdState, setActiveProfileIdState] = useState('default');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [profileName, setProfileName] = useState('');
  const [personal, setPersonal] = useState({
    fullName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
  });
  const [professional, setProfessional] = useState<ProfessionalInfo>(emptyProfessional());
  const [jobInfo, setJobInfo] = useState({
    currentCTC: '',
    expectedCTC: '',
    noticePeriod: '',
    preferredLocation: '',
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [education, setEducation] = useState<EducationInfo>(emptyEducation());

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (appSettings?.theme) {
      applyThemeSetting(appSettings.theme);
    }
  }, [appSettings?.theme]);

  const loadAllData = async () => {
    try {
      const allProfiles = await getProfiles();
      setProfiles(allProfiles);

      const activeId = await getActiveProfileId();
      setActiveProfileIdState(activeId);

      const targetId = allProfiles.find((p) => p.id === activeId)
        ? activeId
        : allProfiles[0]?.id || 'default';
      setSelectedProfileId(targetId);
      loadProfileToForm(allProfiles.find((p) => p.id === targetId) || allProfiles[0]);

      setResumes(await getResumes());
      setManualMappings(await getManualMappings());
      setAppSettingsState(await getAppSettings());
      notifyDataUpdated();
    } catch (e) {
      console.error('Failed to load options data', e);
    }
  };

  const loadProfileToForm = (profile?: UserProfile) => {
    if (profile) {
      setProfileName(profile.name);
      setPersonal(profile.personal);
      setProfessional({ ...emptyProfessional(), ...profile.professional });
      setJobInfo(profile.jobInfo);
      setCustomFields(
        (profile.customFields || []).map((f) => ({
          ...f,
          section: f.section || 'personal',
        }))
      );
      setEducation(profile.education || emptyEducation());
    } else {
      setProfileName('New Profile');
      setPersonal({
        fullName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
      });
      setProfessional(emptyProfessional());
      setJobInfo({ currentCTC: '', expectedCTC: '', noticePeriod: '', preferredLocation: '' });
      setCustomFields([]);
      setEducation(emptyEducation());
    }
  };

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const notifyDataUpdated = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'notifyDataUpdated' }, () => {
        void chrome.runtime.lastError;
      });
    }
  };

  const handleProfileSelect = (id: string) => {
    setSelectedProfileId(id);
    loadProfileToForm(profiles.find((p) => p.id === id));
  };

  const handleCreateProfile = () => {
    const newId = Math.random().toString(36).substring(2);
    setSelectedProfileId(newId);
    loadProfileToForm();
  };

  const buildProfileFromForm = (): UserProfile => ({
    id: selectedProfileId,
    name: profileName,
    personal,
    professional,
    education,
    jobInfo,
    customFields: customFields
      .filter((f) => f.name.trim())
      .map((f) => ({ ...f, name: f.name.trim(), section: f.section || 'personal' })),
  });

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      showStatus('Profile name is required', 'error');
      return;
    }

    try {
      await saveProfile(buildProfileFromForm());
      showStatus('Profile saved successfully!');

      const allProfiles = await getProfiles();
      setProfiles(allProfiles);

      if (allProfiles.length === 1) {
        await setActiveProfileId(selectedProfileId);
        setActiveProfileIdState(selectedProfileId);
      }

      notifyDataUpdated();
    } catch {
      showStatus('Failed to save profile', 'error');
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (profiles.length <= 1) {
      showStatus('You must keep at least one profile', 'error');
      return;
    }

    if (confirm('Are you sure you want to delete this profile?')) {
      try {
        await deleteProfile(id);
        await deleteProfileDocuments(id);
        setResumes(await getResumes());
        showStatus('Profile deleted successfully!');

        const allProfiles = await getProfiles();
        setProfiles(allProfiles);

        if (id === activeProfileIdState) {
          const nextActive = allProfiles[0].id;
          await setActiveProfileId(nextActive);
          setActiveProfileIdState(nextActive);
        }

        const nextSelect = allProfiles[0].id;
        setSelectedProfileId(nextSelect);
        loadProfileToForm(allProfiles[0]);

        notifyDataUpdated();
      } catch {
        showStatus('Failed to delete profile', 'error');
      }
    }
  };

  const handleSetActiveProfile = async (id: string) => {
    try {
      await setActiveProfileId(id);
      setActiveProfileIdState(id);
      showStatus('Default active profile updated!');
      notifyDataUpdated();
    } catch {
      showStatus('Failed to set active profile', 'error');
    }
  };

  const handleAddCustomField = (section: CustomFieldSection) => {
    setCustomFields([
      ...customFields,
      { id: Math.random().toString(36).substring(2), name: '', value: '', section },
    ]);
  };

  const getCustomFieldGlobalIndex = (fieldId: string) =>
    customFields.findIndex((f) => f.id === fieldId);

  const handleCustomFieldChange = (index: number, key: 'name' | 'value', val: string) => {
    setCustomFields((prevFields) =>
      prevFields.map((field, idx) => (idx === index ? { ...field, [key]: val } : field))
    );
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields((prevFields) => prevFields.filter((_, idx) => idx !== index));
  };

  const isSelectedProfileSaved = profiles.some((p) => p.id === selectedProfileId);

  const getDocumentsFor = (documentType: ProfileDocumentType) =>
    resumes
      .filter((r) => r.profileId === selectedProfileId && getDocumentType(r) === documentType)
      .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));

  const handleDocumentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    documentType: ProfileDocumentType
  ) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    if (!isSelectedProfileSaved) {
      showStatus('Save this profile before uploading files', 'error');
      return;
    }

    try {
      let hasActive = getDocumentsFor(documentType).some((r) => r.isDefault);
      for (const file of files) {
        const base64Data = await readFileAsBase64(file);
        const doc: Resume = {
          id: Math.random().toString(36).substring(2),
          name: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          fileType: (file.name.split('.').pop() || 'pdf').toLowerCase(),
          base64Data,
          uploadedAt: new Date().toISOString(),
          profileId: selectedProfileId,
          documentType,
          isDefault: !hasActive,
        };
        await saveResume(doc);
        hasActive = true;
      }
      setResumes(await getResumes());
      showStatus(
        files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`
      );
      notifyDataUpdated();
    } catch {
      showStatus('Failed to save file', 'error');
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Delete this file?')) return;
    try {
      await deleteProfileDocument(id);
      setResumes(await getResumes());
      showStatus('File deleted');
      notifyDataUpdated();
    } catch {
      showStatus('Failed to delete file', 'error');
    }
  };

  const handleSetActiveDocument = async (id: string) => {
    try {
      await setActiveProfileDocument(id);
      setResumes(await getResumes());
      showStatus('Active file updated for autofill');
      notifyDataUpdated();
    } catch {
      showStatus('Failed to update active file', 'error');
    }
  };

  const handleDeleteManualMap = async (id: string) => {
    if (confirm('Remove manual mapping?')) {
      try {
        await deleteManualMapping(id);
        showStatus('Mapping removed!');
        setManualMappings(await getManualMappings());
        notifyDataUpdated();
      } catch {
        showStatus('Failed to delete mapping', 'error');
      }
    }
  };

  const handleSaveSettings = async () => {
    if (!appSettings) return;
    try {
      await saveAppSettings(appSettings);
      applyThemeSetting(appSettings.theme);
      showStatus('Settings saved successfully!');
    } catch {
      showStatus('Failed to save settings', 'error');
    }
  };

  const handleExportData = async () => {
    try {
      const res = await sendBackgroundMessage<{ bundle: unknown }>({ action: 'exportData' });
      const blob = new Blob([JSON.stringify(res.bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oneclick-autofill-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('Export downloaded');
    } catch {
      showStatus('Export failed', 'error');
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await sendBackgroundMessage<{ success: boolean }>({
          action: 'importData',
          json: reader.result as string,
        });
        showStatus('Import successful');
        await loadAllData();
        notifyDataUpdated();
      } catch {
        showStatus('Import failed', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearLearnedMappings = async () => {
    if (!confirm('Clear all learned field mappings?')) return;
    try {
      await sendBackgroundMessage({ action: 'clearLearnedMappings' });
      showStatus('Learned mappings cleared');
    } catch {
      showStatus('Failed to clear learned mappings', 'error');
    }
  };

  const filteredManualMappings = manualMappings.filter((m) =>
    m.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showAiCredentials =
    appSettings &&
    (appSettings.ai.provider === 'hybrid' || appSettings.ai.answerOpenQuestions !== false);

  return (
    <div className="flex h-screen ui-page overflow-hidden font-sans">
      <aside className="w-64 ui-sidebar border-r ui-border-subtle flex flex-col shrink-0 shadow-sm dark:shadow-none">
        <div>
          <div className="p-6 flex items-center gap-2.5 border-b ui-border-subtle">
            <div className="h-9 w-9 shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-cream border border-brand-800/15 dark:bg-brand-600/35 dark:border-brand-400/35">
              <ExtensionLogo variant="mark" className="h-[85%] w-[85%]" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-brand-800 dark:text-cream-100 tracking-wide">
                OneClick AI
              </h1>
              <p className="text-[10px] ui-caption uppercase tracking-widest font-semibold mt-0.5">
                Autofill Engine
              </p>
            </div>
          </div>

          <nav className="p-4 flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab('profiles')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'profiles' ? 'ui-nav-active' : 'ui-nav-idle border border-transparent'
              }`}
            >
              <User className="w-4 h-4" />
              Profiles
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'settings' ? 'ui-nav-active' : 'ui-nav-idle border border-transparent'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </nav>
        </div>
      </aside>

      <main className="flex-1 flex flex-col ui-page overflow-hidden relative">
        {statusMessage && (
          <div
            className={`absolute top-4 right-4 z-50 py-2 px-4 rounded-xl text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-top-3 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                : 'bg-rose-950 text-rose-300 border border-rose-800/50'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-64 border-r ui-profile-list-pane p-4 flex flex-col gap-3 justify-between">
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <h2 className="ui-section-label">Your Profiles</h2>
                  <button
                    onClick={handleCreateProfile}
                    className="p-1 rounded bg-brand-600 hover:bg-brand-500 transition text-white cursor-pointer"
                    title="Add new profile"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-200px)]">
                  {profiles.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleProfileSelect(p.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex justify-between items-center ${
                        selectedProfileId === p.id
                          ? 'bg-white border-brand-500/50 shadow-md shadow-brand-500/5 dark:bg-brand-800/55 dark:border-brand-400/40 dark:shadow-brand-950/40'
                          : 'bg-white/60 border-brand-800/15 hover:bg-white/85 dark:bg-brand-950/35 dark:border-brand-600/22 dark:hover:bg-brand-900/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-brand-800 dark:text-cream-100 truncate">
                          {p.name}
                        </p>
                        <p className="text-[10px] ui-muted truncate mt-0.5">
                          {p.personal.email || 'No email'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {activeProfileIdState === p.id ? (
                          <span className="ui-badge">Active</span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetActiveProfile(p.id);
                            }}
                            className="text-[9px] font-semibold ui-muted hover:text-brand-800 dark:hover:text-cream-100 hover:underline cursor-pointer"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(p.id);
                          }}
                          className="p-1 rounded ui-muted hover:text-rose-400 dark:hover:text-rose-300 transition cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] ui-muted text-center leading-relaxed">
                Create profiles for different roles or applications.
              </div>
            </div>

            <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 pb-4 border-b border-brand-800/20">
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Profile name"
                  className="w-full sm:max-w-md bg-transparent border-b-2 border-brand-800/20 hover:border-brand-500/50 focus:border-brand-500 text-xl font-bold focus:outline-none pb-2 text-brand-900 dark:text-cream-100 placeholder:text-brand-600/70 dark:placeholder:text-cream-100/45 dark:border-brand-600/40"
                />
                <button
                  onClick={handleSaveProfile}
                  className="bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold py-2.5 px-5 rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
                >
                  <Save className="w-4 h-4" />
                  Save Profile
                </button>
              </div>

              <div className="flex flex-col gap-8 max-w-5xl">
                <ProfileSection icon={User} title="Personal Information">
                  <div className={profileSectionGridClass}>
                    <ProfileField label="Full Name" span="full">
                      <input
                        type="text"
                        value={personal.fullName}
                        onChange={(e) => setPersonal({ ...personal, fullName: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="First Name">
                      <input
                        type="text"
                        value={personal.firstName}
                        onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Last Name">
                      <input
                        type="text"
                        value={personal.lastName}
                        onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Email Address">
                      <input
                        type="email"
                        value={personal.email}
                        onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Phone Number">
                      <input
                        type="tel"
                        value={personal.phone}
                        onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Street Address" span="full">
                      <input
                        type="text"
                        value={personal.address}
                        onChange={(e) => setPersonal({ ...personal, address: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="City">
                      <input
                        type="text"
                        value={personal.city}
                        onChange={(e) => setPersonal({ ...personal, city: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="State / Region">
                      <input
                        type="text"
                        value={personal.state}
                        onChange={(e) => setPersonal({ ...personal, state: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Country">
                      <input
                        type="text"
                        value={personal.country}
                        onChange={(e) => setPersonal({ ...personal, country: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Postal Code">
                      <input
                        type="text"
                        value={personal.postalCode}
                        onChange={(e) => setPersonal({ ...personal, postalCode: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <SectionCustomFields
                      section="personal"
                      fields={customFields}
                      onAdd={handleAddCustomField}
                      onChange={handleCustomFieldChange}
                      onRemove={handleRemoveCustomField}
                      getGlobalIndex={getCustomFieldGlobalIndex}
                    />
                  </div>
                </ProfileSection>

                <ProfileSection icon={Briefcase} title="Professional Details">
                  <div className={profileSectionGridClass}>
                    <ProfileField label="Job Title">
                      <input
                        type="text"
                        value={professional.jobTitle}
                        onChange={(e) =>
                          setProfessional({ ...professional, jobTitle: e.target.value })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Experience (Years)">
                      <input
                        type="text"
                        value={professional.experience}
                        onChange={(e) =>
                          setProfessional({ ...professional, experience: e.target.value })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Current Company">
                      <input
                        type="text"
                        value={professional.currentCompany}
                        onChange={(e) =>
                          setProfessional({ ...professional, currentCompany: e.target.value })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Degree">
                      <input
                        type="text"
                        value={professional.degree}
                        onChange={(e) =>
                          setProfessional({ ...professional, degree: e.target.value })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="College / University" span="full">
                      <input
                        type="text"
                        value={professional.college}
                        onChange={(e) =>
                          setProfessional({ ...professional, college: e.target.value })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="LinkedIn URL">
                      <input
                        type="url"
                        value={professional.linkedin}
                        onChange={(e) =>
                          setProfessional({ ...professional, linkedin: e.target.value })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="GitHub URL">
                      <input
                        type="url"
                        value={professional.github}
                        onChange={(e) =>
                          setProfessional({ ...professional, github: e.target.value })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Portfolio URL" span="full">
                      <input
                        type="url"
                        value={professional.portfolio}
                        onChange={(e) =>
                          setProfessional({ ...professional, portfolio: e.target.value })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Skills (comma-separated)" span="full">
                      <textarea
                        value={professional.skills}
                        onChange={(e) =>
                          setProfessional({ ...professional, skills: e.target.value })
                        }
                        rows={3}
                        className={profileTextareaClass}
                      />
                    </ProfileField>
                    <ProfileField label="Cover Letter (text)" span="full">
                      <textarea
                        value={professional.coverLetter || ''}
                        onChange={(e) =>
                          setProfessional({ ...professional, coverLetter: e.target.value })
                        }
                        rows={6}
                        placeholder="Pasted into cover letter text boxes on application forms"
                        className={profileTextareaClass}
                      />
                    </ProfileField>
                    <SectionCustomFields
                      section="professional"
                      fields={customFields}
                      onAdd={handleAddCustomField}
                      onChange={handleCustomFieldChange}
                      onRemove={handleRemoveCustomField}
                      getGlobalIndex={getCustomFieldGlobalIndex}
                    />
                  </div>
                </ProfileSection>

                <ProfileSection icon={GraduationCap} title="Education">
                  <div className={profileSectionGridClass}>
                    <ProfileField label="College / University" span="full">
                      <input
                        type="text"
                        value={education.ug.schoolOrCollege}
                        onChange={(e) =>
                          setEducation({
                            ...education,
                            ug: { ...education.ug, schoolOrCollege: e.target.value },
                          })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Degree">
                      <input
                        type="text"
                        value={education.ug.degree}
                        onChange={(e) =>
                          setEducation({
                            ...education,
                            ug: { ...education.ug, degree: e.target.value },
                          })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Major / Specialization">
                      <input
                        type="text"
                        value={education.ug.fieldOfStudy}
                        onChange={(e) =>
                          setEducation({
                            ...education,
                            ug: { ...education.ug, fieldOfStudy: e.target.value },
                          })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Passing Year">
                      <input
                        type="text"
                        value={education.ug.passingYear}
                        onChange={(e) =>
                          setEducation({
                            ...education,
                            ug: { ...education.ug, passingYear: e.target.value },
                          })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Grade / CGPA / %">
                      <input
                        type="text"
                        value={education.ug.grade}
                        onChange={(e) =>
                          setEducation({
                            ...education,
                            ug: { ...education.ug, grade: e.target.value },
                          })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <SectionCustomFields
                      section="education"
                      fields={customFields}
                      onAdd={handleAddCustomField}
                      onChange={handleCustomFieldChange}
                      onRemove={handleRemoveCustomField}
                      getGlobalIndex={getCustomFieldGlobalIndex}
                    />
                  </div>
                </ProfileSection>

                <ProfileSection icon={Award} title="Compensation & Notice">
                  <div className={profileSectionGridClass}>
                    <ProfileField label="Current CTC">
                      <input
                        type="text"
                        value={jobInfo.currentCTC}
                        onChange={(e) => setJobInfo({ ...jobInfo, currentCTC: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Expected CTC">
                      <input
                        type="text"
                        value={jobInfo.expectedCTC}
                        onChange={(e) => setJobInfo({ ...jobInfo, expectedCTC: e.target.value })}
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <ProfileField label="Notice Period">
                      <input
                        type="text"
                        value={jobInfo.noticePeriod}
                        onChange={(e) => setJobInfo({ ...jobInfo, noticePeriod: e.target.value })}
                        className={profileInputClass}
                        placeholder="e.g. 30 Days"
                      />
                    </ProfileField>
                    <ProfileField label="Preferred Location">
                      <input
                        type="text"
                        value={jobInfo.preferredLocation}
                        onChange={(e) =>
                          setJobInfo({ ...jobInfo, preferredLocation: e.target.value })
                        }
                        className={profileInputClass}
                      />
                    </ProfileField>
                    <SectionCustomFields
                      section="jobInfo"
                      fields={customFields}
                      onAdd={handleAddCustomField}
                      onChange={handleCustomFieldChange}
                      onRemove={handleRemoveCustomField}
                      getGlobalIndex={getCustomFieldGlobalIndex}
                    />
                  </div>
                </ProfileSection>

                <ProfileSection icon={FileText} title="Resume & Cover Letter Files">
                  {!isSelectedProfileSaved && (
                    <p className="ui-caption mb-3">Save this profile first to attach files to it.</p>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {(['resume', 'coverLetter'] as ProfileDocumentType[]).map((documentType) => {
                      const docs = getDocumentsFor(documentType);
                      const { title, empty } = DOCUMENT_LABELS[documentType];
                      return (
                        <div key={documentType} className="flex flex-col gap-3 min-w-0">
                          <h4 className="ui-section-label">{title}</h4>
                          <div className="ui-dropzone p-6 text-center flex flex-col items-center justify-center gap-2 relative">
                            <HardDriveDownload className="w-8 h-8 text-brand-400" />
                            <p className="text-xs font-semibold text-brand-800 dark:text-cream-100">
                              Upload {documentType === 'resume' ? 'resume' : 'cover letter'} PDF/DOCX
                            </p>
                            <p className="ui-caption">
                              Add several files, then choose which one is active for autofill.
                            </p>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              multiple
                              disabled={!isSelectedProfileSaved}
                              onChange={(e) => void handleDocumentUpload(e, documentType)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            {docs.map((r) => (
                              <div
                                key={r.id}
                                className="ui-panel rounded-xl p-3 flex justify-between items-center"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-9 w-9 rounded-lg bg-brand-100 dark:bg-brand-700/45 border border-brand-300/50 dark:border-brand-500/40 flex items-center justify-center text-[10px] font-bold text-brand-700 dark:text-cream-100 uppercase shrink-0">
                                    {r.fileType}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold ui-heading truncate" title={r.fileName}>
                                      {r.name}
                                    </p>
                                    <p className="ui-caption mt-0.5">
                                      Uploaded {new Date(r.uploadedAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  {r.isDefault ? (
                                    <span className="ui-badge flex items-center gap-1">
                                      <Star className="w-3 h-3 fill-brand-400" />
                                      Active
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => void handleSetActiveDocument(r.id)}
                                      className="text-[9px] font-semibold ui-muted hover:text-brand-700 dark:hover:text-cream-100 hover:underline cursor-pointer flex items-center gap-1"
                                    >
                                      <Star className="w-3 h-3" />
                                      Set active
                                    </button>
                                  )}
                                  <button
                                    onClick={() => void handleDeleteDocument(r.id)}
                                    title="Delete file"
                                    className="ui-icon-btn hover:text-rose-500 dark:hover:text-rose-300 ml-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            {docs.length === 0 && (
                              <div className="text-center py-5 ui-panel-soft rounded-xl ui-empty">
                                {empty}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ProfileSection>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && appSettings && (
          <div className="p-8 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col gap-6">
            <div className="pb-4 border-b ui-border-subtle">
              <h2 className="ui-page-title">Settings</h2>
              <p className="text-xs ui-muted mt-1">
                AI matching, site access, and data stored locally in this browser.
              </p>
            </div>

            <div className="ui-panel p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b ui-border-subtle pb-2">
                <Settings2 className="w-4.5 h-4.5 text-brand-500 dark:text-brand-300" />
                <h3 className="ui-section-title">AI Matcher</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  onClick={() =>
                    setAppSettingsState({
                      ...appSettings,
                      ai: { ...appSettings.ai, provider: 'heuristic', answerOpenQuestions: false },
                    })
                  }
                  className={`ui-choice-card cursor-pointer ${
                    appSettings.ai.provider === 'heuristic' ? 'ui-choice-card-active' : ''
                  }`}
                >
                  <p className="ui-choice-card-title">Offline (heuristic)</p>
                  <p className="ui-choice-card-desc">
                    Local keyword and custom-field matching only. No API calls.
                  </p>
                </div>

                <div
                  onClick={() =>
                    setAppSettingsState({
                      ...appSettings,
                      ai: { ...appSettings.ai, provider: 'hybrid' },
                    })
                  }
                  className={`ui-choice-card cursor-pointer ${
                    appSettings.ai.provider === 'hybrid' ? 'ui-choice-card-active' : ''
                  }`}
                >
                  <p className="ui-choice-card-title">Smart (hybrid)</p>
                  <p className="ui-choice-card-desc">
                    Offline match first, then Gemini for unmatched fields and open questions.
                  </p>
                </div>
              </div>

              {showAiCredentials && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold ui-label uppercase mb-1">
                      Google Gemini API Key
                    </label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={appSettings.ai.geminiApiKey}
                      onChange={(e) =>
                        setAppSettingsState({
                          ...appSettings,
                          ai: { ...appSettings.ai, geminiApiKey: e.target.value },
                        })
                      }
                      className="w-full ui-input rounded-lg p-2 text-xs"
                    />
                    <p className="text-[10px] ui-muted mt-1">Stored locally in this browser.</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold ui-label uppercase mb-1">
                      Model
                    </label>
                    <select
                      value={appSettings.ai.geminiModel}
                      onChange={(e) =>
                        setAppSettingsState({
                          ...appSettings,
                          ai: { ...appSettings.ai, geminiModel: e.target.value },
                        })
                      }
                      className="w-full ui-input rounded-lg p-2 text-xs"
                    >
                      <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-3 justify-center">
                    <label className="flex items-center gap-2 text-xs text-brand-800 dark:text-cream-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={appSettings.ai.answerOpenQuestions !== false}
                        onChange={(e) =>
                          setAppSettingsState({
                            ...appSettings,
                            ai: { ...appSettings.ai, answerOpenQuestions: e.target.checked },
                          })
                        }
                        className="rounded border-brand-700/30 dark:border-brand-400/40 dark:bg-brand-950"
                      />
                      AI answers for open-ended questions
                    </label>
                    <label className="flex items-center gap-2 text-xs text-brand-800 dark:text-cream-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={appSettings.ai.useJobDescriptionContext !== false}
                        onChange={(e) =>
                          setAppSettingsState({
                            ...appSettings,
                            ai: {
                              ...appSettings.ai,
                              useJobDescriptionContext: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-brand-700/30 dark:border-brand-400/40 dark:bg-brand-950"
                      />
                      Use job description from the page
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold ui-label uppercase mb-1">
                      Application memory &amp; context
                    </label>
                    <textarea
                      rows={6}
                      maxLength={8000}
                      placeholder="Projects you are proud of, why you apply, visa/work auth notes, salary narrative, talking points Gemini should use…"
                      value={appSettings.ai.applicationMemory ?? ''}
                      onChange={(e) =>
                        setAppSettingsState({
                          ...appSettings,
                          ai: {
                            ...appSettings.ai,
                            applicationMemory: e.target.value.slice(0, 8000),
                          },
                        })
                      }
                      className="w-full ui-input rounded-lg p-2 text-xs resize-y min-h-[120px]"
                    />
                    <p className="text-[10px] ui-muted mt-1">
                      Used with your profile and job description for open-ended questions. Gemini
                      should only cite facts from here, your profile, or the JD—not invented
                      employers or credentials.
                    </p>
                    {appSettings.ai.provider === 'hybrid' &&
                      appSettings.ai.answerOpenQuestions !== false &&
                      !(appSettings.ai.applicationMemory ?? '').trim() && (
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">
                          Tip: fill this in for better answers; otherwise Gemini may skip or stay
                          generic.
                        </p>
                      )}
                  </div>
                </div>
              )}
            </div>

            <div className="ui-panel p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b ui-border-subtle pb-2">
                <Sliders className="w-4.5 h-4.5 text-brand-500 dark:text-brand-300" />
                <h3 className="ui-section-title">General</h3>
              </div>

              <div>
                <label className="block text-[10px] font-semibold ui-label uppercase mb-1">
                  Theme
                </label>
                <select
                  value={appSettings.theme}
                  onChange={(e) => {
                    const theme = e.target.value as AppSettings['theme'];
                    setAppSettingsState({ ...appSettings, theme });
                    applyThemeSetting(theme);
                    void getAppSettings().then((stored) =>
                      saveAppSettings({ ...stored, theme })
                    );
                  }}
                  className="w-full max-w-xs ui-input rounded-lg p-2 text-xs"
                >
                  <option value="light">Light theme</option>
                  <option value="dark">Dark theme</option>
                  <option value="system">Match system</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-brand-800 dark:text-cream-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appSettings.learnFromCorrections !== false}
                  onChange={(e) =>
                    setAppSettingsState({
                      ...appSettings,
                      learnFromCorrections: e.target.checked,
                    })
                  }
                  className="rounded border-brand-700/30 dark:border-brand-400/40 dark:bg-brand-950"
                />
                Learn from field corrections
              </label>

              <label className="flex items-center gap-2 text-xs text-brand-800 dark:text-cream-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appSettings.autoFillOnLoad === true}
                  onChange={(e) =>
                    setAppSettingsState({
                      ...appSettings,
                      autoFillOnLoad: e.target.checked,
                    })
                  }
                  className="rounded border-brand-700/30 dark:border-brand-400/40 dark:bg-brand-950"
                />
                Auto-fill empty fields when a page loads (allowed sites only)
              </label>

              <div>
                <label className="block text-[10px] font-semibold ui-label uppercase mb-1">
                  Site allowlist
                </label>
                <textarea
                  rows={4}
                  placeholder="One domain per line (leave empty for all sites)&#10;greenhouse.io&#10;lever.co"
                  value={appSettings.siteAllowlist.join('\n')}
                  onChange={(e) =>
                    setAppSettingsState({
                      ...appSettings,
                      siteAllowlist: e.target.value
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean),
                    })
                  }
                  className={`${profileTextareaClass} w-full font-mono text-[11px]`}
                />
                <p className="text-[10px] ui-muted mt-1">
                  When empty, autofill is allowed on all sites.
                </p>
              </div>
            </div>

            <div className="ui-panel p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b ui-border-subtle pb-2">
                <h3 className="ui-section-title">Manual field mappings</h3>
                <div className="relative">
                  <Search className="w-4 h-4 text-brand-600/50 dark:text-cream-100/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search domain..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ui-input rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none w-52"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredManualMappings.map((m) => (
                  <div
                    key={m.id}
                    className="ui-panel-soft rounded-xl p-4 flex justify-between items-start gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold ui-heading">{m.domain}</p>
                      <p className="text-[10px] ui-muted mt-1.5 font-mono truncate bg-cream-50/80 dark:bg-brand-950/55 p-1.5 rounded border ui-border-subtle">
                        {m.selector}
                      </p>
                      <p className="text-[10px] text-brand-400 mt-1 font-semibold">
                        Maps to: {m.fieldPath}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteManualMap(m.id)}
                      className="ui-icon-btn hover:text-rose-500 dark:hover:text-rose-300 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {filteredManualMappings.length === 0 && (
                  <div className="col-span-2 text-center py-8 ui-panel-soft rounded-xl ui-empty">
                    No manual mappings. Use Manual Map on the page widget.
                  </div>
                )}
              </div>
            </div>

            <div className="ui-panel p-5 rounded-2xl flex flex-col gap-4">
              <h3 className="ui-section-title border-b ui-border-subtle pb-2">Data</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleExportData}
                  className="ui-input hover:bg-brand-600/15 dark:hover:bg-brand-500/20 py-2 px-4 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export profiles & resumes
                </button>
                <label className="ui-input hover:bg-brand-600/15 dark:hover:bg-brand-500/20 py-2 px-4 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Import JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportData}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleClearLearnedMappings}
                  className="ui-input hover:bg-rose-500/10 py-2 px-4 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 text-rose-600 dark:text-rose-300"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear learned mappings
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t ui-border-subtle pt-4">
              <button
                onClick={handleSaveSettings}
                className="bg-brand-600 hover:bg-brand-500 text-cream-100 text-xs font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-brand-600/20 dark:shadow-brand-950/60 transition cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
