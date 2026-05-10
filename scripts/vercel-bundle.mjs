// Post-build script: uses the Vercel Build Output API v3 to write the SSR function
// and static assets to .vercel/output/, giving Vercel full routing control.
// Run after `vite build` via the "build:vercel" npm script.

import { build } from 'esbuild'
import { mkdirSync, cpSync, writeFileSync } from 'node:fs'

const FUNC = '.vercel/output/functions/index.func'

mkdirSync(FUNC, { recursive: true })
mkdirSync('.vercel/output/static', { recursive: true })

// Bundle the TanStack Start SSR handler + Vercel adapter into a single ESM file.
// esbuild follows the dynamic import in dist/server/server.js to bundle everything inline.
await build({
  entryPoints: ['src/vercel-entry.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: `${FUNC}/index.js`,
  splitting: false,
  logLevel: 'info',
})

// Mark function directory as ESM so Node.js loads index.js as an ES module.
writeFileSync(`${FUNC}/package.json`, JSON.stringify({ type: 'module' }))

// Vercel serverless function config.
writeFileSync(`${FUNC}/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs20.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
}, null, 2))

// Copy static assets (JS, CSS, images) from the Vite client build.
cpSync('dist/client', '.vercel/output/static', { recursive: true })

// Route config: serve existing static files first, fall through to the SSR function.
writeFileSync('.vercel/output/config.json', JSON.stringify({
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index' },
  ]
}, null, 2))

console.log('✓ Vercel Build Output API → .vercel/output/')
