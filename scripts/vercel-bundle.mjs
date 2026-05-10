// Post-build script: bundles dist/server/server.js (TanStack Start SSR handler)
// together with the Vercel Node.js wrapper (src/vercel-entry.js) into api/server.js.
// Run after `vite build` via the "build:vercel" npm script.

import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('api', { recursive: true })

await build({
  entryPoints: ['src/vercel-entry.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile: 'api/server.js',
  // Keep Node.js built-ins external — the Vercel Node.js runtime provides them.
  packages: 'external',
  external: ['node:*'],
  // Bundle dynamic imports (resolves import("./assets/…") inline).
  splitting: false,
  logLevel: 'info',
})

console.log('✓ Vercel function bundled → api/server.js')
