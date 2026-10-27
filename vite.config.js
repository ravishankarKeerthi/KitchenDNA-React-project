import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages project-site path is set by the repository name.
  // If your repository is not named "kitchendna", change this to `/${repo-name}/`.
  base: '/KitchenDNA-React-project/'
});
