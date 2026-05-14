import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Repository is served at https://faisal-alvi.github.io/dev-dashboard/
// so all asset URLs need to be prefixed with that path in production.
export default defineConfig({
  base: '/dev-dashboard/',
  plugins: [react()],
});
