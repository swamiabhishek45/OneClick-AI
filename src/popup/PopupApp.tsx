import React, { useState, useEffect } from 'react';
import { Sparkles, Sliders, ExternalLink, ShieldCheck, Flame, ToggleLeft, ToggleRight, CheckCircle, RefreshCcw } from 'lucide-react';
import { UserProfile, DomainRule } from '../shared/types';

export default function PopupApp() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('default');
  const [currentDomain, setCurrentDomain] = useState('');
  const [domainRule, setDomainRule] = useState<DomainRule>({
    domain: '',
    enabled: true,
    autoFillOnLoad: false,
    requireConfirmation: false
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isFilling, setIsFilling] = useState(false);

  useEffect(() => {
    // Get current tab URL/domain
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url) {
        try {
          const url = new URL(activeTab.url);
          const domain = url.hostname;
          setCurrentDomain(domain);
          
          // Fetch domain settings
          chrome.runtime.sendMessage({ action: 'getDomainRule', domain }, (response) => {
            if (response && response.rule) {
              setDomainRule(response.rule);
            } else {
              setDomainRule(prev => ({ ...prev, domain }));
            }
          });
        } catch (e) {
          // Internal page or invalid URL
          setCurrentDomain('');
        }
      }
    });

    // Fetch profiles
    chrome.runtime.sendMessage({ action: 'getProfiles' }, (response) => {
      if (response && response.profiles) {
        setProfiles(response.profiles);
      }
    });

    // Fetch active profile ID
    chrome.runtime.sendMessage({ action: 'getActiveProfileId' }, (response) => {
      if (response && response.activeProfileId) {
        setActiveProfileId(response.activeProfileId);
      }
    });
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setActiveProfileId(id);
    chrome.runtime.sendMessage({ action: 'setActiveProfileId', activeProfileId: id });
    showStatus("Active profile updated!");
  };

  const toggleDomainEnabled = () => {
    if (!currentDomain) return;
    const updated = { ...domainRule, enabled: !domainRule.enabled };
    setDomainRule(updated);
    saveDomainRule(updated);
  };

  const toggleAutoFillOnLoad = () => {
    if (!currentDomain) return;
    const updated = { ...domainRule, autoFillOnLoad: !domainRule.autoFillOnLoad };
    setDomainRule(updated);
    saveDomainRule(updated);
  };

  const toggleRequireConfirmation = () => {
    if (!currentDomain) return;
    const updated = { ...domainRule, requireConfirmation: !domainRule.requireConfirmation };
    setDomainRule(updated);
    saveDomainRule(updated);
  };

  const saveDomainRule = (rule: DomainRule) => {
    chrome.runtime.sendMessage({ action: 'saveDomainRule', rule }, () => {
      showStatus("Domain settings saved!");
    });
  };

  const triggerAutofill = () => {
    if (!currentDomain || isFilling) return;
    setIsFilling(true);
    setStatusMessage("Filling page...");
    
    chrome.runtime.sendMessage({
      action: 'autofillPage',
      profileId: activeProfileId
    }, (response) => {
      setIsFilling(false);
      if (response && response.success) {
        showStatus("Form populated successfully!");
      } else {
        showStatus(response?.error || "Autofill failed or no fields found.");
      }
    });
  };

  const openDashboard = () => {
    chrome.runtime.sendMessage({ action: 'openOptionsPage' });
  };

  const showStatus = (text: string) => {
    setStatusMessage(text);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-4 border border-slate-800 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-400 animate-pulse" />
          <span className="font-semibold text-base bg-gradient-to-r from-brand-400 to-indigo-300 bg-clip-text text-transparent">OneClick Autofill AI</span>
        </div>
        <button
          onClick={openDashboard}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1 text-[10px] font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Dashboard
        </button>
      </div>

      {/* Main Body */}
      {currentDomain ? (
        <div className="flex-1 flex flex-col gap-4 pt-4">
          {/* Active Profile */}
          <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Active User Profile
            </label>
            <select
              value={activeProfileId}
              onChange={handleProfileChange}
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

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={triggerAutofill}
              disabled={!domainRule.enabled || isFilling}
              className={`w-full py-2.5 px-4 rounded-xl font-medium text-xs shadow-md shadow-brand-600/20 transition flex items-center justify-center gap-2 cursor-pointer ${
                domainRule.enabled 
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-650 hover:from-brand-500 hover:to-indigo-500 hover:scale-[1.01] text-white' 
                  : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isFilling ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin text-white" />
                  Filling Form...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  Autofill Active Page
                </>
              )}
            </button>
          </div>

          {/* Domain Specific Configuration */}
          <div className="flex-1 flex flex-col gap-2.5 border-t border-slate-850 pt-3">
            <div className="flex justify-between items-center text-xs">
              <div>
                <p className="font-medium text-slate-200">Enable on this domain</p>
                <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{currentDomain}</p>
              </div>
              <button onClick={toggleDomainEnabled} className="cursor-pointer">
                {domainRule.enabled ? (
                  <ToggleRight className="w-8 h-8 text-brand-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>

            <div className="flex justify-between items-center text-xs">
              <div>
                <p className="font-medium text-slate-200">Auto-fill on page load</p>
                <p className="text-[10px] text-slate-500">Scan and fill automatically</p>
              </div>
              <button onClick={toggleAutoFillOnLoad} disabled={!domainRule.enabled} className="cursor-pointer disabled:opacity-50">
                {domainRule.autoFillOnLoad && domainRule.enabled ? (
                  <ToggleRight className="w-8 h-8 text-brand-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>

            <div className="flex justify-between items-center text-xs">
              <div>
                <p className="font-medium text-slate-200">Require confirmation</p>
                <p className="text-[10px] text-slate-500">Approve before filling</p>
              </div>
              <button onClick={toggleRequireConfirmation} disabled={!domainRule.enabled} className="cursor-pointer disabled:opacity-50">
                {domainRule.requireConfirmation && domainRule.enabled ? (
                  <ToggleRight className="w-8 h-8 text-brand-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
          <ShieldCheck className="w-12 h-12 text-slate-600" />
          <div>
            <p className="text-sm font-medium text-slate-300">Invalid Page Context</p>
            <p className="text-xs text-slate-500 mt-1">OneClick Autofill AI cannot run on Chrome internal or system pages.</p>
          </div>
        </div>
      )}

      {/* Footer / Toast Status */}
      {statusMessage ? (
        <div className="mt-3 py-1.5 px-3 rounded bg-brand-950/60 border border-brand-800/40 text-brand-300 text-[10px] text-center font-medium animate-pulse">
          {statusMessage}
        </div>
      ) : (
        <div className="mt-3 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1 border-t border-slate-900 pt-2">
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          <span>Local database encrypted & offline-ready</span>
        </div>
      )}
    </div>
  );
}
