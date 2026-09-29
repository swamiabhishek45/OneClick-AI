# OneClick Autofill AI

A **Chrome Manifest V3 extension** that helps job seekers fill application forms faster. Save your details once, autofill across career sites and ATS embeds (Greenhouse, Lever, company portals), and optionally use **Google Gemini** for open-ended questions grounded in your profile, your notes, and the job description on the page.

Data is stored **locally in your browser** (IndexedDB + `chrome.storage`). You bring your own Gemini API key if you use AI-generated answers.

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
- [Profiles & documents](#profiles--documents)
- [Keyboard shortcut](#keyboard-shortcut)
- [Privacy & permissions](#privacy--permissions)
- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Development notes](#development-notes)
- [Troubleshooting](#troubleshooting)

---

## The problem

Job applications repeat the same work on every site: contact info, work history, salary fields, three different file uploads, and long-form prompts (“Why this company?”, “Describe a project you’re proud of”). Copy-paste is slow; generic AI can invent employers or upload your resume into a photo field.

OneClick Autofill AI focuses on **accurate, controlled autofill** for job seekers: offline matching first, targeted file uploads, and optional Gemini answers tied to **your** data.

---

## Features

### Profiles

- Multiple **profiles** (e.g. “Full-stack”, “Data”, demo sample profile).
- Sections: personal info, professional details, structured education (10th / 12th / UG / PG), job preferences (CTC, notice period, location).
- **Custom fields** per section for site-specific questions you want to map heuristically.
- Plain-text **cover letter** field for textarea prompts.

### Documents (per profile)

| Document        | Used on form fields labeled like…                          |
|----------------|-------------------------------------------------------------|
| **Resume**     | Resume, CV, résumé, curriculum vitae only                  |
| **Cover letter** | Cover letter / motivation letter uploads                 |
| **Profile photo** | Photo, avatar, headshot, profile picture, etc.          |

Multiple files per type with one **active** file for autofill. Resume is **not** placed on photo, cover letter, or generic document uploads.

### Autofill engine

- **Heuristic matching** — Label, placeholder, `name`/`id`, autocomplete, and keyword maps for standard fields.
- **Hybrid mode (Smart)** — Unmatched fields sent to **Gemini** on **manual** fill (widget / popup / shortcut), with JSON-structured field resolution.
- **Open-ended questions** — Textareas and essay prompts can get AI answers when enabled.
- **Grounded AI** — Prompt includes:
  - **Application memory & context** (global Settings textarea),
  - **Candidate profile** (JSON),
  - **Job description** scraped from the page (when enabled),
  - Rules to avoid inventing employers, degrees, or credentials.
- **Iframe support** — Content script runs in all frames; top frame orchestrates cross-origin ATS iframes and forwards job description text to embedded apply forms.
- **Learning** — Optional correction learning from edited fields (when enabled in Settings).

### UI surfaces

- **Floating widget** on job pages (top frame): profile switcher, Autofill Page, site auto-fill toggle, link to dashboard.
- **Toolbar popup** — Quick profile select and autofill trigger.
- **Options dashboard** (full tab) — Profile editor, Settings, export/import.

### Site control

- Global enable/disable.
- Optional **site allowlist** (empty = all sites).
- Per-domain **auto-fill on load** toggle (widget); manual autofill always available when the widget is shown.
- Theme: light, dark, or system.

---

## How it works

```text
┌─────────────────┐     scan fields      ┌──────────────────┐
│  Content script │ ──────────────────►  │ Service worker   │
│  (page + iframes)│ ◄── match results ─ │  matchFields     │
└────────┬────────┘                      └────────┬─────────┘
         │                                          │
         │  fill DOM                                │ heuristics
         ▼                                          │ + Gemini (manual)
┌─────────────────┐                      ┌────────▼─────────┐
│ AutofillEngine  │                      │ IndexedDB        │
│ + file uploads  │                      │ profiles, files  │
└─────────────────┘                      │ chrome.storage   │
                                           └──────────────────┘
```

1. **Scan** — Form fields in the accessible document (and same-origin iframes) get metadata (labels, types, options).
2. **Match** — Background applies manual domain mappings, heuristics, then Gemini for remaining fields (hybrid + manual only).
3. **Resolve files** — Resume / cover letter / photo sentinels are replaced with base64 payloads from IndexedDB at fill time.
4. **Fill** — Content script sets values, selects options, and attaches files (with retries for slow ATS uploaders).

**Gemini** is only called when:

- Provider is **Smart (hybrid)**,
- A valid API key is set,
- Fill is **manual** (`manual: true` — widget, popup, command),
- **Answer open-ended questions** is enabled (for generated text).

Automatic fill on page load uses heuristics only (no Gemini).

---

## Requirements

- **Google Chrome** or Chromium-based browser with Manifest V3 support
- **Node.js** 18+ and npm (to build from source)
- **Optional:** [Google AI Studio](https://aistudio.google.com/) API key for hybrid / open-question answers

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

4. After code or manifest changes, click **Reload** on the extension card and **hard-refresh** open job tabs (`Ctrl+Shift+R` / `Cmd+Shift+R`).

---

## Build

```bash
npm run build
```

This runs:

1. `tsc` — TypeScript check  
2. Vite build for **options** + **popup**  
3. Vite build for **content script** (`content.js`)  
4. Vite build for **service worker** (`background.js`)  
5. `post-build.cjs` — Renames bundled CSS to `dist/content.css` for the shadow-DOM widget  

Output lives in **`dist/`**, including `manifest.json`, HTML entry points, icons, and scripts.

```bash
npm run dev
```

Runs the Vite dev server for UI work; the extension still needs a production build loaded from `dist` for full content/background testing.

---

## First-time setup

1. Open the extension **Options** (right-click toolbar icon → Options, or from the widget).
2. **Profiles** — Edit or create a profile; click **Save Profile**.
3. Upload **resume**, optional **cover letter** file, and **profile photo** under Personal / Resume sections (save profile first).
4. **Settings**:
   - Choose **Smart (hybrid)** if you want Gemini for gaps and essays.
   - Paste your **Google Gemini API key** (stored locally).
   - Fill **Application memory & context** with achievements, motivation, visa notes, etc.
   - Enable **Use job description from the page** for role-tailored AI answers on manual fill.
5. Reload any job application tabs after changing the extension.

---

## Using the extension

### Floating widget

On supported pages (top window), a floating control appears (bottom-right by default):

- **Autofill Page** — Manual fill using the selected profile (runs Gemini in hybrid mode).
- **Active profile** dropdown — Switch profiles before filling.
- **Auto-fill on this site** — Toggle automatic heuristic fill when the form loads.
- **Settings / dashboard** — Opens the full options UI.

### Toolbar popup

Choose active profile and trigger autofill on the current tab.

### Options dashboard

- **Profiles** — Full editor, custom fields, file uploads, delete profile.
- **Settings** — AI provider, API key, model, memory, theme, allowlist, learning, export/import.

---

## Settings reference

| Setting | Description |
|--------|-------------|
| **Offline only** | Heuristic matching only; no Gemini. |
| **Smart (hybrid)** | Heuristics first, then Gemini for unmatched fields on manual fill. |
| **Gemini API key** | Required for hybrid; stored in `chrome.storage.local`. |
| **Model** | e.g. `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`. |
| **AI answers for open-ended questions** | Allows Gemini `generate` strategy for essays / textareas. |
| **Use job description from the page** | Scrapes JD text on manual fill (top frame + forwarded to iframes). |
| **Application memory & context** | Global narrative Gemini must prefer over inventing facts. |
| **Learn from corrections** | Updates learning mappings when you edit filled values. |
| **Auto-fill on load** | Global opt-in; still respects per-site widget toggle. |
| **Site allowlist** | Hostnames only; blank = all sites. |

---

## Profiles & documents

- **Profiles** are stored in IndexedDB (`profiles` store).
- **Files** (resume, cover letter, photo) are stored in IndexedDB (`resumes` store) with `profileId`, `documentType`, and `isDefault`.
- **Export / import** — JSON bundle of profiles and file metadata + base64 from Settings (backup or migrate browsers).

Demo profile ships with sample “Jane Doe” data for testing; replace with your real profile before applying.

---

## Keyboard shortcut

| Command | Default shortcut | Action |
|--------|------------------|--------|
| **Autofill the active tab** | `Alt+Shift+F` (Mac: `Alt+Shift+F`) | Manual autofill in the active tab |

Configure under `chrome://extensions/shortcuts`.

---

## Privacy & permissions

| Permission | Why |
|-----------|-----|
| `storage` | Settings, active profile id, profile cache for UI |
| `activeTab` / `tabs` | Autofill and messaging on job tabs |
| `<all_urls>` | Content scripts on career / application sites |
| `generativelanguage.googleapis.com` | Gemini API calls from the service worker |

- API keys and profile data stay **on device** unless you export JSON yourself.
- Gemini requests send field labels, profile JSON, memory text, and JD excerpts—review Google’s terms before use.

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
├── dist/                   # Build output — load this folder in Chrome
├── post-build.cjs          # CSS rename for content script shadow DOM
├── vite.config.ts          # Popup + options build
├── vite.config.content.ts  # Content IIFE bundle
├── vite.config.background.ts
└── package.json
```

Key modules:

- `src/shared/ai.ts` — Heuristic matching, Gemini batch prompts, profile path helpers  
- `src/shared/resumeAutofill.ts` — Resume / cover letter / photo field detection  
- `src/content/JobDescriptionScanner.ts` — JD extraction heuristics  
- `src/content/content.tsx` — Bootstrap, widget mount, autofill orchestration  

---

## Tech stack

- **React 18** + **TypeScript**
- **Vite 5** (multi-config builds)
- **Tailwind CSS 3**
- **IndexedDB** + **chrome.storage.local**
- **Google Gemini** REST API (`generateContent`, JSON mode)

---

## Development notes

- Content script uses **Shadow DOM** + `content.css` as a web-accessible resource.
- `all_frames: true` in the manifest so embedded ATS forms receive the same script; parent frame **postMessage** coordinates autofill and job description forwarding.
- File inputs use programmatic `DataTransfer` assignment; some sites delay upload handlers—`AutofillEngine` includes waits/retries for common ATS patterns.
- Icons can be regenerated: `python scripts/generate-brand-icons.py` (also run as part of `npm run build` if wired in your branch; current `package.json` build script may omit icons—run manually if needed).

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Widget not visible | Reload extension; hard-refresh page; ensure top-level tab (not chrome:// pages). |
| Nothing fills in iframe | Reload extension after manifest changes; use **Autofill Page** (manual) for Gemini. |
| Gemini warnings | Check API key, model name, quota in AI Studio; enable hybrid + manual fill. |
| Wrong file on upload | Resume/photo/cover letter use strict label matching; rename fields or add custom mappings. |
| “Extension context invalidated” | Extension was reloaded; refresh the job tab. |
| Stale UI after update | Reload extension + hard-refresh all application tabs. |

---

## License

Specify your license here (e.g. MIT). If unpublished, “All rights reserved” or your chosen OSS license.

---

## Contributing

Issues and pull requests welcome. Please run `npm run build` and test loading `dist/` in Chrome before submitting changes that touch the content script, background worker, or manifest.
