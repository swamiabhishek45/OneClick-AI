import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Edit3, Settings, Save, X, Minimize2, ToggleLeft, ToggleRight, Key } from 'lucide-react';
import { UserProfile, DomainRule } from '../shared/types';
import { ExtensionLogo } from '../shared/ExtensionLogo';
import { findLoginFields } from './FormScanner';

export default function WidgetApp() {
  const [expanded, setExpanded] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 24, y: 100 }); // bottom-right offsets
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('default');
  const [isMappingMode, setIsMappingMode] = useState(false);
  const [selectedElementForMap, setSelectedElementForMap] = useState<HTMLElement | null>(null);
  const [selectedFieldForMap, setSelectedFieldForMap] = useState('');
  const [domainRule, setDomainRule] = useState<DomainRule>({
    domain: window.location.hostname,
    enabled: true,
    autoFillOnLoad: true,
    requireConfirmation: false
  });
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isFilling, setIsFilling] = useState(false);
  const [hasPasswordField, setHasPasswordField] = useState(false);
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);

  // Fetch profiles and configuration on mount
  useEffect(() => {
    loadData();
    
    // Listen for options/popup change notifications
    const listener = (message: any) => {
      if (message.action === 'dataUpdated') {
        loadData();
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    const onAutofillDone = (e: Event) => {
      const detail = (e as CustomEvent<{ filledCount: number }>).detail;
      if (detail?.filledCount > 0) {
        showStatus(`Auto-filled ${detail.filledCount} field${detail.filledCount === 1 ? '' : 's'}`, 'success');
      }
    };
    window.addEventListener('oneclick-autofill-complete', onAutofillDone);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      window.removeEventListener('oneclick-autofill-complete', onAutofillDone);
    };
  }, []);

  const loadData = () => {
    // Get list of profiles
    chrome.runtime.sendMessage({ action: 'getProfiles' }, (response) => {
      if (response && response.profiles) {
        setProfiles(response.profiles);
      }
    });

    // Get active profile
    chrome.runtime.sendMessage({ action: 'getActiveProfileId' }, (response) => {
      if (response && response.activeProfileId) {
        setActiveProfileId(response.activeProfileId);
      }
    });

    // Get domain rule
    chrome.runtime.sendMessage({ action: 'getDomainRule', domain: window.location.hostname }, (response) => {
      if (response && response.rule) {
        setDomainRule(response.rule);
      }
    });
  };

  // Show status flash
  const showStatus = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (buttonRef.current) {
      isDraggingRef.current = false;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: dragPosition.x,
        posY: dragPosition.y
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = dragStartRef.current.y - e.clientY; // moving up increases offset from bottom

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      isDraggingRef.current = true;
    }

    setDragPosition({
      x: Math.max(10, Math.min(window.innerWidth - 60, dragStartRef.current.posX - deltaX)),
      y: Math.max(10, Math.min(window.innerHeight - 60, dragStartRef.current.posY + deltaY))
    });
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Actions
  const handleAutofill = () => {
    if (isFilling) return;
    setIsFilling(true);
    showStatus("Scanning fields...", "info");

    chrome.runtime.sendMessage({
      action: 'autofillPage',
      profileId: activeProfileId,
      force: false,
    }, (response) => {
      setIsFilling(false);
      if (response?.success && (response.filledCount ?? 0) > 0) {
        showStatus(`Filled ${response.filledCount} field${response.filledCount === 1 ? '' : 's'} successfully!`, "success");
      } else if (response?.success && response.filledCount === 0) {
        showStatus(response.error || "All fields are already filled.", "info");
      } else {
        showStatus(response?.error || "No matching fields found.", "error");
      }
    });
  };

  const handleSaveTemplate = () => {
    chrome.runtime.sendMessage({
      action: 'saveWebsiteTemplate',
      domain: window.location.hostname
    }, (response) => {
      if (response && response.success) {
        showStatus("Template saved for this domain!", "success");
      } else {
        showStatus(response?.error || "Failed to save template.", "error");
      }
    });
  };

  // Manual Mapping Workflow
  const startManualMapping = () => {
    setIsMappingMode(true);
    setExpanded(false);
    setSelectedElementForMap(null);
    showStatus("Click an input field on the page to map.", "info");
  };

  useEffect(() => {
    if (!isMappingMode) return;

    // Element hover highlighter
    let highlightedEl: HTMLElement | null = null;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') &&
        !target.closest('#oneclick-autofill-root')
      ) {
        highlightedEl = target;
        highlightedEl.style.outline = '3px solid #8b5cf6';
        highlightedEl.style.outlineOffset = '2px';
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (highlightedEl) {
        highlightedEl.style.outline = '';
        highlightedEl.style.outlineOffset = '';
        highlightedEl = null;
      }
    };

    const handleInputClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') &&
        !target.closest('#oneclick-autofill-root')
      ) {
        e.preventDefault();
        e.stopPropagation();
        
        if (highlightedEl) {
          highlightedEl.style.outline = '';
          highlightedEl = null;
        }

        setSelectedElementForMap(target);
        setIsMappingMode(false);
        // Re-open widget but focused on custom mapping form
        setExpanded(true);
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleInputClick, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleInputClick, true);
      if (highlightedEl) {
        (highlightedEl as HTMLElement).style.outline = '';
      }
    };
  }, [isMappingMode]);

  const saveManualFieldMap = () => {
    if (!selectedElementForMap || !selectedFieldForMap) return;

    // Helper to generate a unique selector
    const getSelector = (el: HTMLElement): string => {
      if (el.id) return `#${el.id}`;
      const name = el.getAttribute('name');
      if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
      
      const path: string[] = [];
      let current: HTMLElement | null = el;
      while (current && current.parentElement) {
        const tagName = current.tagName.toLowerCase();
        const siblings = Array.from(current.parentElement.children);
        const index = siblings.indexOf(current) + 1;
        path.unshift(`${tagName}:nth-child(${index})`);
        current = current.parentElement;
      }
      return path.join(' > ');
    };

    const selector = getSelector(selectedElementForMap);
    
    chrome.runtime.sendMessage({
      action: 'saveManualMapping',
      mapping: {
        domain: window.location.hostname,
        selector,
        fieldPath: selectedFieldForMap
      }
    }, (response) => {
      if (response && response.success) {
        showStatus("Field mapped successfully!", "success");
        setSelectedElementForMap(null);
        setSelectedFieldForMap('');
      } else {
        showStatus("Failed to save mapping.", "error");
      }
    });
  };

  const handleEditProfile = () => {
    chrome.runtime.sendMessage({ action: 'openOptionsPage' });
  };

  const toggleDomainEnable = () => {
    const enabling = !domainRule.enabled;
    const updated = {
      ...domainRule,
      enabled: enabling,
      autoFillOnLoad: enabling ? true : domainRule.autoFillOnLoad,
    };
    setDomainRule(updated);
    chrome.runtime.sendMessage({
      action: 'saveDomainRule',
      rule: updated
    }, () => {
      showStatus(
        enabling ? "Autofill enabled — forms will fill automatically" : "Autofill disabled for this site",
        "info"
      );
      if (enabling) {
        chrome.runtime.sendMessage({ action: 'autofillPage', profileId: activeProfileId });
      }
    });
  };

  const toggleAutoFillOnLoad = () => {
    const updated = { ...domainRule, autoFillOnLoad: !domainRule.autoFillOnLoad };
    setDomainRule(updated);
    chrome.runtime.sendMessage({ action: 'saveDomainRule', rule: updated }, () => {
      showStatus(
        updated.autoFillOnLoad ? "Auto-fill on page load enabled" : "Auto-fill on page load disabled",
        "info"
      );
    });
  };

  const handleSaveCredentials = () => {
    const { username, password } = findLoginFields();
    if (!password) {
      showStatus("No password input field found on this page.", "error");
      return;
    }
    
    const usernameVal = username ? username.value.trim() : '';
    const passwordVal = password.value.trim();
    
    if (!passwordVal) {
      showStatus("Please enter password on the page first.", "error");
      return;
    }
    
    chrome.runtime.sendMessage({
      action: 'saveCredential',
      credential: {
        domain: window.location.hostname,
        username: usernameVal,
        password: passwordVal
      }
    }, (response) => {
      if (response && response.success) {
        showStatus("Credentials saved locally!", "success");
      } else {
        showStatus(response?.error || "Failed to save credentials.", "error");
      }
    });
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  return (
    <div 
      className="fixed z-[9999999] select-none font-sans text-slate-100"
      style={{
        bottom: `${dragPosition.y}px`,
        right: `${dragPosition.x}px`,
      }}
    >
      {/* Floating Button */}
      {!expanded && !isMappingMode && !selectedElementForMap && (
        <button
          ref={buttonRef}
          onMouseDown={handleMouseDown}
          onClick={() => {
            if (!isDraggingRef.current) {
              setExpanded(true);
              setHasPasswordField(document.querySelector('input[type="password"]') !== null);
            }
          }}
          className={`flex h-12 w-12 items-center justify-center rounded-full overflow-hidden shadow-lg shadow-brand-500/30 transition-transform active:scale-95 cursor-pointer hover:shadow-brand-500/50 hover:brightness-110 border-2 border-brand-400/40 bg-slate-950 ${
            isFilling ? 'animate-pulse opacity-80' : 'hover:scale-105'
          }`}
          title="OneClick Autofill AI"
        >
          <ExtensionLogo className="h-12 w-12" />
        </button>
      )}

      {/* Manual Mapping Tip Overlay */}
      {isMappingMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-full bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-xl text-sm font-medium animate-bounce-slow">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse"></span>
          <span>Click any form input on the page to map it...</span>
          <button 
            onClick={() => setIsMappingMode(false)}
            className="p-1 rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4 text-slate-400 hover:text-white" />
          </button>
        </div>
      )}

      {/* Manual Mapping Configuration Modal */}
      {selectedElementForMap && (
        <div className="w-[300px] rounded-2xl bg-slate-900/95 border border-slate-700/80 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Map Custom Field</span>
            <button 
              onClick={() => setSelectedElementForMap(null)} 
              className="text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Selected element: <code className="bg-slate-800/80 px-1 py-0.5 rounded text-indigo-300 font-mono text-[10px] break-all">{selectedElementForMap.tagName.toLowerCase()}{selectedElementForMap.id ? `#${selectedElementForMap.id}` : ''}</code>
          </p>

          <div className="mb-4">
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Link to Profile Field</label>
            <select
              value={selectedFieldForMap}
              onChange={(e) => setSelectedFieldForMap(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
            >
              <option value="">-- Choose Field --</option>
              <optgroup label="Personal Information">
                <option value="personal.fullName">Full Name</option>
                <option value="personal.firstName">First Name</option>
                <option value="personal.lastName">Last Name</option>
                <option value="personal.email">Email Address</option>
                <option value="personal.phone">Phone Number</option>
                <option value="personal.address">Address</option>
                <option value="personal.city">City</option>
                <option value="personal.state">State</option>
                <option value="personal.country">Country</option>
                <option value="personal.postalCode">Postal Code</option>
              </optgroup>
              <optgroup label="Professional Information">
                <option value="professional.jobTitle">Job Title</option>
                <option value="professional.experience">Experience (Years)</option>
                <option value="professional.currentCompany">Current Company</option>
                <option value="professional.skills">Skills</option>
                <option value="professional.education">Education (General)</option>
                <option value="professional.degree">Degree (General)</option>
                <option value="professional.college">College (General)</option>
                <option value="professional.linkedin">LinkedIn Link</option>
                <option value="professional.github">GitHub Link</option>
                <option value="professional.portfolio">Portfolio Link</option>
              </optgroup>
              <optgroup label="10th Class Education">
                <option value="education.tenth.schoolOrCollege">10th School Name</option>
                <option value="education.tenth.degree">10th Board</option>
                <option value="education.tenth.fieldOfStudy">10th Stream/Subjects</option>
                <option value="education.tenth.passingYear">10th Passing Year</option>
                <option value="education.tenth.grade">10th Grade/CGPA/%</option>
              </optgroup>
              <optgroup label="12th Class / Diploma">
                <option value="education.twelfthOrDiploma.schoolOrCollege">12th/Diploma School/College</option>
                <option value="education.twelfthOrDiploma.degree">12th/Diploma Degree/Board</option>
                <option value="education.twelfthOrDiploma.fieldOfStudy">12th/Diploma Stream</option>
                <option value="education.twelfthOrDiploma.passingYear">12th/Diploma Passing Year</option>
                <option value="education.twelfthOrDiploma.grade">12th/Diploma Grade/CGPA/%</option>
              </optgroup>
              <optgroup label="Undergraduate (UG)">
                <option value="education.ug.schoolOrCollege">UG College/University</option>
                <option value="education.ug.degree">UG Degree</option>
                <option value="education.ug.fieldOfStudy">UG Stream/Major</option>
                <option value="education.ug.passingYear">UG Passing Year</option>
                <option value="education.ug.grade">UG Grade/CGPA/%</option>
              </optgroup>
              <optgroup label="Postgraduate (PG)">
                <option value="education.pg.schoolOrCollege">PG College/University</option>
                <option value="education.pg.degree">PG Degree</option>
                <option value="education.pg.fieldOfStudy">PG Stream/Major</option>
                <option value="education.pg.passingYear">PG Passing Year</option>
                <option value="education.pg.grade">PG Grade/CGPA/%</option>
              </optgroup>
              <optgroup label="Job Search / Comp">
                <option value="jobInfo.currentCTC">Current CTC</option>
                <option value="jobInfo.expectedCTC">Expected CTC</option>
                <option value="jobInfo.noticePeriod">Notice Period</option>
                <option value="jobInfo.preferredLocation">Preferred Location</option>
              </optgroup>
              {activeProfile?.customFields?.length > 0 && (
                <optgroup label="Custom Profile Fields">
                  {activeProfile.customFields.map((cf) => (
                    <option key={cf.id} value={`custom:${cf.id}`}>{cf.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSelectedElementForMap(null)}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={saveManualFieldMap}
              disabled={!selectedFieldForMap}
              className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Save Mapping
            </button>
          </div>
        </div>
      )}

      {/* Expanded Main Panel */}
      {expanded && (
        <div className="w-[320px] rounded-2xl bg-slate-950/95 border border-slate-800 p-4 shadow-2xl backdrop-blur-md flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ExtensionLogo className="h-6 w-6 rounded-md" />
              <span className="font-semibold text-sm tracking-wide bg-gradient-to-r from-brand-400 to-indigo-300 bg-clip-text text-transparent">OneClick Autofill AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleEditProfile}
                title="Edit profiles"
                className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-100 transition cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-100 transition cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Profile Switcher */}
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Active Profile</span>
              <button 
                onClick={handleEditProfile}
                className="text-[10px] text-brand-400 hover:underline cursor-pointer"
              >
                Manage
              </button>
            </div>
            <select
              value={activeProfileId}
              onChange={(e) => {
                const id = e.target.value;
                setActiveProfileId(id);
                chrome.runtime.sendMessage({ action: 'setActiveProfileId', activeProfileId: id });
              }}
              className="w-full bg-slate-800 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {profiles.length === 0 && (
                <option value="default">Default Profile</option>
              )}
            </select>
          </div>

          {/* Core Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleAutofill}
              disabled={isFilling}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-xs shadow-md shadow-brand-600/20 transition flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 hover:scale-[1.02] text-white disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              {isFilling ? 'Filling Form...' : 'Autofill Page'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={startManualMapping}
                className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-350 hover:text-white text-[11px] font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                Manual Map
              </button>
              <button
                onClick={handleSaveTemplate}
                className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-350 hover:text-white text-[11px] font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-brand-400" />
                Save Template
              </button>
            </div>
            {hasPasswordField && (
              <button
                onClick={handleSaveCredentials}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-350 hover:text-white text-[11px] font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-yellow-500" />
                Save Credentials
              </button>
            )}
          </div>

          {/* Quick Settings & Status */}
          <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-300 font-medium">Automatic filling on this site</span>
                <p className="text-[10px] text-slate-500 mt-0.5">Fill empty fields when the page loads or changes</p>
              </div>
              <button
                onClick={toggleDomainEnable}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                {domainRule.enabled ? (
                  <ToggleRight className="w-7 h-7 text-brand-500" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-650" />
                )}
              </button>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-300 font-medium">Auto-fill when page loads</span>
                <p className="text-[10px] text-slate-500 mt-0.5">Matches and fills empty fields automatically</p>
              </div>
              <button
                onClick={toggleAutoFillOnLoad}
                disabled={!domainRule.enabled}
                className="text-slate-400 hover:text-white transition cursor-pointer disabled:opacity-40"
              >
                {domainRule.autoFillOnLoad && domainRule.enabled ? (
                  <ToggleRight className="w-7 h-7 text-brand-500" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-650" />
                )}
              </button>
            </div>
          </div>

          {/* Toast Notification area */}
          {statusMessage && (
            <div className={`text-center py-1.5 px-3 rounded-lg text-xs font-medium animate-fade-in ${
              statusMessage.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40' :
              statusMessage.type === 'error' ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40' :
              'bg-slate-900 text-slate-300 border border-slate-800'
            }`}>
              {statusMessage.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
