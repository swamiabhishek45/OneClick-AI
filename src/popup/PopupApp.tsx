import React, { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, ShieldCheck, RefreshCcw } from 'lucide-react';
import { UserProfile } from '../shared/types';
import { ExtensionLogo } from '../shared/ExtensionLogo';
import {
  fetchActiveProfileIdForUi,
  fetchProfilesForUi,
  resolveActiveProfileId,
} from '../shared/profilesCache';

export default function PopupApp() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('default');
  const [currentDomain, setCurrentDomain] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isFilling, setIsFilling] = useState(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.url) {
        try {
          const url = new URL(activeTab.url);
          setCurrentDomain(/^https?:$/.test(url.protocol) ? url.hostname : '');
        } catch {
          setCurrentDomain('');
        }
      }
    });

    void (async () => {
      const list = await fetchProfilesForUi();
      setProfiles(list);
      setActiveProfileId(resolveActiveProfileId(list, await fetchActiveProfileIdForUi()));
    })();
  }, []);

  const selectedProfileId = resolveActiveProfileId(profiles, activeProfileId);

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setActiveProfileId(id);
    chrome.runtime.sendMessage({ action: 'setActiveProfileId', activeProfileId: id });
    showStatus('Active profile updated');
  };

  const triggerAutofill = () => {
    if (!currentDomain || isFilling) return;
    setIsFilling(true);
    setStatusMessage('Filling page...');

    chrome.runtime.sendMessage(
      {
        action: 'autofillPage',
        profileId: selectedProfileId,
      },
      (response) => {
        void chrome.runtime.lastError;
        setIsFilling(false);
        if (response?.success && (response.filledCount ?? 0) > 0) {
          showStatus(
            `Filled ${response.filledCount} field${response.filledCount === 1 ? '' : 's'}`
          );
        } else if (response?.success) {
          showStatus(response.error || 'All fields are already filled.');
        } else {
          showStatus(response?.error || 'Autofill failed or no fields found.');
        }
      }
    );
  };

  const openDashboard = () => {
    chrome.runtime.sendMessage({ action: 'openOptionsPage' });
  };

  const showStatus = (text: string) => {
    setStatusMessage(text);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="flex flex-col h-full ui-page p-4 border border-brand-800/15 dark:border-brand-500/20 rounded-lg">
      <div className="flex justify-between items-center pb-3 border-b border-brand-800/15 dark:border-brand-500/20">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-cream border border-brand-800/15 dark:bg-brand-600/35 dark:border-brand-400/35">
            <ExtensionLogo variant="mark" className="h-[85%] w-[85%]" />
          </div>
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

      {currentDomain ? (
        <div className="flex-1 flex flex-col gap-4 pt-4">
          <div className="ui-panel rounded-xl p-3">
            <label className="block text-[10px] font-semibold text-brand-700/75 uppercase tracking-wider mb-1.5">
              Active profile
            </label>
            <select
              value={selectedProfileId}
              onChange={handleProfileChange}
              className="w-full ui-input rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {profiles.length === 0 && <option value="default">No profiles, open Dashboard</option>}
            </select>
          </div>

          <button
            onClick={triggerAutofill}
            disabled={isFilling}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-xs shadow-md shadow-brand-600/25 transition flex items-center justify-center gap-2 cursor-pointer bg-brand-600 hover:bg-brand-700 hover:scale-[1.01] text-white disabled:opacity-60"
          >
            {isFilling ? (
              <>
                <RefreshCcw className="w-4 h-4 animate-spin text-white" />
                Filling...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                Autofill this page
              </>
            )}
          </button>

          <p className="text-[10px] text-brand-700/65 text-center leading-relaxed">
            Shortcut: <kbd className="font-mono">Alt+Shift+F</kbd>. Use the page FAB for manual field mapping.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
          <ShieldCheck className="w-12 h-12 text-brand-400" />
          <div>
            <p className="text-sm font-medium text-brand-800">Cannot run here</p>
            <p className="text-xs text-brand-700/65 mt-1">
              Open a normal website tab to autofill forms.
            </p>
          </div>
        </div>
      )}

      {statusMessage ? (
        <div className="mt-3 py-1.5 px-3 rounded bg-brand-100 border border-brand-300/50 text-brand-800 text-[10px] text-center font-medium">
          {statusMessage}
        </div>
      ) : (
        <div className="mt-3 text-[10px] text-brand-700/65 text-center border-t border-brand-800/10 pt-2">
          Data stored locally on this device
        </div>
      )}
    </div>
  );
}
