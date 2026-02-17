/// <reference types="vitest/config" />
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import ssrPlugin from 'vite-ssr-components/plugin'

export default defineConfig(({ mode }) => {
  // Exclude Cloudflare plugin during test mode to avoid conflicts
  const isTest = mode === 'test' || process.env.VITEST === 'true'

  return {
    plugins: isTest
      ? [tailwindcss()]
      : [cloudflare(), ssrPlugin(), tailwindcss()],
    test: {
      exclude: ['src/renderer.tsx', 'node_modules/**'],
      environment: 'node',
      globals: true,
      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/renderer.tsx',
          'src/index.tsx',
          'src/client.tsx',
          '**/*.d.ts',
          'node_modules/**',
        ],
        thresholds: {
          lines: 70,
          branches: 70,
          functions: 70,
          statements: 70,
        },
        reportsDirectory: './coverage',
        reporter: ['text', 'html', 'lcov'],
      },
    },
  }
})
