import { 
  User, Briefcase, Settings, History, FileText, Plus, Trash2, 
  Save, CheckCircle, Database, ShieldAlert, Award, FileCode, Search, Copy, 
  Settings2, HelpCircle, HardDriveDownload, CloudLightning, ArrowUpRight, Sliders, GraduationCap,
  Key, Eye, EyeOff, Star
} from 'lucide-react';
import { 
  getProfiles, saveProfile, deleteProfile,
  getResumes, saveResume, deleteResume,
  getTemplates, deleteTemplate,
  getManualMappings, deleteManualMapping,
  getHistory, clearHistory,
  getAppSettings, saveAppSettings, getActiveProfileId, setActiveProfileId,
  getCredentials, deleteCredential
} from '../shared/db';
import {
  UserProfile,
  Resume,
  WebsiteTemplate,
  ManualMapping,
  FillHistoryEntry,
  AppSettings,
  EducationInfo,
  SavedCredential,
  CustomField,
  CustomFieldSection,
} from '../shared/types';
import { ExtensionLogo } from '../shared/ExtensionLogo';
import { applyThemeSetting } from '../shared/theme';
import type { AppSettings as AppSettingsType } from '../shared/types';
import { SectionCustomFields } from './SectionCustomFields';
import {
  ProfileSection,
  ProfileField,
  EducationSubBlock,
  profileSectionGridClass,
  profileInputClass,
  profileTextareaClass,
} from './ProfileFormUi';

import React, { useState, useEffect } from 'react';

