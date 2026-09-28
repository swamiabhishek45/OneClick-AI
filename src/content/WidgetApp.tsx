import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Sparkles, Edit3, Settings, Save, X, Minimize2, ToggleLeft, ToggleRight, Key } from 'lucide-react';
import { UserProfile, DomainRule } from '../shared/types';
import { ExtensionLogo } from '../shared/ExtensionLogo';
import { findLoginFields } from './FormScanner';

export default function WidgetApp() {
  const [expanded, setExpanded] = useState(false);
  const [anchorPosition, setAnchorPosition] = useState(() => ({
    top: Math.max(12, window.innerHeight - 52 - 16),
    right: 16,
  }));
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
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);

  const PANEL_WIDTH = 360;
  const PANEL_MAX_HEIGHT = 560;
  const FAB_SIZE = 52;
  const VIEWPORT_MARGIN = 12;
  const FAB_PANEL_GAP = 8;

  const fabAnchorTopRef = useRef(anchorPosition.top);

  const getPanelWidthPx = useCallback(
    () => Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
    []
  );

  const clampAnchor = useCallback(
    (top: number, right: number, height: number, width?: number) => {
      const w = width ?? getPanelWidthPx();
      const maxTop = window.innerHeight - height - VIEWPORT_MARGIN;
      return {
        top: Math.max(VIEWPORT_MARGIN, Math.min(top, maxTop)),
        right: Math.max(
          VIEWPORT_MARGIN,
          Math.min(right, window.innerWidth - w - VIEWPORT_MARGIN)
        ),
      };
    },
    [getPanelWidthPx]
  );

  /** When FAB is near the top, open panel downward so it stays inside the viewport. */
  const computePanelTop = useCallback(
    (fabTop: number, panelHeight: number, right: number) => {
      const maxPanelH = Math.min(panelHeight, window.innerHeight - VIEWPORT_MARGIN * 2);
      const spaceBelow =
        window.innerHeight - (fabTop + FAB_SIZE + FAB_PANEL_GAP) - VIEWPORT_MARGIN;
      const openBelow =
        spaceBelow >= Math.min(maxPanelH, 220) || fabTop < window.innerHeight * 0.42;

      const top = openBelow
        ? fabTop + FAB_SIZE + FAB_PANEL_GAP
        : fabTop - maxPanelH - FAB_PANEL_GAP;

      return clampAnchor(top, right, maxPanelH).top;
    },
    [clampAnchor]
  );

  const repositionExpandedPanel = useCallback(() => {
    if (!panelRef.current) return;
    const panelHeight = panelRef.current.offsetHeight || PANEL_MAX_HEIGHT;
    setAnchorPosition((prev) => {
      const panelTop = computePanelTop(fabAnchorTopRef.current, panelHeight, prev.right);
      return clampAnchor(panelTop, prev.right, panelHeight, getPanelWidthPx());
    });
  }, [clampAnchor, computePanelTop, getPanelWidthPx]);

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

  useEffect(() => {
    const onResize = () => {
      if (expanded) {
        repositionExpandedPanel();
      } else {
        setAnchorPosition((prev) =>
          clampAnchor(prev.top, prev.right, FAB_SIZE, FAB_SIZE)
        );
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [expanded, clampAnchor, repositionExpandedPanel]);

  useLayoutEffect(() => {
    if (!expanded) return;
    repositionExpandedPanel();
  }, [expanded, repositionExpandedPanel, statusMessage]);

  useEffect(() => {
    if (!expanded || !panelRef.current) return;
    const observer = new ResizeObserver(() => repositionExpandedPanel());
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [expanded, repositionExpandedPanel]);

  const openPanel = () => {
    fabAnchorTopRef.current = anchorPosition.top;
    setHasPasswordField(document.querySelector('input[type="password"]') !== null);
    setExpanded(true);
  };

  const minimizePanel = () => {
    setExpanded(false);
    setAnchorPosition((prev) =>
      clampAnchor(fabAnchorTopRef.current, prev.right, FAB_SIZE, FAB_SIZE)
    );
  };

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

  const beginDrag = (e: React.MouseEvent) => {
    isDraggingRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: anchorPosition.right,
      posY: anchorPosition.top,
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleFabMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    beginDrag(e);
  };

  const handlePanelHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    beginDrag(e);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      isDraggingRef.current = true;
    }

    const height = expanded
      ? panelRef.current?.offsetHeight || PANEL_MAX_HEIGHT
      : FAB_SIZE;
    const width = expanded ? getPanelWidthPx() : FAB_SIZE;

    const next = clampAnchor(
      dragStartRef.current.posY + deltaY,
      dragStartRef.current.posX - deltaX,
      height,
      width
    );

    setAnchorPosition(next);
    if (!expanded) {
      fabAnchorTopRef.current = next.top;
    }
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
        fabAnchorTopRef.current = anchorPosition.top;
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

  const panelWidth = `min(${PANEL_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`;
  const panelMaxHeight = `min(${PANEL_MAX_HEIGHT}px, calc(100vh - ${VIEWPORT_MARGIN * 2}px))`;

  return (
    <div
      className="fixed z-[9999999] select-none font-sans text-slate-100 antialiased"
      style={{
        top: `${anchorPosition.top}px`,
        right: `${anchorPosition.right}px`,
        bottom: 'auto',
        maxWidth: panelWidth,
      }}
    >
      {/* Floating Button */}
      {!expanded && !isMappingMode && !selectedElementForMap && (
        <button
          ref={buttonRef}
          onMouseDown={handleFabMouseDown}
          onClick={() => {
            if (!isDraggingRef.current) {
              openPanel();
            }
          }}
          className={`flex h-[52px] w-[52px] items-center justify-center rounded-full overflow-hidden shadow-lg shadow-brand-500/30 transition-transform active:scale-95 cursor-pointer hover:shadow-brand-500/50 hover:brightness-110 border-2 border-brand-400/40 bg-slate-950 ${
            isFilling ? 'animate-pulse opacity-80' : 'hover:scale-105'
          }`}
          title="OneClick Autofill AI"
        >
          <ExtensionLogo className="h-12 w-12" />
        </button>
      )}

      {/* Manual Mapping Tip Overlay */}
      {isMappingMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 py-3 rounded-2xl sm:rounded-full bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-xl text-sm font-medium max-w-[calc(100vw-24px)] text-center">
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
        <div
          className="rounded-2xl bg-slate-900/95 border border-slate-700/80 p-4 sm:p-5 shadow-2xl backdrop-blur-md"
          style={{ width: panelWidth, maxHeight: panelMaxHeight, overflowY: 'auto' }}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold uppercase tracking-wider text-brand-400">Map Custom Field</span>
            <button 
              onClick={() => setSelectedElementForMap(null)} 
              className="text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-slate-400 mb-3 leading-relaxed">
            Selected element:{' '}
            <code className="bg-slate-800/80 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs break-all">
              {selectedElementForMap.tagName.toLowerCase()}
              {selectedElementForMap.id ? `#${selectedElementForMap.id}` : ''}
            </code>
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Link to Profile Field</label>
            <select
              value={selectedFieldForMap}
              onChange={(e) => setSelectedFieldForMap(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
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

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setSelectedElementForMap(null)}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={saveManualFieldMap}
              disabled={!selectedFieldForMap}
              className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              Save Mapping
            </button>
          </div>
        </div>
      )}

      {/* Expanded Main Panel */}
      {expanded && (
        <div
          ref={panelRef}
          className="rounded-2xl bg-slate-950/95 border border-slate-800 p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4 sm:gap-5 box-border"
          style={{
            width: panelWidth,
            maxHeight: panelMaxHeight,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {/* Header — draggable */}
          <div
            className="flex justify-between items-start gap-2 cursor-grab active:cursor-grabbing"
            onMouseDown={handlePanelHeaderMouseDown}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ExtensionLogo className="h-8 w-8 rounded-md shrink-0" />
              <span className="font-semibold text-base leading-tight tracking-wide bg-gradient-to-r from-brand-400 to-indigo-300 bg-clip-text text-transparent truncate">
                OneClick Autofill AI
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleEditProfile}
                title="Edit profiles"
                className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-100 transition cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={minimizePanel}
                title="Minimize"
                className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-100 transition cursor-pointer"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Profile Switcher */}
          <div className="bg-slate-900/60 rounded-xl p-3.5 sm:p-4 border border-slate-800/50">
            <div className="flex justify-between items-center mb-2.5 gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Profile</span>
              <button
                onClick={handleEditProfile}
                className="text-xs text-brand-400 hover:underline cursor-pointer shrink-0"
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
              className="w-full bg-slate-800 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
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
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleAutofill}
              disabled={isFilling}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm shadow-md shadow-brand-600/20 transition flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 active:scale-[0.99] text-white disabled:opacity-60"
            >
              <Sparkles className="w-5 h-5 shrink-0" />
              {isFilling ? 'Filling Form...' : 'Autofill Page'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={startManualMapping}
                className="py-2.5 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                <Edit3 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate">Manual Map</span>
              </button>
              <button
                onClick={handleSaveTemplate}
                className="py-2.5 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                <Save className="w-4 h-4 text-brand-400 shrink-0" />
                <span className="truncate">Save Template</span>
              </button>
            </div>
            {hasPasswordField && (
              <button
                onClick={handleSaveCredentials}
                className="w-full py-2.5 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                <Key className="w-4 h-4 text-yellow-500 shrink-0" />
                Save Credentials
              </button>
            )}
          </div>

          {/* Quick Settings & Status */}
          <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-sm text-slate-200 font-medium block leading-snug">
                  Automatic filling on this site
                </span>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Fill empty fields when the page loads or changes
                </p>
              </div>
              <button
                type="button"
                onClick={toggleDomainEnable}
                aria-pressed={domainRule.enabled}
                className="text-slate-400 hover:text-white transition cursor-pointer shrink-0 p-1 -mr-1"
              >
                {domainRule.enabled ? (
                  <ToggleRight className="w-9 h-9 text-brand-500" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-500" />
                )}
              </button>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-sm text-slate-200 font-medium block leading-snug">
                  Auto-fill when page loads
                </span>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Matches and fills empty fields automatically
                </p>
              </div>
              <button
                type="button"
                onClick={toggleAutoFillOnLoad}
                disabled={!domainRule.enabled}
                aria-pressed={domainRule.autoFillOnLoad && domainRule.enabled}
                className="text-slate-400 hover:text-white transition cursor-pointer disabled:opacity-40 shrink-0 p-1 -mr-1"
              >
                {domainRule.autoFillOnLoad && domainRule.enabled ? (
                  <ToggleRight className="w-9 h-9 text-brand-500" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {/* Toast Notification area */}
          {statusMessage && (
            <div className={`text-center py-2 px-3 rounded-lg text-sm font-medium ${
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
