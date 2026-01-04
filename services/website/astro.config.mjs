import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Static site generation for GitHub Pages
  output: 'static',
  
  // Site URL - set via environment variable for GitHub Pages
  // Example: SITE_URL=https://username.github.io
  site: process.env.SITE_URL || 'http://localhost:4321',
  
  // Base path for repo deployment (e.g., /repo-name/)
  // Set via environment variable: BASE_PATH=/The-Worlds-Largest-Dungeon/
  base: process.env.BASE_PATH || '/',
  
  // Build configuration
  build: {
    // Output assets with hashed filenames for cache busting
    assets: 'assets',
  },
  
  // Vite configuration
  vite: {
    define: {
      // Make environment variables available to client-side code
      'import.meta.env.CHAT_API_URL': JSON.stringify(
        process.env.CHAT_API_URL || 'http://localhost:8080'
      ),
    },
  },
});
