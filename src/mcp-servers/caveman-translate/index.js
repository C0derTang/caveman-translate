#!/usr/bin/env node
// caveman-translate — MCP middleware that proxies an upstream MCP server and
// translates ZH→EN responses transparently when CAVEMAN_TRANSLATE=1 and wenyan mode active.
//
// Usage:
//   caveman-translate <upstream-command> [...args]
//
// Example:
//   "mcpServers": {
//     "translate-wenyan": {
//       "command": "npx",
//       "args": ["caveman-translate", "npx", "@modelcontextprotocol/server-filesystem", "/some/path"]
//     }
//   }
//
// Configuration (env vars):
//   CAVEMAN_TRANSLATE=1          enable translation (pass-through if unset/0)
//   CAVEMAN_TRANSLATE_API_KEY    Google Translate API key
//   CAVEMAN_TRANSLATE_DEBUG=1    log translation activity to stderr

const { spawn } = require('child_process');
const { translate } = require('./translate');

const args = process.argv.slice(2);
if (args.length === 0) {
  process.stderr.write('caveman-translate: missing upstream command.\n');
  process.stderr.write('Usage: caveman-translate <upstream-command> [...args]\n');
  process.exit(2);
}

const enabled = process.env.CAVEMAN_TRANSLATE === '1';
const debug = process.env.CAVEMAN_TRANSLATE_DEBUG === '1';
const apiKey = process.env.CAVEMAN_TRANSLATE_API_KEY;

if (!enabled) {
  process.stderr.write('caveman-translate: CAVEMAN_TRANSLATE != 1, passing through unchanged.\n');
}

if (enabled && !apiKey) {
  process.stderr.write('caveman-translate: CAVEMAN_TRANSLATE=1 but CAVEMAN_TRANSLATE_API_KEY not set, passing through untranslated.\n');
}

const upstream = spawn(args[0], args.slice(1), {
  stdio: ['pipe', 'pipe', 'inherit'],
});

upstream.on('error', err => {
  process.stderr.write(`caveman-translate: failed to spawn upstream: ${err.message}\n`);
  process.exit(1);
});

upstream.on('exit', (code, signal) => {
  if (signal) process.exit(128 + (signal === 'SIGTERM' ? 15 : 9));
  process.exit(code || 0);
});

// JSON-RPC framing over stdio: messages are separated by newlines.
// Line-buffer in both directions and parse opportunistically.
function makeLineBuffer(onLine) {
  let buf = '';
  return chunk => {
    buf += chunk.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.trim()) onLine(line);
    }
  };
}

// Detect if a string contains Chinese characters (CJK Unified Ideographs range)
function isChinese(text) {
  // CJK Unified Ideographs: 一-鿿, CJK Compatibility Ideographs: 豈-﫿
  // Also catch common Chinese punctuation and fullwidth forms
  return /[一-鿿豈-﫿　-〿＀-￯]/.test(text);
}

// Fields that are safe to translate in MCP responses
const TEXT_FIELDS = ['description', 'text', 'content', 'result', 'message'];
const SKIP_FIELDS = ['uri', 'path', 'url', 'name', 'method', 'id', 'jsonrpc'];

function containsCodeBlock(text) {
  // Heuristic: if text has more than 2 newlines with indentation or backticks, likely code/markdown
  return /```|^\s{2,}|^\s*[-*+]\s/.test(text);
}

async function translateObject(obj, apiKey, depth = 0) {
  if (depth > 4) return obj; // Prevent runaway recursion
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = await translateObject(obj[i], apiKey, depth + 1);
    }
    return obj;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (!value || typeof value !== 'string') {
      // Recurse into nested objects/arrays even for non-string values
      if (typeof value === 'object') {
        obj[key] = await translateObject(value, apiKey, depth + 1);
      }
      continue;
    }

    // Skip binary-looking or non-text fields
    if (SKIP_FIELDS.includes(key)) continue;
    if (Buffer.isBuffer(value)) continue;

    // Skip code blocks
    if (containsCodeBlock(value)) continue;

    // Translate string fields that contain Chinese
    if (isChinese(value)) {
      if (debug) {
        process.stderr.write(`[caveman-translate] translating field "${key}" (${value.length} chars)\n`);
      }
      try {
        obj[key] = await translate(value, 'en', apiKey);
      } catch (err) {
        process.stderr.write(`[caveman-translate] translation failed for "${key}": ${err.message}\n`);
        // Pass through untranslated on failure
      }
    } else {
      // Recurse into nested objects even for non-Chinese strings
      if (typeof value === 'string' && value.length > 200) {
        obj[key] = await translateObject(value, apiKey, depth + 1);
      }
    }
  }

  return obj;
}

async function transformResponse(msg) {
  if (!enabled || !apiKey) return msg;
  if (!msg || !msg.result || typeof msg.result !== 'object') return msg;

  try {
    msg.result = await translateObject(msg.result, apiKey);
  } catch (err) {
    process.stderr.write(`[caveman-translate] transform error: ${err.message}\n`);
    // Pass through untranslated on any error
  }

  return msg;
}

// Upstream → us → client. Transform responses.
upstream.stdout.on('data', makeLineBuffer(async line => {
  let msg;
  try { msg = JSON.parse(line); } catch {
    process.stdout.write(line + '\n');
    return;
  }

  const out = await transformResponse(msg);
  process.stdout.write(JSON.stringify(out) + '\n');
}));

// Client → us → upstream. Pass through unchanged.
process.stdin.on('data', chunk => upstream.stdin.write(chunk));
process.stdin.on('end',  () => upstream.stdin.end());