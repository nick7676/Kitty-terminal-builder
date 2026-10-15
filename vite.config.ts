import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { kittyStatusPlugin } from './scripts/status-bridge.ts'

export default defineConfig({
  plugins: [react(), kittyStatusPlugin()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
})
