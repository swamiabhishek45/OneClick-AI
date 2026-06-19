import React, { useState, useEffect } from 'react';
import { 
  User, Briefcase, Settings, History, FileText, Sparkles, Plus, Trash2, 
  Save, CheckCircle, Database, ShieldAlert, Award, FileCode, Search, Copy, 
  Settings2, HelpCircle, HardDriveDownload, CloudLightning, ArrowUpRight, Sliders
} from 'lucide-react';
import { 
  getProfiles, saveProfile, deleteProfile,
  getResumes, saveResume, deleteResume,
  getTemplates, deleteTemplate,
  getManualMappings, deleteManualMapping,
  getHistory, clearHistory,
  getAppSettings, saveAppSettings, getActiveProfileId, setActiveProfileId 
} from '../shared/db';
import { UserProfile, Resume, WebsiteTemplate, ManualMapping, FillHistoryEntry, AppSettings } from '../shared/types';

export default function OptionsApp() {
  const [activeTab, setActiveTab] = useState<'profiles' | 'resumes' | 'templates' | 'history' | 'settings'>('profiles');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('default');
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [templates, setTemplates] = useState<WebsiteTemplate[]>([]);
  const [manualMappings, setManualMappings] = useState<ManualMapping[]>([]);
  const [history, setHistory] = useState<FillHistoryEntry[]>([]);
  const [appSettings, setAppSettingsState] = useState<AppSettings | null>(null);
  const [activeProfileIdState, setActiveProfileIdState] = useState('default');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
  const [customFields, setCustomFields] = useState<{ id: string; name: string; value: string }[]>([]);

  // Search filter for templates and mappings
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

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
      setCustomFields(profile.customFields || []);
    } else {
      setProfileName('New Profile');
      setPersonal({ fullName: '', firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', country: '', postalCode: '' });
      setProfessional({ jobTitle: '', experience: '', currentCompany: '', skills: '', education: '', degree: '', college: '', linkedin: '', github: '', portfolio: '' });
      setJobInfo({ currentCTC: '', expectedCTC: '', noticePeriod: '', preferredLocation: '' });
      setCustomFields([]);
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

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      showStatus("Profile name is required", "error");
      return;
    }

    const updatedProfile: UserProfile = {
      id: selectedProfileId,
      name: profileName,
      personal,
      professional,
      jobInfo,
      customFields
    };

    try {
      await saveProfile(updatedProfile);
      showStatus("Profile saved successfully!");
      
      const allProfiles = await getProfiles();
      setProfiles(allProfiles);
      
      // If it's the first profile, set it as active
      if (allProfiles.length === 1) {
        await setActiveProfileId(selectedProfileId);
        setActiveProfileIdState(selectedProfileId);
      }
      
      // Notify other parts of the extension
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

  // Custom Fields Operations
  const handleAddCustomField = () => {
    setCustomFields([...customFields, { id: Math.random().toString(36).substring(2), name: '', value: '' }]);
  };

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
          uploadedAt: new Date().toISOString()
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
      showStatus("Settings saved successfully!");
    } catch (e) {
      showStatus("Failed to save settings", "error");
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
    <div className="flex h-screen bg-dark-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Panel */}
      <aside className="w-64 bg-dark-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Branding */}
          <div className="p-6 flex items-center gap-2.5 border-b border-slate-850">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm bg-gradient-to-r from-brand-400 to-indigo-300 bg-clip-text text-transparent tracking-wide">OneClick AI</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Autofill Engine</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab('profiles')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'profiles' 
                  ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20' 
                  : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-transparent'
              }`}
            >
              <User className="w-4 h-4" />
              User Profiles
            </button>

            <button
              onClick={() => setActiveTab('resumes')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'resumes' 
                  ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20' 
                  : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-transparent'
              }`}
            >
              <FileText className="w-4 h-4" />
              Resume Manager
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'templates' 
                  ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20' 
                  : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-transparent'
              }`}
            >
              <FileCode className="w-4 h-4" />
              Templates & Mapping
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'history' 
                  ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20' 
                  : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-transparent'
              }`}
            >
              <History className="w-4 h-4" />
              Fill Analytics
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-semibold flex items-center gap-3 cursor-pointer transition ${
                activeTab === 'settings' 
                  ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20' 
                  : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings & AI
            </button>
          </nav>
        </div>

        {/* Database Stats */}
        <div className="p-4 border-t border-slate-850 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
            <Database className="w-3.5 h-3.5" />
            <span>Storage Status</span>
          </div>
          <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-850">
            <div className="text-[10px] text-slate-400">
              <p className="font-semibold">{profiles.length} Profiles</p>
              <p className="mt-0.5 text-slate-500">{resumes.length} Resumes</p>
            </div>
            <div className="text-[10px] text-emerald-400 font-medium bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800/40">
              Encrypted
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
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
            <div className="w-64 border-r border-slate-850 bg-dark-900/50 p-4 flex flex-col gap-3 justify-between">
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Your Profiles</h2>
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
                          ? 'bg-slate-900 border-brand-500/50 shadow-md shadow-brand-500/5' 
                          : 'bg-dark-900/30 border-slate-850 hover:bg-slate-900/30'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{p.personal.email || 'No email'}</p>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {activeProfileIdState === p.id ? (
                          <span className="text-[9px] font-semibold text-brand-400 bg-brand-950/60 px-1.5 py-0.5 rounded border border-brand-800/40">Active</span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSetActiveProfile(p.id); }}
                            className="text-[9px] font-semibold text-slate-500 hover:text-slate-300 hover:underline cursor-pointer"
                          >
                            Set Active
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 transition cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-slate-500 text-center leading-relaxed">
                Choose a profile or create multiple templates to map data per role/purpose.
              </div>
            </div>

            {/* Profile Form Editor */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-850">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Profile Name (e.g. Software Engineer)"
                    className="bg-transparent border-b border-slate-800 hover:border-slate-600 focus:border-brand-500 text-lg font-bold focus:outline-none pb-1 text-slate-100 placeholder:text-slate-600"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold py-2 px-4 rounded-xl shadow-lg shadow-brand-500/25 flex items-center gap-2 transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Save Profile
                </button>
              </div>

              {/* Form Grid sections */}
              <div className="flex flex-col gap-6">
                
                {/* 1. Personal Information */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4.5 h-4.5 text-brand-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-350">Personal Information</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-900/30 border border-slate-850 p-5 rounded-2xl">
                    <div className="col-span-1 md:col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Full Name</label>
                      <input type="text" value={personal.fullName} onChange={(e) => setPersonal({...personal, fullName: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">First Name</label>
                      <input type="text" value={personal.firstName} onChange={(e) => setPersonal({...personal, firstName: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Last Name</label>
                      <input type="text" value={personal.lastName} onChange={(e) => setPersonal({...personal, lastName: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Email Address</label>
                      <input type="email" value={personal.email} onChange={(e) => setPersonal({...personal, email: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Phone Number</label>
                      <input type="text" value={personal.phone} onChange={(e) => setPersonal({...personal, phone: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Address</label>
                      <input type="text" value={personal.address} onChange={(e) => setPersonal({...personal, address: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">City</label>
                      <input type="text" value={personal.city} onChange={(e) => setPersonal({...personal, city: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">State / Region</label>
                      <input type="text" value={personal.state} onChange={(e) => setPersonal({...personal, state: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Country</label>
                      <input type="text" value={personal.country} onChange={(e) => setPersonal({...personal, country: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Postal Code</label>
                      <input type="text" value={personal.postalCode} onChange={(e) => setPersonal({...personal, postalCode: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                  </div>
                </div>

                {/* 2. Professional Details */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="w-4.5 h-4.5 text-brand-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-350">Professional Details</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 bg-slate-900/30 border border-slate-850 p-5 rounded-2xl">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Job Title</label>
                      <input type="text" value={professional.jobTitle} onChange={(e) => setProfessional({...professional, jobTitle: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Experience (Years)</label>
                      <input type="text" value={professional.experience} onChange={(e) => setProfessional({...professional, experience: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Current Company</label>
                      <input type="text" value={professional.currentCompany} onChange={(e) => setProfessional({...professional, currentCompany: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Degree</label>
                      <input type="text" value={professional.degree} onChange={(e) => setProfessional({...professional, degree: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">College / University</label>
                      <input type="text" value={professional.college} onChange={(e) => setProfessional({...professional, college: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">LinkedIn Profile URL</label>
                      <input type="text" value={professional.linkedin} onChange={(e) => setProfessional({...professional, linkedin: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">GitHub Profile URL</label>
                      <input type="text" value={professional.github} onChange={(e) => setProfessional({...professional, github: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Portfolio Link</label>
                      <input type="text" value={professional.portfolio} onChange={(e) => setProfessional({...professional, portfolio: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Skills (comma-separated list)</label>
                      <textarea value={professional.skills} onChange={(e) => setProfessional({...professional, skills: e.target.value})} rows={3} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                  </div>
                </div>

                {/* 3. Job Search Info */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-4.5 h-4.5 text-brand-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-350">Compensation & Notice</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/30 border border-slate-850 p-5 rounded-2xl">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Current CTC</label>
                      <input type="text" value={jobInfo.currentCTC} onChange={(e) => setJobInfo({...jobInfo, currentCTC: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Expected CTC</label>
                      <input type="text" value={jobInfo.expectedCTC} onChange={(e) => setJobInfo({...jobInfo, expectedCTC: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Notice Period (Days)</label>
                      <input type="text" value={jobInfo.noticePeriod} onChange={(e) => setJobInfo({...jobInfo, noticePeriod: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Preferred Location</label>
                      <input type="text" value={jobInfo.preferredLocation} onChange={(e) => setJobInfo({...jobInfo, preferredLocation: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200" />
                    </div>
                  </div>
                </div>

                {/* 4. Custom User-Defined Fields */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4.5 h-4.5 text-brand-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-350">Custom Profile Fields</h3>
                    </div>
                    <button
                      onClick={handleAddCustomField}
                      className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 py-1.5 px-3 rounded-lg text-[10px] font-semibold transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Custom Field
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-2 bg-slate-900/30 border border-slate-850 p-5 rounded-2xl">
                    {customFields.map((field, idx) => (
                      <div key={field.id} className="flex gap-3 items-center">
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => handleCustomFieldChange(idx, 'name', e.target.value)}
                          placeholder="Field Name (e.g. Employee Code)"
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200"
                        />
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => handleCustomFieldChange(idx, 'value', e.target.value)}
                          placeholder="Profile Value (e.g. EMP123)"
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200"
                        />
                        <button
                          onClick={() => handleRemoveCustomField(idx)}
                          className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-rose-400 transition rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {customFields.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-650">
                        No custom fields defined yet. Custom fields let you map site-specific variables instantly.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Tab - Resumes */}
        {activeTab === 'resumes' && (
          <div className="p-8 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col gap-6">
            <div className="pb-4 border-b border-slate-850">
              <h2 className="text-lg font-bold bg-gradient-to-r from-brand-400 to-indigo-300 bg-clip-text text-transparent">Resume Manager</h2>
              <p className="text-xs text-slate-500 mt-1">Upload and store PDF/DOCX resumes. The extension automatically detects file uploads on pages and drops the file reference.</p>
            </div>

            {/* Upload Area */}
            <div className="border border-dashed border-slate-800 bg-slate-900/20 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 relative hover:border-brand-500/50 hover:bg-slate-900/30 transition cursor-pointer">
              <HardDriveDownload className="w-10 h-10 text-brand-400" />
              <div>
                <p className="text-xs font-semibold text-slate-300">Drag & Drop Resume PDF/DOCX</p>
                <p className="text-[10px] text-slate-500 mt-1">Maximum 5MB. Files are stored 100% locally and encrypted inside IndexedDB.</p>
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Your Resumes ({resumes.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resumes.map(r => (
                  <div key={r.id} className="bg-slate-900/40 border border-slate-850 rounded-xl p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-indigo-950 border border-indigo-900/60 flex items-center justify-center text-[10px] font-bold text-indigo-400 uppercase">
                        {r.fileType}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200 truncate max-w-[200px]">{r.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Uploaded {new Date(r.uploadedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteResume(r.id)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {resumes.length === 0 && (
                  <div className="col-span-2 text-center py-8 bg-slate-900/20 border border-slate-850 rounded-xl text-xs text-slate-600">
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
            <div className="pb-4 border-b border-slate-850 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold bg-gradient-to-r from-brand-400 to-indigo-300 bg-clip-text text-transparent">Templates & Mappings</h2>
                <p className="text-xs text-slate-500 mt-1">Manage website-specific field selectors, mapping overrides, and manual element links.</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-650 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search domain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-850 focus:border-brand-500 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 focus:outline-none w-60 placeholder:text-slate-650"
                />
              </div>
            </div>

            {/* Manual Mappings Grid */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Manual Field Links ({manualMappings.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {manualMappings
                  .filter(m => m.domain.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(m => (
                    <div key={m.id} className="bg-slate-900/40 border border-slate-850 rounded-xl p-4 flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200">{m.domain}</span>
                          <span className="text-[9px] bg-slate-950 px-1.5 py-0.5 rounded text-indigo-400 font-semibold border border-indigo-900/30">Custom Map</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5 font-mono truncate bg-slate-950 p-1.5 rounded border border-slate-850">
                          Selector: {m.selector}
                        </p>
                        <p className="text-[10px] text-brand-400 mt-1 font-semibold">
                          Maps to: {m.fieldPath}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteManualMap(m.id)}
                        className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 hover:text-rose-400 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                {manualMappings.length === 0 && (
                  <div className="col-span-2 text-center py-8 bg-slate-900/20 border border-slate-850 rounded-xl text-xs text-slate-600">
                    No manual mappings. Map a field by clicking "Manual Map" in the page widget.
                  </div>
                )}
              </div>
            </div>

            {/* Domain Templates */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Domain Templates ({templates.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates
                  .filter(t => t.domain.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(t => (
                    <div key={t.id} className="bg-slate-900/40 border border-slate-850 rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{t.domain}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Created {new Date(t.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                {templates.length === 0 && (
                  <div className="col-span-2 text-center py-8 bg-slate-900/20 border border-slate-850 rounded-xl text-xs text-slate-600">
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
            <div className="pb-4 border-b border-slate-850 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold bg-gradient-to-r from-brand-400 to-indigo-300 bg-clip-text text-transparent">Autofill History</h2>
                <p className="text-xs text-slate-500 mt-1">Review form fill history, accuracy metrics, and local optimization diagnostics.</p>
              </div>
              <button
                onClick={handleClearHistory}
                disabled={history.length === 0}
                className="bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 text-slate-350 hover:text-white py-1.5 px-3 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                Clear Logs
              </button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-5">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Form Fills</p>
                <p className="text-2xl font-bold text-slate-200 mt-1">{history.length}</p>
                <div className="text-[10px] text-brand-400 flex items-center gap-1 mt-1 font-semibold">
                  <CloudLightning className="w-3.5 h-3.5" />
                  <span>One-click autofills</span>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-5">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Fields Populated</p>
                <p className="text-2xl font-bold text-slate-200 mt-1">
                  {history.reduce((sum, entry) => sum + entry.fieldsCount, 0)}
                </p>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Avg fields/page: {history.length > 0 ? (history.reduce((sum, entry) => sum + entry.fieldsCount, 0) / history.length).toFixed(1) : 0}
                </p>
              </div>

              <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-5">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">Est. Time Saved</p>
                <p className="text-2xl font-bold text-slate-200 mt-1">
                  {((history.reduce((sum, entry) => sum + entry.fieldsCount, 0) * 8) / 60).toFixed(1)} mins
                </p>
                <div className="text-[10px] text-indigo-400 flex items-center gap-1 mt-1 font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Calculated at 8s/field saved</span>
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden mt-4">
              <div className="px-4 py-3 bg-dark-900/50 border-b border-slate-850 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Fill Logs
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-[10px] text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Website Domain</th>
                      <th className="p-4">Profile Applied</th>
                      <th className="p-4">Fields Filled</th>
                      <th className="p-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-xs">
                    {history.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-900/20 text-slate-300">
                        <td className="p-4 font-semibold">{entry.domain}</td>
                        <td className="p-4">{entry.profileName}</td>
                        <td className="p-4 font-mono">{entry.fieldsCount} fields</td>
                        <td className="p-4 text-slate-550">{new Date(entry.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-10 text-slate-650 text-xs">
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
            <div className="pb-4 border-b border-slate-850">
              <h2 className="text-lg font-bold bg-gradient-to-r from-brand-400 to-indigo-300 bg-clip-text text-transparent">Configuration & Security</h2>
              <p className="text-xs text-slate-500 mt-1">Configure AI models, manage encryption backups, and setup triggers.</p>
            </div>

            {/* AI Model config */}
            <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-850/50 pb-2">
                <Settings2 className="w-4.5 h-4.5 text-brand-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">AI Matcher Provider</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div 
                  onClick={() => setAppSettingsState({ ...appSettings, ai: { ...appSettings.ai, provider: 'heuristic' } })}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col gap-1.5 ${
                    appSettings.ai.provider === 'heuristic' 
                      ? 'bg-brand-600/10 border-brand-500/40 text-brand-400' 
                      : 'bg-slate-900/20 border-slate-850 text-slate-450 hover:bg-slate-900/40'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-200">Local Rule-Based Matcher (Offline)</p>
                  <p className="text-[10px] text-slate-550 leading-relaxed">Uses heuristic analysis, regex matching, and active learning corrections. runs completely local, ultra-fast, and secure.</p>
                </div>

                <div 
                  onClick={() => setAppSettingsState({ ...appSettings, ai: { ...appSettings.ai, provider: 'gemini' } })}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col gap-1.5 ${
                    appSettings.ai.provider === 'gemini' 
                      ? 'bg-brand-600/10 border-brand-500/40 text-brand-400' 
                      : 'bg-slate-900/20 border-slate-850 text-slate-450 hover:bg-slate-900/40'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-200">Gemini Compatible API (Advanced)</p>
                  <p className="text-[10px] text-slate-550 leading-relaxed">Uses LLM reasoning to scan complex form schemas and layouts. Requires an active Google Gemini API key.</p>
                </div>
              </div>

              {appSettings.ai.provider === 'gemini' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 animate-fade-in">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Gemini API Key</label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={appSettings.ai.geminiApiKey}
                      onChange={(e) => setAppSettingsState({ ...appSettings, ai: { ...appSettings.ai, geminiApiKey: e.target.value } })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Model Version</label>
                    <select
                      value={appSettings.ai.geminiModel}
                      onChange={(e) => setAppSettingsState({ ...appSettings, ai: { ...appSettings.ai, geminiModel: e.target.value } })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200"
                    >
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Accurate)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (Highly Logical)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* General Toggles */}
            <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-850/50 pb-2">
                <Sliders className="w-4.5 h-4.5 text-brand-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-350">General Preferences</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Theme</label>
                  <select
                    value={appSettings.theme}
                    onChange={(e) => setAppSettingsState({ ...appSettings, theme: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200"
                  >
                    <option value="dark">Dark Theme (Neon Mode)</option>
                    <option value="light">Light Theme</option>
                    <option value="system">Follow System Settings</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Keyboard Trigger</label>
                  <input
                    type="text"
                    value={appSettings.keyboardShortcut}
                    onChange={(e) => setAppSettingsState({ ...appSettings, keyboardShortcut: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Export & Import Backup */}
            <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-850/50 pb-2">
                <HardDriveDownload className="w-4.5 h-4.5 text-brand-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-350">Data Export / Backup</h3>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleExportData}
                  className="bg-slate-900 border border-slate-850 hover:bg-slate-850 text-slate-300 py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  Export Local Backup
                </button>
                
                <div className="relative">
                  <button
                    className="bg-slate-900 border border-slate-850 hover:bg-slate-850 text-slate-300 py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
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
            <div className="flex justify-end gap-2 border-t border-slate-850 pt-4">
              <button
                onClick={handleSaveSettings}
                className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-brand-500/25 transition cursor-pointer"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
