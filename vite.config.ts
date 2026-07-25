import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName = 'jakejohnsonforcongressthermometercheck'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves project sites under /<repo>/
  base: process.env.GITHUB_PAGES === 'true' ? `/${repoName}/` : '/',
})