export default function OptionsApp() {
  const [activeTab, setActiveTab] = useState<'profiles' | 'resumes' | 'templates' | 'history' | 'settings' | 'credentials'>('profiles');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('default');
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [templates, setTemplates] = useState<WebsiteTemplate[]>([]);
  const [manualMappings, setManualMappings] = useState<ManualMapping[]>([]);
  const [history, setHistory] = useState<FillHistoryEntry[]>([]);
  const [appSettings, setAppSettingsState] = useState<AppSettings | null>(null);
  const [activeProfileIdState, setActiveProfileIdState] = useState('default');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [credentials, setCredentials] = useState<SavedCredential[]>([]);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Profile Form states
  const [profileName, setProfileName] = useState('');
  const [personal, setPersonal] = useState({
    fullName: '', firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', country: '', postalCode: ''
  });
  const [professional, setProfessional] = useState({
    jobTitle: '', experience: '', currentCompany: '', skills: '',
    education: '', degree: '', college: '', linkedin: '', github: '', portfolio: ''
  });
  const [jobInfo, setJobInfo] = useState({
    currentCTC: '', expectedCTC: '', noticePeriod: '', preferredLocation: ''
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [education, setEducation] = useState<EducationInfo>({
    tenth: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
    twelfthOrDiploma: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
    ug: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
    pg: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
  });

  // Search filter for templates and mappings
  const [searchQuery, setSearchQuery] = useState('');

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
      
      // Default to active profile or first profile
      const targetId = allProfiles.find(p => p.id === activeId) ? activeId : (allProfiles[0]?.id || 'default');
      setSelectedProfileId(targetId);
      loadProfileToForm(allProfiles.find(p => p.id === targetId) || allProfiles[0]);

      const allResumes = await getResumes();
      setResumes(allResumes);

      const allTemplates = await getTemplates();
      setTemplates(allTemplates);

      const allMappings = await getManualMappings();
      setManualMappings(allMappings);

      const allHistory = await getHistory();
      setHistory(allHistory);

      const settings = await getAppSettings();
      setAppSettingsState(settings);

      const allCreds = await getCredentials();
      setCredentials(allCreds);
    } catch (e) {
      console.error("Failed to load options data", e);
    }
  };

  const loadProfileToForm = (profile?: UserProfile) => {
    if (profile) {
      setProfileName(profile.name);
      setPersonal(profile.personal);
      setProfessional(profile.professional);
      setJobInfo(profile.jobInfo);
      setCustomFields(
        (profile.customFields || []).map((f) => ({
          ...f,
          section: f.section || 'personal',
        }))
      );
      setEducation(profile.education || {
        tenth: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
        twelfthOrDiploma: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
        ug: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
        pg: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
      });
    } else {
      setProfileName('New Profile');
      setPersonal({ fullName: '', firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', country: '', postalCode: '' });
      setProfessional({ jobTitle: '', experience: '', currentCompany: '', skills: '', education: '', degree: '', college: '', linkedin: '', github: '', portfolio: '' });
      setJobInfo({ currentCTC: '', expectedCTC: '', noticePeriod: '', preferredLocation: '' });
      setCustomFields([]);
      setEducation({
        tenth: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
        twelfthOrDiploma: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
        ug: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
        pg: { schoolOrCollege: '', degree: '', fieldOfStudy: '', passingYear: '', grade: '' },
      });
    }
  };

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Profile Management Actions
  const handleProfileSelect = (id: string) => {
    setSelectedProfileId(id);
    const prof = profiles.find(p => p.id === id);
    loadProfileToForm(prof);
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
      showStatus("Profile name is required", "error");
      return;
    }

    try {
      await saveProfile(buildProfileFromForm());
      showStatus("Profile saved successfully!");

      const allProfiles = await getProfiles();
      setProfiles(allProfiles);

      if (allProfiles.length === 1) {
        await setActiveProfileId(selectedProfileId);
        setActiveProfileIdState(selectedProfileId);
      }

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'notifyDataUpdated' });
      }
    } catch (e) {
      showStatus("Failed to save profile", "error");
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (profiles.length <= 1) {
      showStatus("You must keep at least one profile", "error");
      return;
    }

    if (confirm("Are you sure you want to delete this profile?")) {
      try {
        await deleteProfile(id);
        showStatus("Profile deleted successfully!");
        
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

        // Notify other parts of the extension
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'notifyDataUpdated' });
        }
      } catch (e) {
        showStatus("Failed to delete profile", "error");
      }
    }
  };

  const handleSetActiveProfile = async (id: string) => {
    try {
      await setActiveProfileId(id);
      setActiveProfileIdState(id);
      showStatus("Default active profile updated!");
      
      // Notify other parts of the extension
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'notifyDataUpdated' });
      }
    } catch (e) {
      showStatus("Failed to set active profile", "error");
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
    setCustomFields(prevFields =>
      prevFields.map((field, idx) =>
        idx === index ? { ...field, [key]: val } : field
      )
    );
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(prevFields => prevFields.filter((_, idx) => idx !== index));
  };

  // Resume Upload Actions
  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const newResume: Resume = {
          id: Math.random().toString(36).substring(2),
          name: file.name.split('.')[0],
          fileName: file.name,
          fileType: file.name.split('.').pop() || 'pdf',
          base64Data,
          uploadedAt: new Date().toISOString(),
          isDefault: resumes.length === 0
        };

        await saveResume(newResume);
        showStatus("Resume uploaded successfully!");
        
        const allResumes = await getResumes();
        setResumes(allResumes);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'notifyDataUpdated' });
        }
      } catch (err) {
        showStatus("Failed to save resume", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteResume = async (id: string) => {
    if (confirm("Delete this resume?")) {
      try {
        await deleteResume(id);
        showStatus("Resume deleted successfully!");
        const allResumes = await getResumes();
        setResumes(allResumes);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'notifyDataUpdated' });
        }
      } catch (e) {
        showStatus("Failed to delete resume", "error");
      }
    }
  };

  // Template & Mappings Management
  const handleDeleteTemplate = async (id: string) => {
    if (confirm("Delete template rule?")) {
      try {
        await deleteTemplate(id);
        showStatus("Template removed!");
        const allTemplates = await getTemplates();
        setTemplates(allTemplates);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'notifyDataUpdated' });
        }
      } catch (e) {
        showStatus("Failed to delete template", "error");
      }
    }
  };

  const handleDeleteManualMap = async (id: string) => {
    if (confirm("Remove manual mapping?")) {
      try {
        await deleteManualMapping(id);
        showStatus("Mapping removed!");
        const allMappings = await getManualMappings();
        setManualMappings(allMappings);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'notifyDataUpdated' });
        }
      } catch (e) {
        showStatus("Failed to delete mapping", "error");
      }
    }
  };

  // History Operations
  const handleClearHistory = async () => {
    if (confirm("Clear all form fill history?")) {
      try {
        await clearHistory();
        showStatus("History cleared successfully!");
        const allHistory = await getHistory();
        setHistory(allHistory);
      } catch (e) {
        showStatus("Failed to clear history", "error");
      }
    }
  };

  // Settings Actions
  const handleSaveSettings = async () => {
    if (!appSettings) return;
    try {
      await saveAppSettings(appSettings);
      applyThemeSetting(appSettings.theme);
      showStatus("Settings saved successfully!");
    } catch (e) {
      showStatus("Failed to save settings", "error");
    }
  };

  const handleSetDefaultResume = async (id: string) => {
    try {
      const updated = resumes.map(r => ({
        ...r,
        isDefault: r.id === id
      }));
      for (const r of updated) {
        await saveResume(r);
      }
      setResumes(updated);
      showStatus("Default resume updated!");
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'notifyDataUpdated' });
      }
    } catch (err) {
      showStatus("Failed to update default resume", "error");
    }
  };

  const handleDeleteCredential = async (id: string) => {
    if (confirm("Delete this saved password?")) {
      try {
        await deleteCredential(id);
        showStatus("Credential deleted successfully!");
        const allCreds = await getCredentials();
        setCredentials(allCreds);
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'notifyDataUpdated' });
        }
      } catch (err) {
        showStatus("Failed to delete credential", "error");
      }
    }
  };

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ profiles, resumes, templates, manualMappings, appSettings }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "oneclick_autofill_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.profiles && Array.isArray(data.profiles)) {
          for (const p of data.profiles) {
            await saveProfile(p);
          }
        }
        if (data.appSettings) {
          await saveAppSettings(data.appSettings);
        }
        showStatus("Data imported successfully!");
        loadAllData();
      } catch (err) {
        showStatus("Invalid backup file", "error");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen ui-page overflow-hidden font-sans">
      {/* Sidebar Panel */}
      <aside className="w-64 ui-sidebar border-r flex flex-col justify-between shrink-0 shadow-sm">
        <div>
          {/* Logo Branding */}
          <div className="p-6 flex items-center gap-2.5 border-b border-brand-800/15">
            <div className="h-9 w-9 rounded-xl overflow-hidden shadow-lg shadow-brand-500/20 ring-1 ring-brand-500/25 shrink-0">
              <ExtensionLogo variant="mark" className="h-9 w-9" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-brand-800 tracking-wide">OneClick AI</h1>
              <p className="text-[10px] text-brand-700/65 uppercase tracking-widest font-semibold mt-0.5">Autofill Engine</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab('profiles')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'profiles' 
                  ? 'ui-nav-active' 
                  : 'ui-nav-idle border border-transparent'
              }`}
            >
              <User className="w-4 h-4" />
              User Profiles
            </button>

            <button
              onClick={() => setActiveTab('resumes')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'resumes' 
                  ? 'ui-nav-active' 
                  : 'ui-nav-idle border border-transparent'
              }`}
            >
              <FileText className="w-4 h-4" />
              Resume Manager
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'templates' 
                  ? 'ui-nav-active' 
                  : 'ui-nav-idle border border-transparent'
              }`}
            >
              <FileCode className="w-4 h-4" />
              Templates & Mapping
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'history' 
                  ? 'ui-nav-active' 
                  : 'ui-nav-idle border border-transparent'
              }`}
            >
              <History className="w-4 h-4" />
              Fill Analytics
            </button>

            <button
              onClick={() => setActiveTab('credentials')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'credentials' 
                  ? 'ui-nav-active' 
                  : 'ui-nav-idle border border-transparent'
              }`}
            >
              <Key className="w-4 h-4" />
              Passwords Vault
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'settings' 
                  ? 'ui-nav-active' 
                  : 'ui-nav-idle border border-transparent'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings & AI
            </button>
          </nav>
        </div>

        {/* Database Stats */}
        <div className="p-4 border-t border-brand-800/15 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-brand-700/65 text-[10px] uppercase font-bold tracking-wider">
            <Database className="w-3.5 h-3.5" />
            <span>Storage Status</span>
          </div>
          <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-brand-800/15">
            <div className="text-[10px] text-brand-700/75">
              <p className="font-semibold">{profiles.length} Profiles</p>
              <p className="mt-0.5 text-brand-700/65">{resumes.length} Resumes</p>
            </div>
            <div className="text-[10px] text-emerald-400 font-medium bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800/40">
              Encrypted
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col ui-page overflow-hidden relative">
        {/* Top Status Alert */}
        {statusMessage && (
          <div className={`absolute top-4 right-4 z-50 py-2 px-4 rounded-xl text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-top-3 ${
            statusMessage.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50' : 'bg-rose-950 text-rose-300 border border-rose-800/50'
          }`}>
            {statusMessage.text}
          </div>
        )}

        {/* Tab - Profiles */}
        {activeTab === 'profiles' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Profiles List Sidebar */}
            <div className="w-64 border-r border-brand-800/15 bg-cream-200/50 p-4 flex flex-col gap-3 justify-between">
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-brand-700/75">Your Profiles</h2>
                  <button 
                    onClick={handleCreateProfile}
                    className="p-1 rounded bg-brand-600 hover:bg-brand-500 transition text-white cursor-pointer"
                    title="Add new profile"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-200px)]">
                  {profiles.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => handleProfileSelect(p.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex justify-between items-center ${
                        selectedProfileId === p.id 
                          ? 'bg-white border-brand-500/50 shadow-md shadow-brand-500/5' 
                          : 'bg-white/60 border-brand-800/15 hover:bg-white/85'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-brand-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-brand-700/65 truncate mt-0.5">{p.personal.email || 'No email'}</p>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {activeProfileIdState === p.id ? (
                          <span className="text-[9px] font-semibold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded border border-brand-800/40">Active</span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSetActiveProfile(p.id); }}
                            className="text-[9px] font-semibold text-brand-700/65 hover:text-brand-800 hover:underline cursor-pointer"
                          >
                            Set Active
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }}
                          className="p-1 rounded text-brand-700/65 hover:text-rose-400 transition cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-brand-700/65 text-center leading-relaxed">
                Choose a profile or create multiple templates to map data per role/purpose.
              </div>
            </div>

            {/* Profile Form Editor */}
            <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 pb-4 border-b border-brand-800/20">
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Profile name"
                  className="w-full sm:max-w-md bg-transparent border-b-2 border-brand-800/20 hover:border-brand-500/50 focus:border-brand-500 text-xl font-bold focus:outline-none pb-2 text-brand-900 placeholder:text-brand-600/70"
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
                      <input type="text" value={personal.fullName} onChange={(e) => setPersonal({ ...personal, fullName: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="First Name">
                      <input type="text" value={personal.firstName} onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Last Name">
                      <input type="text" value={personal.lastName} onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Email Address">
                      <input type="email" value={personal.email} onChange={(e) => setPersonal({ ...personal, email: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Phone Number">
                      <input type="tel" value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Street Address" span="full">
                      <input type="text" value={personal.address} onChange={(e) => setPersonal({ ...personal, address: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="City">
                      <input type="text" value={personal.city} onChange={(e) => setPersonal({ ...personal, city: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="State / Region">
                      <input type="text" value={personal.state} onChange={(e) => setPersonal({ ...personal, state: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Country">
                      <input type="text" value={personal.country} onChange={(e) => setPersonal({ ...personal, country: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Postal Code">
                      <input type="text" value={personal.postalCode} onChange={(e) => setPersonal({ ...personal, postalCode: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <SectionCustomFields section="personal" fields={customFields} onAdd={handleAddCustomField} onChange={handleCustomFieldChange} onRemove={handleRemoveCustomField} getGlobalIndex={getCustomFieldGlobalIndex} />
                  </div>
                </ProfileSection>

                <ProfileSection icon={Briefcase} title="Professional Details">
                  <div className={profileSectionGridClass}>
                    <ProfileField label="Job Title">
                      <input type="text" value={professional.jobTitle} onChange={(e) => setProfessional({ ...professional, jobTitle: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Experience (Years)">
                      <input type="text" value={professional.experience} onChange={(e) => setProfessional({ ...professional, experience: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Current Company">
                      <input type="text" value={professional.currentCompany} onChange={(e) => setProfessional({ ...professional, currentCompany: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Degree">
                      <input type="text" value={professional.degree} onChange={(e) => setProfessional({ ...professional, degree: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="College / University" span="full">
                      <input type="text" value={professional.college} onChange={(e) => setProfessional({ ...professional, college: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="LinkedIn URL">
                      <input type="url" value={professional.linkedin} onChange={(e) => setProfessional({ ...professional, linkedin: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="GitHub URL">
                      <input type="url" value={professional.github} onChange={(e) => setProfessional({ ...professional, github: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Portfolio URL" span="full">
                      <input type="url" value={professional.portfolio} onChange={(e) => setProfessional({ ...professional, portfolio: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Skills (comma-separated)" span="full">
                      <textarea value={professional.skills} onChange={(e) => setProfessional({ ...professional, skills: e.target.value })} rows={3} className={profileTextareaClass} />
                    </ProfileField>
                    <SectionCustomFields section="professional" fields={customFields} onAdd={handleAddCustomField} onChange={handleCustomFieldChange} onRemove={handleRemoveCustomField} getGlobalIndex={getCustomFieldGlobalIndex} />
                  </div>
                </ProfileSection>

                <ProfileSection icon={GraduationCap} title="Educational Details">
                  <div className="flex flex-col gap-4">
                    <EducationSubBlock title="10th Standard / Matriculation">
                      <ProfileField label="School Name" span="full">
                        <input type="text" value={education.tenth.schoolOrCollege} onChange={(e) => setEducation({ ...education, tenth: { ...education.tenth, schoolOrCollege: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Board / Degree">
                        <input type="text" value={education.tenth.degree} onChange={(e) => setEducation({ ...education, tenth: { ...education.tenth, degree: e.target.value } })} className={profileInputClass} placeholder="e.g. CBSE" />
                      </ProfileField>
                      <ProfileField label="Passing Year">
                        <input type="text" value={education.tenth.passingYear} onChange={(e) => setEducation({ ...education, tenth: { ...education.tenth, passingYear: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Grade / CGPA / %">
                        <input type="text" value={education.tenth.grade} onChange={(e) => setEducation({ ...education, tenth: { ...education.tenth, grade: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                    </EducationSubBlock>

                    <EducationSubBlock title="12th / Diploma / Intermediate">
                      <ProfileField label="School / College" span="full">
                        <input type="text" value={education.twelfthOrDiploma.schoolOrCollege} onChange={(e) => setEducation({ ...education, twelfthOrDiploma: { ...education.twelfthOrDiploma, schoolOrCollege: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Board / Degree">
                        <input type="text" value={education.twelfthOrDiploma.degree} onChange={(e) => setEducation({ ...education, twelfthOrDiploma: { ...education.twelfthOrDiploma, degree: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Stream / Field">
                        <input type="text" value={education.twelfthOrDiploma.fieldOfStudy} onChange={(e) => setEducation({ ...education, twelfthOrDiploma: { ...education.twelfthOrDiploma, fieldOfStudy: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Passing Year">
                        <input type="text" value={education.twelfthOrDiploma.passingYear} onChange={(e) => setEducation({ ...education, twelfthOrDiploma: { ...education.twelfthOrDiploma, passingYear: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Grade / CGPA / %">
                        <input type="text" value={education.twelfthOrDiploma.grade} onChange={(e) => setEducation({ ...education, twelfthOrDiploma: { ...education.twelfthOrDiploma, grade: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                    </EducationSubBlock>

                    <EducationSubBlock title="Undergraduate (UG)">
                      <ProfileField label="College / University" span="full">
                        <input type="text" value={education.ug.schoolOrCollege} onChange={(e) => setEducation({ ...education, ug: { ...education.ug, schoolOrCollege: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Degree">
                        <input type="text" value={education.ug.degree} onChange={(e) => setEducation({ ...education, ug: { ...education.ug, degree: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Major / Specialization">
                        <input type="text" value={education.ug.fieldOfStudy} onChange={(e) => setEducation({ ...education, ug: { ...education.ug, fieldOfStudy: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Passing Year">
                        <input type="text" value={education.ug.passingYear} onChange={(e) => setEducation({ ...education, ug: { ...education.ug, passingYear: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Grade / CGPA / %">
                        <input type="text" value={education.ug.grade} onChange={(e) => setEducation({ ...education, ug: { ...education.ug, grade: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                    </EducationSubBlock>

                    <EducationSubBlock title="Postgraduate (PG)">
                      <ProfileField label="College / University" span="full">
                        <input type="text" value={education.pg.schoolOrCollege} onChange={(e) => setEducation({ ...education, pg: { ...education.pg, schoolOrCollege: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Degree">
                        <input type="text" value={education.pg.degree} onChange={(e) => setEducation({ ...education, pg: { ...education.pg, degree: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Major / Specialization">
                        <input type="text" value={education.pg.fieldOfStudy} onChange={(e) => setEducation({ ...education, pg: { ...education.pg, fieldOfStudy: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Passing Year">
                        <input type="text" value={education.pg.passingYear} onChange={(e) => setEducation({ ...education, pg: { ...education.pg, passingYear: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                      <ProfileField label="Grade / CGPA / %">
                        <input type="text" value={education.pg.grade} onChange={(e) => setEducation({ ...education, pg: { ...education.pg, grade: e.target.value } })} className={profileInputClass} />
                      </ProfileField>
                    </EducationSubBlock>

                    <div className={profileSectionGridClass}>
                      <SectionCustomFields section="education" fields={customFields} onAdd={handleAddCustomField} onChange={handleCustomFieldChange} onRemove={handleRemoveCustomField} getGlobalIndex={getCustomFieldGlobalIndex} />
                    </div>
                  </div>
                </ProfileSection>

                <ProfileSection icon={Award} title="Compensation & Notice">
                  <div className={profileSectionGridClass}>
                    <ProfileField label="Current CTC">
                      <input type="text" value={jobInfo.currentCTC} onChange={(e) => setJobInfo({ ...jobInfo, currentCTC: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Expected CTC">
                      <input type="text" value={jobInfo.expectedCTC} onChange={(e) => setJobInfo({ ...jobInfo, expectedCTC: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <ProfileField label="Notice Period">
                      <input type="text" value={jobInfo.noticePeriod} onChange={(e) => setJobInfo({ ...jobInfo, noticePeriod: e.target.value })} className={profileInputClass} placeholder="e.g. 30 Days" />
                    </ProfileField>
                    <ProfileField label="Preferred Location">
                      <input type="text" value={jobInfo.preferredLocation} onChange={(e) => setJobInfo({ ...jobInfo, preferredLocation: e.target.value })} className={profileInputClass} />
                    </ProfileField>
                    <SectionCustomFields section="jobInfo" fields={customFields} onAdd={handleAddCustomField} onChange={handleCustomFieldChange} onRemove={handleRemoveCustomField} getGlobalIndex={getCustomFieldGlobalIndex} />
                  </div>
                </ProfileSection>
              </div>
            </div>
          </div>
        )}

        {/* Tab - Resumes */}
        {activeTab === 'resumes' && (
          <div className="p-8 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col gap-6">
            <div className="pb-4 border-b border-brand-800/15">
              <h2 className="text-lg font-bold text-brand-800">Resume Manager</h2>
              <p className="text-xs text-brand-700/65 mt-1">Upload and store PDF/DOCX resumes. The extension automatically detects file uploads on pages and drops the file reference.</p>
            </div>

            {/* Upload Area */}
            <div className="border border-dashed border-brand-800/20 bg-white/75 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 relative hover:border-brand-500/50 hover:bg-white/85 transition cursor-pointer">
              <HardDriveDownload className="w-10 h-10 text-brand-400" />
              <div>
                <p className="text-xs font-semibold text-brand-800">Drag & Drop Resume PDF/DOCX</p>
                <p className="text-[10px] text-brand-700/65 mt-1">Maximum 5MB. Files are stored 100% locally and encrypted inside IndexedDB.</p>
              </div>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleResumeUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* List of Resumes */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700/75 mb-1">Your Resumes ({resumes.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resumes.map(r => (
                  <div key={r.id} className="ui-panel rounded-xl p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-brand-100 border border-brand-300/50 flex items-center justify-center text-[10px] font-bold text-brand-700 uppercase">
                        {r.fileType}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-brand-800 truncate max-w-[200px]">{r.name}</p>
                        <p className="text-[10px] text-brand-700/65 mt-0.5">Uploaded {new Date(r.uploadedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {r.isDefault ? (
                        <span className="text-[9px] font-semibold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded border border-brand-800/40 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-brand-400" />
                          Default
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetDefaultResume(r.id)}
                          className="text-[9px] font-semibold text-brand-700/65 hover:text-brand-700 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Star className="w-3 h-3" />
                          Set Default
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteResume(r.id)}
                        className="p-1.5 rounded-lg bg-white hover:bg-white border border-brand-800/15 text-brand-700/75 hover:text-rose-450 transition cursor-pointer ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {resumes.length === 0 && (
                  <div className="col-span-2 text-center py-8 ui-panel-soft rounded-xl text-xs text-brand-600/70">
                    No resumes uploaded. Add a PDF or DOCX file to enable resume autofill.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab - Templates */}
        {activeTab === 'templates' && (
          <div className="p-8 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col gap-6">
            <div className="pb-4 border-b border-brand-800/15 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-brand-800">Templates & Mappings</h2>
                <p className="text-xs text-brand-700/65 mt-1">Manage website-specific field selectors, mapping overrides, and manual element links.</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-brand-600/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search domain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white border border-brand-800/15 focus:border-brand-500 rounded-xl pl-9 pr-4 py-1.5 text-xs text-brand-800 focus:outline-none w-60 placeholder:text-brand-600/50"
                />
              </div>
            </div>

            {/* Manual Mappings Grid */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700/75 mb-1">Manual Field Links ({manualMappings.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {manualMappings
                  .filter(m => m.domain.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(m => (
                    <div key={m.id} className="ui-panel rounded-xl p-4 flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-brand-800">{m.domain}</span>
                          <span className="text-[9px] bg-white px-1.5 py-0.5 rounded text-brand-700 font-semibold border border-brand-300/40">Custom Map</span>
                        </div>
                        <p className="text-[10px] text-brand-700/65 mt-1.5 font-mono truncate bg-white p-1.5 rounded border border-brand-800/15">
                          Selector: {m.selector}
                        </p>
                        <p className="text-[10px] text-brand-400 mt-1 font-semibold">
                          Maps to: {m.fieldPath}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteManualMap(m.id)}
                        className="p-1.5 rounded-lg bg-white hover:bg-white border border-brand-800/15 text-brand-700/75 hover:text-rose-400 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                {manualMappings.length === 0 && (
                  <div className="col-span-2 text-center py-8 ui-panel-soft rounded-xl text-xs text-brand-600/70">
                    No manual mappings. Map a field by clicking "Manual Map" in the page widget.
                  </div>
                )}
              </div>
            </div>

            {/* Domain Templates */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700/75 mb-1">Domain Templates ({templates.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates
                  .filter(t => t.domain.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(t => (
                    <div key={t.id} className="ui-panel rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-brand-800">{t.domain}</p>
                        <p className="text-[10px] text-brand-700/65 mt-0.5">Created {new Date(t.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="p-1.5 rounded-lg bg-white hover:bg-white border border-brand-800/15 text-brand-700/75 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                {templates.length === 0 && (
                  <div className="col-span-2 text-center py-8 ui-panel-soft rounded-xl text-xs text-brand-600/70">
                    No custom templates saved. Save templates via the page widget.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab - History & Analytics */}
        {activeTab === 'history' && (
          <div className="p-8 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col gap-6">
            <div className="pb-4 border-b border-brand-800/15 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-brand-800">Autofill History</h2>
                <p className="text-xs text-brand-700/65 mt-1">Review form fill history, accuracy metrics, and local optimization diagnostics.</p>
              </div>
              <button
                onClick={handleClearHistory}
                disabled={history.length === 0}
                className="bg-white border border-brand-800/20 hover:bg-cream-200 disabled:opacity-50 text-brand-700 hover:text-white py-1.5 px-3 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                Clear Logs
              </button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="ui-panel rounded-2xl p-5">
                <p className="text-[10px] text-brand-700/65 font-bold uppercase tracking-wider">Total Form Fills</p>
                <p className="text-2xl font-bold text-brand-800 mt-1">{history.length}</p>
                <div className="text-[10px] text-brand-400 flex items-center gap-1 mt-1 font-semibold">
                  <CloudLightning className="w-3.5 h-3.5" />
                  <span>One-click autofills</span>
                </div>
              </div>

              <div className="ui-panel rounded-2xl p-5">
                <p className="text-[10px] text-brand-700/65 font-bold uppercase tracking-wider">Total Fields Populated</p>
                <p className="text-2xl font-bold text-brand-800 mt-1">
                  {history.reduce((sum, entry) => sum + entry.fieldsCount, 0)}
                </p>
                <p className="text-[10px] text-brand-700/65 mt-1.5">
                  Avg fields/page: {history.length > 0 ? (history.reduce((sum, entry) => sum + entry.fieldsCount, 0) / history.length).toFixed(1) : 0}
                </p>
              </div>

              <div className="ui-panel rounded-2xl p-5">
                <p className="text-[10px] text-brand-700/65 font-bold uppercase tracking-wider font-sans">Est. Time Saved</p>
                <p className="text-2xl font-bold text-brand-800 mt-1">
                  {((history.reduce((sum, entry) => sum + entry.fieldsCount, 0) * 8) / 60).toFixed(1)} mins
                </p>
                <div className="text-[10px] text-brand-700 flex items-center gap-1 mt-1 font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Calculated at 8s/field saved</span>
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="ui-panel-soft rounded-2xl overflow-hidden mt-4">
              <div className="px-4 py-3 bg-cream-200/50 border-b border-brand-800/15 text-xs font-semibold text-brand-700/75 uppercase tracking-wider">
                Fill Logs
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-800/15 text-[10px] text-brand-700/65 uppercase tracking-wider">
                      <th className="p-4">Website Domain</th>
                      <th className="p-4">Profile Applied</th>
                      <th className="p-4">Fields Filled</th>
                      <th className="p-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-800/15 text-xs">
                    {history.map(entry => (
                      <tr key={entry.id} className="hover:bg-white/75 text-brand-800">
                        <td className="p-4 font-semibold">{entry.domain}</td>
                        <td className="p-4">{entry.profileName}</td>
                        <td className="p-4 font-mono">{entry.fieldsCount} fields</td>
                        <td className="p-4 text-brand-700/60">{new Date(entry.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-10 text-brand-600/50 text-xs">
                          No history records. Autofill forms on external websites to populate analytics.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab - Settings */}
        {activeTab === 'settings' && appSettings && (
          <div className="p-8 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col gap-6">
            <div className="pb-4 border-b border-brand-800/15">
              <h2 className="text-lg font-bold text-brand-800">Configuration & Security</h2>
              <p className="text-xs text-brand-700/65 mt-1">Configure AI models, manage encryption backups, and setup triggers.</p>
            </div>

            {/* AI Model config */}
            <div className="ui-panel p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-brand-800/15/50 pb-2">
                <Settings2 className="w-4.5 h-4.5 text-brand-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-800">AI Matcher Provider</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div 
                  onClick={() => setAppSettingsState({ ...appSettings, ai: { ...appSettings.ai, provider: 'heuristic' } })}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col gap-1.5 ${
                    appSettings.ai.provider === 'heuristic' 
                      ? 'bg-brand-600/10 border-brand-500/40 text-brand-700' 
                      : 'bg-white/75 border-brand-800/15 text-brand-700/70 hover:bg-white/90'
                  }`}
                >
                  <p className="text-xs font-semibold text-brand-800">Offline only</p>
                  <p className="text-[10px] text-brand-700/60 leading-relaxed">Local keyword matching. Optional Gemini API key still enables AI-written answers for open questions only.</p>
                </div>

                <div 
                  onClick={() => setAppSettingsState({ ...appSettings, ai: { ...appSettings.ai, provider: 'hybrid' } })}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col gap-1.5 ${
                    appSettings.ai.provider === 'hybrid' 
                      ? 'bg-brand-600/10 border-brand-500/40 text-brand-700' 
                      : 'bg-white/75 border-brand-800/15 text-brand-700/70 hover:bg-white/90'
                  }`}
                >
                  <p className="text-xs font-semibold text-brand-800">Hybrid (recommended)</p>
                  <p className="text-[10px] text-brand-700/60 leading-relaxed">Offline match first, then Gemini for unmatched fields and essay-style questions using your profile + job description.</p>
                </div>

                <div 
                  onClick={() => setAppSettingsState({ ...appSettings, ai: { ...appSettings.ai, provider: 'gemini' } })}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col gap-1.5 ${
                    appSettings.ai.provider === 'gemini' 
                      ? 'bg-brand-600/10 border-brand-500/40 text-brand-700' 
                      : 'bg-white/75 border-brand-800/15 text-brand-700/70 hover:bg-white/90'
                  }`}
                >
                  <p className="text-xs font-semibold text-brand-800">Gemini-first</p>
                  <p className="text-[10px] text-brand-700/60 leading-relaxed">Maximum AI coverage: Gemini maps and generates answers for anything heuristics miss.</p>
                </div>
              </div>

              {(appSettings.ai.provider !== 'heuristic' || appSettings.ai.answerOpenQuestions !== false) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 animate-fade-in">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold text-brand-700/70 uppercase mb-1">Google Gemini API Key</label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={appSettings.ai.geminiApiKey}
                      onChange={(e) => setAppSettingsState({ ...appSettings, ai: { ...appSettings.ai, geminiApiKey: e.target.value } })}
                      className="w-full bg-white border border-brand-800/20 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-brand-800"
                    />
                    <p className="text-[10px] text-brand-700/65 mt-1">
                      Your key only — stored locally in this browser. Get a free key from Google AI Studio. Not read from .env or build files.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-brand-700/70 uppercase mb-1">Model</label>
                    <select
                      value={appSettings.ai.geminiModel}
                      onChange={(e) => setAppSettingsState({ ...appSettings, ai: { ...appSettings.ai, geminiModel: e.target.value } })}
                      className="w-full bg-white border border-brand-800/20 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-brand-800"
                    >
                      <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-3 justify-center">
                    <label className="flex items-center gap-2 text-xs text-brand-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={appSettings.ai.answerOpenQuestions !== false}
                        onChange={(e) =>
                          setAppSettingsState({
                            ...appSettings,
                            ai: { ...appSettings.ai, answerOpenQuestions: e.target.checked },
                          })
                        }
                        className="rounded border-brand-700/30"
                      />
                      AI answers for open-ended questions
                    </label>
                    <label className="flex items-center gap-2 text-xs text-brand-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={appSettings.ai.useJobDescriptionContext !== false}
                        onChange={(e) =>
                          setAppSettingsState({
                            ...appSettings,
                            ai: { ...appSettings.ai, useJobDescriptionContext: e.target.checked },
                          })
                        }
                        className="rounded border-brand-700/30"
                      />
                      Use job description from the page
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* General Toggles */}
            <div className="ui-panel p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-brand-800/15/50 pb-2">
                <Sliders className="w-4.5 h-4.5 text-brand-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700">General Preferences</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-brand-700/70 uppercase mb-1">Theme</label>
                  <select
                    value={appSettings.theme}
                    onChange={(e) => {
                      const theme = e.target.value as AppSettingsType['theme'];
                      setAppSettingsState({ ...appSettings, theme });
                      applyThemeSetting(theme);
                    }}
                    className="w-full ui-input rounded-lg p-2 text-xs"
                  >
                    <option value="light">Light theme</option>
                    <option value="dark">Dark theme</option>
                    <option value="system">Match system</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-brand-700/70 uppercase mb-1">Keyboard Trigger</label>
                  <input
                    type="text"
                    value={appSettings.keyboardShortcut}
                    onChange={(e) => setAppSettingsState({ ...appSettings, keyboardShortcut: e.target.value })}
                    className="w-full bg-white border border-brand-800/20 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-brand-800"
                  />
                </div>
              </div>
            </div>

            {/* Export & Import Backup */}
            <div className="ui-panel p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-brand-800/15/50 pb-2">
                <HardDriveDownload className="w-4.5 h-4.5 text-brand-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700">Data Export / Backup</h3>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleExportData}
                  className="bg-white border border-brand-800/15 hover:bg-brand-900/8 text-brand-800 py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  Export Local Backup
                </button>
                
                <div className="relative">
                  <button
                    className="bg-white border border-brand-800/15 hover:bg-brand-900/8 text-brand-800 py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    Import Backup file
                  </button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex justify-end gap-2 border-t border-brand-800/15 pt-4">
              <button
                onClick={handleSaveSettings}
                className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-brand-500/25 transition cursor-pointer"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* Tab - Credentials / Passwords Vault */}
        {activeTab === 'credentials' && (
          <div className="p-8 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col gap-6 animate-fade-in">
            <div className="pb-4 border-b border-brand-800/15 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-brand-800">Passwords Vault</h2>
                <p className="text-xs text-brand-700/65 mt-1">Manage site-specific credentials saved by the auto-fill floating widget.</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-brand-600/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search domain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white border border-brand-800/15 focus:border-brand-500 rounded-xl pl-9 pr-4 py-1.5 text-xs text-brand-800 focus:outline-none w-60 placeholder:text-brand-600/50"
                />
              </div>
            </div>

            <div className="ui-panel-soft rounded-2xl overflow-hidden mt-2">
              <div className="px-4 py-3 bg-cream-200/50 border-b border-brand-800/15 text-xs font-semibold text-brand-700/75 uppercase tracking-wider">
                Saved Accounts
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-brand-800/15 text-[10px] text-brand-700/60 uppercase tracking-wider">
                      <th className="p-4">Site / Domain</th>
                      <th className="p-4">Username / Email</th>
                      <th className="p-4">Password</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-800/15 text-xs">
                    {credentials
                      .filter(c => c.domain.toLowerCase().includes(searchQuery.toLowerCase()) || c.username.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(c => {
                        const isVisible = visiblePasswords[c.id] || false;
                        return (
                          <tr key={c.id} className="hover:bg-white/75 text-brand-800">
                            <td className="p-4 font-semibold text-brand-900">{c.domain}</td>
                            <td className="p-4 font-mono">{c.username || <span className="text-brand-600/70">None</span>}</td>
                            <td className="p-4 font-mono">
                              <div className="flex items-center gap-2">
                                <span className="min-w-[100px]">{isVisible ? c.password : '••••••••••••'}</span>
                                <button
                                  onClick={() => setVisiblePasswords({ ...visiblePasswords, [c.id]: !isVisible })}
                                  className="p-1 rounded text-brand-700/65 hover:text-brand-700 transition hover:bg-cream-200"
                                >
                                  {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeleteCredential(c.id)}
                                className="p-1.5 rounded-lg bg-white hover:bg-white border border-brand-800/15 text-brand-700/75 hover:text-rose-450 transition cursor-pointer"
                                title="Delete credential"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {credentials.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-10 text-brand-600/50 text-xs">
                          No credentials saved. Save passwords on login forms using the page floating widget.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
