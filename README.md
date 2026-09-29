# OneClick Autofill AI

A **Chrome Manifest V3 extension** that helps job seekers fill application forms faster. Save your details once, autofill across career sites and ATS embeds (Greenhouse, Lever, company portals), and optionally use **Google Gemini** for open-ended questions grounded in your profile, your notes, and the job description on the page.

Data is stored **locally in your browser** (IndexedDB and `chrome.storage`). You bring your own Gemini API key if you use AI-generated answers.

---

## Table of contents

- [The problem](#the-problem)
- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Install from source](#install-from-source)
- [Build](#build)
- [First-time setup](#first-time-setup)
- [Using the extension](#using-the-extension)
- [Settings reference](#settings-reference)
- [Profiles and documents](#profiles-and-documents)
- [Keyboard shortcut](#keyboard-shortcut)
- [Privacy and permissions](#privacy-and-permissions)
- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Development notes](#development-notes)
- [Troubleshooting](#troubleshooting)

---

## The problem

Job applications repeat the same work on every site: contact info, work history, salary fields, multiple file uploads, and long-form prompts ("Why this company?", "Describe a project you are proud of"). Copy-paste is slow. Generic AI can invent employers or upload your resume into a photo field.

OneClick Autofill AI focuses on **accurate, controlled autofill** for job seekers: offline matching first, targeted file uploads, and optional Gemini answers tied to **your** data.

---

## Features

### Profiles

- Multiple **profiles** (for example "Full-stack", "Data", or the included demo sample profile).
- Sections: personal info, professional details, structured education (10th / 12th / UG / PG), job preferences (CTC, notice period, location).
- **Custom fields** per section for site-specific questions you want to map heuristically.
- Plain-text **cover letter** field for textarea prompts.

### Documents (per profile)

| Document | Used on form fields labeled like |
|----------|-----------------------------------|
| **Resume** | Resume, CV, résumé, curriculum vitae only |
| **Cover letter** | Cover letter or motivation letter uploads |
| **Profile photo** | Photo, avatar, headshot, profile picture, and similar |

Multiple files per type with one **active** file for autofill. Resume is **not** placed on photo, cover letter, or generic document uploads.

### Autofill engine

- **Heuristic matching:** label, placeholder, `name`/`id`, autocomplete, and keyword maps for standard fields.
- **Hybrid mode (Smart):** unmatched fields sent to **Gemini** on **manual** fill (widget, popup, or shortcut), with JSON-structured field resolution.
- **Open-ended questions:** textareas and essay prompts can get AI answers when enabled.
- **Grounded AI:** the prompt includes application memory (global Settings textarea), candidate profile (JSON), job description scraped from the page when enabled, and rules to avoid inventing employers, degrees, or credentials.
- **Iframe support:** content script runs in all frames; the top frame orchestrates cross-origin ATS iframes and forwards job description text to embedded apply forms.
- **Learning:** optional correction learning from edited fields when enabled in Settings.

### UI surfaces

- **Floating widget** on job pages (top frame): profile switcher, Autofill Page, site auto-fill toggle, link to dashboard.
- **Toolbar popup:** quick profile select and autofill trigger.
- **Options dashboard** (full tab): profile editor, Settings, export and import.

### Site control

- Global enable or disable.
- Optional **site allowlist** (empty means all sites).
- Per-domain **auto-fill on load** toggle on the widget; manual autofill remains available when the widget is shown.
- Theme: light, dark, or system.

---

## How it works

```text
 Content script (page + iframes)
        |
        |  scan fields
        v
 Service worker (matchFields)
        |
        |  heuristics + Gemini on manual fill
        v
 IndexedDB + chrome.storage (profiles, files, settings)
        |
        |  match results
        v
 Content script (AutofillEngine fills DOM + file uploads)
```

1. **Scan:** form fields in the accessible document (and same-origin iframes) get metadata (labels, types, options).
2. **Match:** background applies manual domain mappings, heuristics, then Gemini for remaining fields (hybrid and manual fill only).
3. **Resolve files:** resume, cover letter, and photo sentinels are replaced with base64 payloads from IndexedDB at fill time.
4. **Fill:** content script sets values, selects options, and attaches files (with retries for slow ATS uploaders).

**Gemini** is only called when:

- Provider is **Smart (hybrid)**.
- A valid API key is set.
- Fill is **manual** (`manual: true`, from widget, popup, or keyboard command).
- **Answer open-ended questions** is enabled (for generated text).

Automatic fill on page load uses heuristics only (no Gemini).

---

## Requirements

- **Google Chrome** or a Chromium-based browser with Manifest V3 support
- **Node.js** 18+ and npm (to build from source)
- **Optional:** [Google AI Studio](https://aistudio.google.com/) API key for hybrid and open-question answers

---

## Install from source

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd AutoForm
   ```

2. Install dependencies and build:

   ```bash
   npm install
   npm run build
   ```

3. Load the extension in Chrome:

   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the **`dist`** folder (not the repo root)

4. After code or manifest changes, click **Reload** on the extension card and **hard-refresh** open job tabs (`Ctrl+Shift+R` on Windows/Linux, `Cmd+Shift+R` on Mac).

---

## Build

```bash
npm run build
```

This runs:

1. `tsc` for TypeScript check
2. Vite build for **options** and **popup**
3. Vite build for **content script** (`content.js`)
4. Vite build for **service worker** (`background.js`)
5. `post-build.cjs`, which renames bundled CSS to `dist/content.css` for the shadow-DOM widget

Output lives in **`dist/`**, including `manifest.json`, HTML entry points, icons, and scripts.

```bash
npm run dev
```

Runs the Vite dev server for UI work. You still need a production build loaded from `dist` for full content and background testing.

---

## First-time setup

1. Open the extension **Options** (right-click the toolbar icon and choose Options, or open from the widget).
2. **Profiles:** edit or create a profile, then click **Save Profile**.
3. Upload **resume**, optional **cover letter** file, and **profile photo** under Personal and Resume sections (save the profile first).
4. **Settings:**
   - Choose **Smart (hybrid)** if you want Gemini for gaps and essays.
   - Paste your **Google Gemini API key** (stored locally).
   - Fill **Application memory and context** with achievements, motivation, visa notes, and similar.
   - Enable **Use job description from the page** for role-tailored AI answers on manual fill.
5. Reload any job application tabs after changing the extension.

---

## Using the extension

### Floating widget

On supported pages (top window), a floating control appears (bottom-right by default):

- **Autofill Page:** manual fill using the selected profile (runs Gemini in hybrid mode).
- **Active profile** dropdown: switch profiles before filling.
- **Auto-fill on this site:** toggle automatic heuristic fill when the form loads.
- **Settings / dashboard:** opens the full options UI.

### Toolbar popup

Choose the active profile and trigger autofill on the current tab.

### Options dashboard

- **Profiles:** full editor, custom fields, file uploads, delete profile.
- **Settings:** AI provider, API key, model, memory, theme, allowlist, learning, export and import.

---

## Settings reference

| Setting | Description |
|--------|-------------|
| **Offline only** | Heuristic matching only; no Gemini. |
| **Smart (hybrid)** | Heuristics first, then Gemini for unmatched fields on manual fill. |
| **Gemini API key** | Required for hybrid; stored in `chrome.storage.local`. |
| **Model** | e.g. `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`. |
| **AI answers for open-ended questions** | Allows Gemini `generate` strategy for essays and textareas. |
| **Use job description from the page** | Scrapes JD text on manual fill (top frame, forwarded to iframes). |
| **Application memory and context** | Global narrative Gemini should prefer over inventing facts. |
| **Learn from corrections** | Updates learning mappings when you edit filled values. |
| **Auto-fill on load** | Global opt-in; still respects per-site widget toggle. |
| **Site allowlist** | Hostnames only; blank means all sites. |

---

## Profiles and documents

- **Profiles** are stored in IndexedDB (`profiles` store).
- **Files** (resume, cover letter, photo) are stored in IndexedDB (`resumes` store) with `profileId`, `documentType`, and `isDefault`.
- **Export / import:** JSON bundle of profiles and file metadata plus base64 from Settings (backup or migrate browsers).

A demo profile ships with sample "Jane Doe" data for testing. Replace it with your real profile before applying.

---

## Keyboard shortcut

| Command | Default shortcut | Action |
|--------|------------------|--------|
| **Autofill the active tab** | `Alt+Shift+F` (Mac: `Alt+Shift+F`) | Manual autofill in the active tab |

Configure under `chrome://extensions/shortcuts`.

---

## Privacy and permissions

| Permission | Why |
|-----------|-----|
| `storage` | Settings, active profile id, profile cache for UI |
| `activeTab` / `tabs` | Autofill and messaging on job tabs |
| `<all_urls>` | Content scripts on career and application sites |
| `generativelanguage.googleapis.com` | Gemini API calls from the service worker |

- API keys and profile data stay **on device** unless you export JSON yourself.
- Gemini requests send field labels, profile JSON, memory text, and JD excerpts. Review Google's terms before use.

---

## Project structure

```text
AutoForm/
├── public/                 # manifest, icons, static assets copied to dist
├── src/
│   ├── background/         # MV3 service worker (matchFields, storage, commands)
│   ├── content/            # Content script, widget, form scan, autofill engine
│   ├── options/            # Dashboard React app
│   ├── popup/              # Toolbar popup React app
│   └── shared/             # Types, IndexedDB, AI/heuristics, theme, runtime helpers
├── dist/                   # Build output (load this folder in Chrome)
├── post-build.cjs          # CSS rename for content script shadow DOM
├── vite.config.ts          # Popup + options build
├── vite.config.content.ts  # Content IIFE bundle
├── vite.config.background.ts
└── package.json
```

Key modules:

- `src/shared/ai.ts`: heuristic matching, Gemini batch prompts, profile path helpers
- `src/shared/resumeAutofill.ts`: resume, cover letter, and photo field detection
- `src/content/JobDescriptionScanner.ts`: JD extraction heuristics
- `src/content/content.tsx`: bootstrap, widget mount, autofill orchestration

---

## Tech stack

- **React 18** and **TypeScript**
- **Vite 5** (multi-config builds)
- **Tailwind CSS 3**
- **IndexedDB** and **chrome.storage.local**
- **Google Gemini** REST API (`generateContent`, JSON mode)

---

## Development notes

- Content script uses **Shadow DOM** and `content.css` as a web-accessible resource.
- `all_frames: true` in the manifest so embedded ATS forms receive the same script; the parent frame uses **postMessage** to coordinate autofill and job description forwarding.
- File inputs use programmatic `DataTransfer` assignment. Some sites delay upload handlers; `AutofillEngine` includes waits and retries for common ATS patterns.
- Icons can be regenerated with `python scripts/generate-brand-icons.py`. Run manually if your build script does not include the icons step.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Widget not visible | Reload extension; hard-refresh page; use a top-level tab (not chrome:// pages). |
| Nothing fills in iframe | Reload extension after manifest changes; use **Autofill Page** (manual) for Gemini. |
| Gemini warnings | Check API key, model name, and quota in AI Studio; enable hybrid and manual fill. |
| Wrong file on upload | Resume, photo, and cover letter use strict label matching; add custom mappings if needed. |
| "Extension context invalidated" | Extension was reloaded; refresh the job tab. |
| Stale UI after update | Reload extension and hard-refresh all application tabs. |

---

## License

Specify your license here (e.g. MIT). If unpublished, use "All rights reserved" or your chosen open source license.

---

## Contributing

Issues and pull requests are welcome. Please run `npm run build` and test loading `dist/` in Chrome before submitting changes that touch the content script, background worker, or manifest.
