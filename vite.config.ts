import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      closeBundle() {
        // Copy manifest.json to dist
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        )
        // Copy icon if it exists
        try {
          copyFileSync(
            resolve(__dirname, 'orbit-icon.png'),
            resolve(__dirname, 'dist/orbit-icon.png')
          )
        } catch (e) {
          console.warn('orbit-icon.png not found, skipping...')
        }
      }
    }
  ],
})
