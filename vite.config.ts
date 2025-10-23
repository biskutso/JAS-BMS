import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import type { UserConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@assets': resolve(process.cwd(), './src/assets'),
      '@components': resolve(process.cwd(), './src/components'),
      '@pages': resolve(process.cwd(), './src/pages'),
      '@hooks': resolve(process.cwd(), './src/hooks'),
      '@context': resolve(process.cwd(), './src/context'),
      '@utils': resolve(process.cwd(), './src/utils'),
      '@router': resolve(process.cwd(), './src/router'),
      '@models': resolve(process.cwd(), './src/types')
    }
  },
  server: {
    port: 3000,
    open: true
  }
} as UserConfig)