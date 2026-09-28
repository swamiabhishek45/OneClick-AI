/// <reference types="vite/client" />
/// <reference types="chrome" />
/// <reference types="node" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
