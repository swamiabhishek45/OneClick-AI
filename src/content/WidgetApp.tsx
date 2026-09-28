import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Sparkles, Edit3, Settings, X, Minimize2, ToggleLeft, ToggleRight } from 'lucide-react';
import { DomainRule, UserProfile } from '../shared/types';
import { ExtensionLogo } from '../shared/ExtensionLogo';
import { applyThemeSetting, initExtensionTheme, watchThemeChanges } from '../shared/theme';
import {
  addExtensionMessageListener,
  isExtensionContextValid,
  onExtensionContextInvalidated,
  sendExtensionMessage,
  watchLocalStorage,
} from '../shared/extensionRuntime';
import {
  fetchActiveProfileIdForUi,
  fetchProfilesForUi,
  PROFILES_CACHE_KEY,
  resolveActiveProfileId,
} from '../shared/profilesCache';
import { isSiteAutoFillEnabled, withSiteAutoFill } from '../shared/domainRules';

const EXT_RELOAD_MSG =
  'Extension was reloaded. Refresh this page to use OneClick AI again.';

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
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isFilling, setIsFilling] = useState(false);
  const [domainRule, setDomainRule] = useState<DomainRule>(() => ({
    domain: window.location.hostname,
    enabled: true,
    autoFillOnLoad: false,
    requireConfirmation: false,
  }));
  const siteAutoFillOn = isSiteAutoFillEnabled(domainRule);

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

  useEffect(() => {
    const container = document.getElementById('oneclick-widget-container');
    let stopWatch = () => {};
    initExtensionTheme(container).then(() => {
      stopWatch = watchThemeChanges((_resolved, setting) => {
        applyThemeSetting(setting, container);
      });
    });
    return () => stopWatch();
  }, []);

  useEffect(() => {
    const stopInvalidated = onExtensionContextInvalidated(() => {
      showStatus(EXT_RELOAD_MSG, 'error');
    });
    return stopInvalidated;
  }, []);

  // Fetch profiles and configuration on mount
  useEffect(() => {
    loadData();

    const stopMessages = addExtensionMessageListener((message) => {
      if ((message as { action?: string }).action === 'dataUpdated') {
        loadData();
      }
    });

    const stopStorageWatch = watchLocalStorage((changes, area) => {
      if (area !== 'local') return;
      const cached = changes[PROFILES_CACHE_KEY]?.newValue as UserProfile[] | undefined;
      if (cached) {
        setProfiles(cached);
        setActiveProfileId((current) => resolveActiveProfileId(cached, current));
      }
      const activeId = changes.activeProfileId?.newValue as string | undefined;
      if (activeId) {
        setActiveProfileId(activeId);
      }
    });

    const onAutofillDone = (e: Event) => {
      const detail = (e as CustomEvent<{ filledCount: number }>).detail;
      if (detail?.filledCount > 0) {
        showStatus(`Auto-filled ${detail.filledCount} field${detail.filledCount === 1 ? '' : 's'}`, 'success');
      }
    };
    window.addEventListener('oneclick-autofill-complete', onAutofillDone);

    return () => {
      stopMessages();
      stopStorageWatch();
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
    void loadData();
    setExpanded(true);
  };

  const minimizePanel = () => {
    setExpanded(false);
    setAnchorPosition((prev) =>
      clampAnchor(fabAnchorTopRef.current, prev.right, FAB_SIZE, FAB_SIZE)
    );
  };

  const loadData = async () => {
    if (!isExtensionContextValid()) return;

    const list = await fetchProfilesForUi();
    setProfiles(list);
    const activeId = await fetchActiveProfileIdForUi();
    setActiveProfileId(resolveActiveProfileId(list, activeId));

    const ruleResponse = await sendExtensionMessage<{ rule?: DomainRule }>({
      action: 'getDomainRule',
      domain: window.location.hostname,
    });
    if (ruleResponse?.rule) {
      setDomainRule(ruleResponse.rule);
    }
  };

  const toggleSiteAutoFill = () => {
    const nextOn = !siteAutoFillOn;
    const updated = withSiteAutoFill(domainRule, nextOn);
    setDomainRule(updated);
    void sendExtensionMessage({ action: 'saveDomainRule', rule: updated });
    if (nextOn) {
      showStatus('Auto-fill on for this site', 'success');
      handleAutofill();
    } else {
      showStatus('Auto-fill off for this site. Autofill Page still works.', 'info');
    }
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
    if (!isExtensionContextValid()) {
      showStatus(EXT_RELOAD_MSG, 'error');
      return;
    }
    setIsFilling(true);
    showStatus('Scanning fields...', 'info');

    const onResult = (event: Event) => {
      window.removeEventListener('oneclick-autofill-result', onResult);
      window.clearTimeout(timeoutId);
      setIsFilling(false);
      const response = (event as CustomEvent<{
        success?: boolean;
        filledCount?: number;
        error?: string;
      }>).detail;
      if (!response) {
        showStatus(EXT_RELOAD_MSG, 'error');
        return;
      }
      if (response.success && (response.filledCount ?? 0) > 0) {
        showStatus(
          `Filled ${response.filledCount} field${response.filledCount === 1 ? '' : 's'} successfully!`,
          'success'
        );
      } else if (response.success && response.filledCount === 0) {
        showStatus(response.error || 'All fields are already filled.', 'info');
      } else {
        showStatus(response.error || 'No matching fields found.', 'error');
      }
    };

    window.addEventListener('oneclick-autofill-result', onResult);
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('oneclick-autofill-result', onResult);
      setIsFilling(false);
      showStatus('Autofill timed out. Refresh the page and try again.', 'error');
    }, 45000);

    window.dispatchEvent(
      new CustomEvent('oneclick-request-autofill', {
        detail: { profileId: resolveActiveProfileId(profiles, activeProfileId), force: false },
      })
    );
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
    
    void (async () => {
      const response = await sendExtensionMessage<{ success?: boolean }>({
        action: 'saveManualMapping',
        mapping: {
          domain: window.location.hostname,
          selector,
          fieldPath: selectedFieldForMap,
        },
      });
      if (response?.success) {
        showStatus('Field mapped successfully!', 'success');
        setSelectedElementForMap(null);
        setSelectedFieldForMap('');
      } else {
        showStatus('Failed to save mapping.', 'error');
      }
    })();
  };

  const handleEditProfile = () => {
    void sendExtensionMessage({ action: 'openOptionsPage' });
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  const panelWidth = `min(${PANEL_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`;
  const panelMaxHeight = `min(${PANEL_MAX_HEIGHT}px, calc(100vh - ${VIEWPORT_MARGIN * 2}px))`;

  return (
    <div
      className="fixed z-[9999999] select-none font-sans antialiased text-brand-900 bg-transparent"
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
          className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full overflow-hidden shadow-lg shadow-brand-600/25 transition-shadow active:scale-95 cursor-pointer hover:shadow-brand-600/40 border-2 border-brand-600/35 bg-cream ${
            isFilling ? 'animate-pulse opacity-80' : ''
          }`}
          title="OneClick AI"
        >
          <ExtensionLogo variant="mark" className="h-[78%] w-[78%] pointer-events-none" />
        </button>
      )}

      {/* Manual Mapping Tip Overlay */}
      {isMappingMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 py-3 rounded-2xl sm:rounded-full bg-cream/95 border border-brand-800/20 backdrop-blur-md shadow-xl text-sm font-medium max-w-[calc(100vw-24px)] text-center text-brand-900">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse"></span>
          <span>Click any form input on the page to map it...</span>
          <button 
            onClick={() => setIsMappingMode(false)}
            className="p-1 rounded-full hover:bg-brand-900/10 transition"
          >
            <X className="w-4 h-4 text-brand-700/75 hover:text-brand-900" />
          </button>
        </div>
      )}

      {/* Manual Mapping Configuration Modal */}
      {selectedElementForMap && (
        <div
          className="rounded-2xl bg-cream/98 border border-brand-800/20 p-4 sm:p-5 shadow-2xl backdrop-blur-md"
          style={{ width: panelWidth, maxHeight: panelMaxHeight, overflowY: 'auto' }}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold uppercase tracking-wider text-brand-700">Map Custom Field</span>
            <button 
              onClick={() => setSelectedElementForMap(null)} 
              className="text-brand-700/75 hover:text-brand-900 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-brand-700/75 mb-3 leading-relaxed">
            Selected element:{' '}
            <code className="bg-white/90 px-1.5 py-0.5 rounded text-brand-700 font-mono text-xs break-all border border-brand-800/15">
              {selectedElementForMap.tagName.toLowerCase()}
              {selectedElementForMap.id ? `#${selectedElementForMap.id}` : ''}
            </code>
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-brand-800 mb-2">Link to Profile Field</label>
            <select
              value={selectedFieldForMap}
              onChange={(e) => setSelectedFieldForMap(e.target.value)}
              className="w-full bg-white border border-brand-800/20 rounded-lg px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:border-brand-600"
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
              <optgroup label="Education">
                <option value="education.ug.schoolOrCollege">College / University</option>
                <option value="education.ug.degree">Degree</option>
                <option value="education.ug.fieldOfStudy">Major / Field</option>
                <option value="education.ug.passingYear">Graduation year</option>
                <option value="education.ug.grade">Grade / CGPA</option>
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
              className="flex-1 bg-white hover:bg-cream-200 text-brand-800 border border-brand-800/20 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
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
          className="rounded-2xl overflow-hidden bg-cream border border-brand-800/20 p-4 sm:p-5 shadow-2xl flex flex-col gap-4 sm:gap-5 box-border dark:bg-brand-900 dark:border-brand-600/25"
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
              <div className="h-8 w-8 shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-cream border border-brand-800/10">
                <ExtensionLogo variant="mark" className="h-[85%] w-[85%]" />
              </div>
              <span className="font-semibold text-base leading-tight tracking-wide text-brand-800 truncate">
                OneClick AI
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleEditProfile}
                title="Edit profiles"
                className="p-2 rounded-lg hover:bg-brand-900/10 text-brand-700/75 hover:text-brand-900 transition cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={minimizePanel}
                title="Minimize"
                className="p-2 rounded-lg hover:bg-brand-900/10 text-brand-700/75 hover:text-brand-900 transition cursor-pointer"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Profile Switcher */}
          <div className="bg-white/90 rounded-xl p-3.5 sm:p-4 border border-brand-800/15">
            <div className="flex justify-between items-center mb-2.5 gap-2">
              <span className="text-xs font-semibold text-brand-700/65 uppercase tracking-wider">Active Profile</span>
              <button
                onClick={handleEditProfile}
                className="text-xs text-brand-700 hover:underline cursor-pointer shrink-0"
              >
                Manage
              </button>
            </div>
            <select
              value={resolveActiveProfileId(profiles, activeProfileId)}
              onChange={(e) => {
                const id = e.target.value;
                setActiveProfileId(id);
                void sendExtensionMessage({ action: 'setActiveProfileId', activeProfileId: id });
              }}
              className="w-full bg-white border border-brand-800/20 rounded-lg px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:border-brand-600 cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {profiles.length === 0 && (
                <option value="default">No profiles, open Dashboard</option>
              )}
            </select>
          </div>

          {/* Core Actions */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleAutofill}
              disabled={isFilling}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm shadow-md shadow-brand-600/25 transition flex items-center justify-center gap-2 cursor-pointer bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white disabled:opacity-60"
            >
              <Sparkles className="w-5 h-5 shrink-0" />
              {isFilling ? 'Filling Form...' : 'Autofill Form'}
            </button>

            <button
              onClick={startManualMapping}
              className="w-full py-2.5 px-3 rounded-lg bg-white border border-brand-800/20 hover:bg-cream-200 text-brand-800 text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Edit3 className="w-4 h-4 text-brand-600 shrink-0" />
              Map a field on this page
            </button>
          </div>

          <div className="border-t border-brand-800/15 pt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-brand-900 leading-snug">Auto-fill on this site</p>
              <p className="text-[11px] text-brand-700/65 mt-0.5">
                {siteAutoFillOn
                  ? 'Fills forms automatically when they appear'
                  : 'Off: only fills when you click Autofill Page'}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleSiteAutoFill}
              aria-pressed={siteAutoFillOn}
              title={siteAutoFillOn ? 'Turn off auto-fill for this site' : 'Turn on auto-fill for this site'}
              className="transition cursor-pointer shrink-0 p-1"
            >
              {siteAutoFillOn ? (
                <ToggleRight className="w-9 h-9 text-brand-600" />
              ) : (
                <ToggleLeft className="w-9 h-9 text-brand-400" />
              )}
            </button>
          </div>

          {/* Toast Notification area */}
          {statusMessage && (
            <div className={`text-center py-2 px-3 rounded-lg text-sm font-medium ${
              statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/50' :
              statusMessage.type === 'error' ? 'bg-rose-100 text-rose-800 border border-rose-300/50' :
              'bg-white text-brand-800 border border-brand-800/20'
            }`}>
              {statusMessage.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
