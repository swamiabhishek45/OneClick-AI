import React, { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, ShieldCheck, Flame, ToggleLeft, ToggleRight, RefreshCcw } from 'lucide-react';
import { UserProfile, DomainRule } from '../shared/types';
import { ExtensionLogo } from '../shared/ExtensionLogo';

export default function PopupApp() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('default');
  const [currentDomain, setCurrentDomain] = useState('');
  const [domainRule, setDomainRule] = useState<DomainRule>({
    domain: '',
    enabled: true,
    autoFillOnLoad: true,
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
      if (response?.success && (response.filledCount ?? 0) > 0) {
        showStatus(`Filled ${response.filledCount} field${response.filledCount === 1 ? '' : 's'} successfully!`);
      } else if (response?.success) {
        showStatus(response.error || "All fields are already filled.");
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
    <div className="flex flex-col h-full ui-page p-4 border border-brand-800/15 dark:border-brand-500/20 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-brand-800/15 dark:border-brand-500/20">
        <div className="flex items-center gap-2">
          <ExtensionLogo variant="mark" className="h-8 w-8 rounded-lg" />
          <span className="font-semibold text-base ui-heading">OneClick Autofill AI</span>
        </div>
        <button
          onClick={openDashboard}
          className="p-1.5 rounded-lg ui-input hover:bg-cream-200 dark:hover:bg-brand-800/50 transition cursor-pointer flex items-center gap-1 text-[10px] font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Dashboard
        </button>
      </div>

      {/* Main Body */}
      {currentDomain ? (
        <div className="flex-1 flex flex-col gap-4 pt-4">
          {/* Active Profile */}
          <div className="ui-panel rounded-xl p-3">
            <label className="block text-[10px] font-semibold text-brand-700/75 uppercase tracking-wider mb-1.5">
              Active User Profile
            </label>
            <select
              value={activeProfileId}
              onChange={handleProfileChange}
              className="w-full ui-input rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
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
              disabled={isFilling}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-xs shadow-md shadow-brand-600/25 transition flex items-center justify-center gap-2 cursor-pointer bg-brand-600 hover:bg-brand-700 hover:scale-[1.01] text-white disabled:opacity-60"
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
          <div className="flex-1 flex flex-col gap-2.5 border-t border-brand-800/15 dark:border-brand-500/20 pt-3">
            <div className="flex justify-between items-center text-xs">
              <div>
                <p className="font-medium text-brand-900">Automatic filling on this domain</p>
                <p className="text-[10px] text-brand-700/65 truncate max-w-[180px]">{currentDomain}</p>
              </div>
              <button onClick={toggleDomainEnabled} className="cursor-pointer">
                {domainRule.enabled ? (
                  <ToggleRight className="w-8 h-8 text-brand-600" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-brand-400" />
                )}
              </button>
            </div>

            <div className="flex justify-between items-center text-xs">
              <div>
                <p className="font-medium text-brand-900">Auto-fill on page load</p>
                <p className="text-[10px] text-brand-700/65">Scan and fill automatically</p>
              </div>
              <button onClick={toggleAutoFillOnLoad} disabled={!domainRule.enabled} className="cursor-pointer disabled:opacity-50">
                {domainRule.autoFillOnLoad && domainRule.enabled ? (
                  <ToggleRight className="w-8 h-8 text-brand-600" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-brand-400" />
                )}
              </button>
            </div>

            <div className="flex justify-between items-center text-xs">
              <div>
                <p className="font-medium text-brand-900">Require confirmation</p>
                <p className="text-[10px] text-brand-700/65">Approve before filling</p>
              </div>
              <button onClick={toggleRequireConfirmation} disabled={!domainRule.enabled} className="cursor-pointer disabled:opacity-50">
                {domainRule.requireConfirmation && domainRule.enabled ? (
                  <ToggleRight className="w-8 h-8 text-brand-600" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-brand-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
          <ShieldCheck className="w-12 h-12 text-brand-400" />
          <div>
            <p className="text-sm font-medium text-brand-800">Invalid Page Context</p>
            <p className="text-xs text-brand-700/65 mt-1">OneClick Autofill AI cannot run on Chrome internal or system pages.</p>
          </div>
        </div>
      )}

      {/* Footer / Toast Status */}
      {statusMessage ? (
        <div className="mt-3 py-1.5 px-3 rounded bg-brand-100 border border-brand-300/50 text-brand-800 text-[10px] text-center font-medium animate-pulse">
          {statusMessage}
        </div>
      ) : (
        <div className="mt-3 text-[10px] text-brand-700/65 text-center flex items-center justify-center gap-1 border-t border-brand-800/10 pt-2">
          <Flame className="w-3.5 h-3.5 text-brand-600" />
          <span>Local database encrypted & offline-ready</span>
        </div>
      )}
    </div>
  );
}
