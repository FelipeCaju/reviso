import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execFileSync } from 'node:child_process'

function gitValue(args, fallback) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const appVersion = process.env.npm_package_version || '1.0.0';
const commitDate = gitValue(['log', '-1', '--format=%cs'], 'sem-data').replaceAll('-', '');
const commitId = gitValue(['log', '-1', '--format=%h'], 'local');
const buildLabel = `Versão ${appVersion} · Build ${commitDate}.${commitId}`;

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
