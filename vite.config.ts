import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  // Load environment variables from process.env and local .env files
  const env = loadEnv(mode, process.cwd(), '');

  // Search both process.env and loaded Vite env
  const allEnv = { ...process.env, ...env };

  // Helper to find any key matching a pattern, and strip potential quotes, commas, or trailing colons
  const findAndCleanEnv = (pattern: RegExp): string => {
    for (const key of Object.keys(allEnv)) {
      // Skip Gemini API keys to avoid false positives
      if (key.toUpperCase().includes('GEMINI')) {
        continue;
      }
      if (pattern.test(key)) {
        let val = (allEnv[key] || '').trim();
        let prev = '';
        // Recursively strip outer quotes, commas, semicolons, colons, and spaces
        while (val !== prev) {
          prev = val;
          val = val.replace(/^['"\s,;:]+|['"\s,;:]+$/g, '').trim();
        }
        return val;
      }
    }
    return '';
  };

  const apiKey = findAndCleanEnv(/api[_-]?key/i);
  const authDomain = findAndCleanEnv(/auth[_-]?domain/i);
  const projectId = findAndCleanEnv(/project[_-]?id/i);
  const storageBucket = findAndCleanEnv(/storage[_-]?bucket/i);
  const messagingSenderId = findAndCleanEnv(/messaging[_-]?sender[_-]?id/i);
  const appId = findAndCleanEnv(/app[_-]?id/i);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      // Expose the cleaned keys directly to import.meta.env for robust browser access
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(authDomain),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(projectId),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(storageBucket),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(messagingSenderId),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(appId),

      // Also support standard process.env fallback compatibility
      'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(apiKey),
      'process.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(authDomain),
      'process.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(projectId),
      'process.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(storageBucket),
      'process.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(messagingSenderId),
      'process.env.VITE_FIREBASE_APP_ID': JSON.stringify(appId),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
