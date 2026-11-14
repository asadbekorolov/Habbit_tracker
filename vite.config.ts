import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        // Kutubxonalar alohida bo'laklarda: ilova kodi o'zgarganda ular
        // keshdan olinadi va asosiy bo'lak yengil bo'ladi.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules[\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\/]/.test(id)) return 'vendor-react'
          if (/node_modules[\/]@supabase[\/]/.test(id)) return 'vendor-supabase'
          if (/node_modules[\/](framer-motion|motion-dom|motion-utils)[\/]/.test(id)) return 'vendor-motion'
          if (/node_modules[\/]@tanstack[\/]/.test(id)) return 'vendor-query'
          return undefined
        },
      },
    },
  },
}))
