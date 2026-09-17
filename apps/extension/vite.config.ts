import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html',
        background: 'src/background/service-worker.ts',
        content: 'src/content/content-script.ts'
      },
      output: {
        entryFileNames: '[name].js'
      }
    }
  }
})
