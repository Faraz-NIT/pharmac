// Vercel Node.js serverless function entry point.
// This file is bundled by scripts/vercel-bundle.mjs after vite build.
// esbuild inlines dist/server/server.js and all its dynamic imports into api/server.js.

import server from '../dist/server/server.js'
import { Readable } from 'node:stream'

/**
 * Convert a Node.js IncomingMessage + path to a web Request.
 */
async function toWebRequest(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  const url = `${protocol}://${host}${req.url}`

  let body = undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else {
      headers.set(key, value)
    }
  }

  return new Request(url, { method: req.method, headers, body: body || undefined })
}

/**
 * Send a web Response back through a Node.js ServerResponse.
 */
async function sendWebResponse(webResponse, res) {
  res.statusCode = webResponse.status
  for (const [key, value] of webResponse.headers.entries()) {
    res.setHeader(key, value)
  }

  if (webResponse.body) {
    const reader = webResponse.body.getReader()
    const nodeStream = new Readable({
      async read() {
        const { done, value } = await reader.read()
        if (done) this.push(null)
        else this.push(Buffer.from(value))
      },
    })
    nodeStream.pipe(res)
  } else {
    res.end()
  }
}

export default async function handler(req, res) {
  const request = await toWebRequest(req)
  const response = await server.fetch(request, {}, {})
  await sendWebResponse(response, res)
}
