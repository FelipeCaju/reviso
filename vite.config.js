import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const versionFile = fileURLToPath(new URL('./config/version.php', import.meta.url));
const versionConfig = readFileSync(versionFile, 'utf8');

function versionConstant(name) {
  const match = versionConfig.match(new RegExp(`const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]`));
  if (!match) throw new Error(`Constante ${name} não encontrada em config/version.php`);
  return match[1];
}

const appVersion = versionConstant('APP_VERSION');
const appBuild = versionConstant('APP_BUILD');
const commit = process.env.APP_COMMIT_SHA?.slice(0, 7);
const buildLabel = `Versão ${appVersion} · Build ${appBuild}${commit ? ` · ${commit}` : ''}`;

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_LABEL__: JSON.stringify(buildLabel),
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});
