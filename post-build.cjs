const fs = require('fs');
const path = require('path');

const distAssets = path.join(__dirname, 'dist/assets');
const distDir = path.join(__dirname, 'dist');

try {
  const styleCssPath = path.join(distDir, 'style.css');
  const destPath = path.join(distDir, 'content.css');

  if (fs.existsSync(styleCssPath)) {
    fs.renameSync(styleCssPath, destPath);
    console.log(`[Post-Build] Renamed dist/style.css to dist/content.css successfully.`);
  } else if (fs.existsSync(distAssets)) {
    const files = fs.readdirSync(distAssets);
    const cssFile = files.find(f => f.endsWith('.css'));
    
    if (cssFile) {
      const srcPath = path.join(distAssets, cssFile);
      fs.copyFileSync(srcPath, destPath);
      console.log(`[Post-Build] Copied assets/${cssFile} to dist/content.css successfully.`);
    } else {
      console.warn('[Post-Build] Warning: No CSS file found in dist/assets or dist/.');
    }
  } else {
    console.error('[Post-Build] Error: dist/assets directory does not exist and no dist/style.css found.');
  }
} catch (e) {
  console.error('[Post-Build] Error running post-build script:', e);
}
