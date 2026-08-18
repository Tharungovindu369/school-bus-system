import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Plugin: substitutes __VITE_FIREBASE_*__ placeholders in the built SW file
// with real env values at build time (service workers can't use import.meta.env).
function injectSwEnv() {
  return {
    name: 'inject-sw-env',
    writeBundle() {
      const swPath = path.resolve(__dirname, 'dist/firebase-messaging-sw.js');
      if (!fs.existsSync(swPath)) return;
      let content = fs.readFileSync(swPath, 'utf8');
      const replacements = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID',
      ];
      for (const key of replacements) {
        content = content.replaceAll(`__${key}__`, process.env[key] || '');
      }
      fs.writeFileSync(swPath, content);
      console.log('[inject-sw-env] Injected Firebase env vars into firebase-messaging-sw.js');
    },
  };
}

export default defineConfig({
  plugins: [react(), injectSwEnv()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
});
