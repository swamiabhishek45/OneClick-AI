import React from 'react';
import { createRoot } from 'react-dom/client';
import OptionsApp from './OptionsApp.tsx';
import '../index.css';
import { initExtensionTheme, watchThemeChanges, applyThemeSetting } from '../shared/theme';

async function bootstrap() {
  await initExtensionTheme();
  watchThemeChanges((_resolved, setting) => {
    applyThemeSetting(setting);
  });

  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <OptionsApp />
      </React.StrictMode>
    );
  }
}

bootstrap();
