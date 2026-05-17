#!/usr/bin/env node
// line-broadcast MCP server (zero-dep, stdio JSON-RPC 2.0)
//
// Implements 8 tools used by the /broadcast workflow:
//   update_products, cache_status, list_tags, pick_products,
//   estimate_recipients, build_flex_2up, list_scheduled_broadcasts, submit_broadcast
//
// Env:
//   AUTH_COOKIE_PATH  path to file containing single-line cookie
//                     (default: <cwd>/.auth-cookie)
//
// Use with any MCP-compatible client (Claude Desktop, Cursor, Cline, etc.).
// See mcp/README.md for client config snippets.

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const { spawn } = require('child_process');

const PLUGIN_ROOT    = path.resolve(__dirname, '..');
const CACHE_PATH     = path.join(PLUGIN_ROOT, '.cache', 'cny-products.json');
const REFRESH_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'refresh-cache.cjs');
const FLEX_SCRIPT    = path.join(PLUGIN_ROOT, 'scripts', 'build-flex-2up.cjs');
const INBOX_HOST     = 'inbox.re-ya.com';

// ── helpers ─────────────────────────────────────────────────────────
function readCookie() {
  const explicit = process.env.AUTH_COOKIE_PATH;
  const candidates = explicit ? [explicit] : [path.join(process.cwd(), '.auth-cookie')];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').replace(/\r?\n/g, '').trim();
  }
  throw new Error(`cookie not found. Set AUTH_COOKIE_PATH or place .auth-cookie in cwd (${process.cwd()}).`);
}

function httpsRequest(method, urlStr, { cookie, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const headers = {};
    if (cookie) headers['Cookie'] = cookie;
    if (body)   { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
    const req = https.request({
      hostname: url.hostname, port: 443, path: url.pathname + url.search,
      method, headers, timeout: 25000,
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data; try { data = JSON.parse(raw); } catch { data = raw; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout 25s')));
    if (body) req.write(body);
    req.end();
  });
}

function spawnNode(script, args = [], stdin = null) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script, ...args], { stdio: ['pipe','pipe','pipe'] });
    const out = [], err = [];
    child.stdout.on('data', d => out.push(d));
    child.stderr.on('data', d => err.push(d));
    child.on('error', reject);
    child.on('close', code => {
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = Buffer.concat(err).toString('utf8');
      if (code !== 0) return reject(new Error(stderr || `exit ${code}`));
      resolve({ stdout, stderr });
    });
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) {
    throw new Error(`cache missing — call tool "update_products" first.`);
  }
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  cache.ageHours = (Date.now() - new Date(cache.fetchedAt)) / 3600e3;
  return cache;
}

function reshapeForFlex(products) {
  return products.map(p => ({
    product_data: [{
      id: p.productId, sku: p.sku, name: p.name, name_en: p.nameEn, spec_name: p.specName,
      is_promotion:  p.tags?.includes('promotion')   ? 1 : 0,
      is_bestseller: p.tags?.includes('bestseller')  ? 1 : 0,
      is_recommend:  p.tags?.includes('new_arrival') ? 1 : 0,
    }],
    product_photo: [{ photo_path: (p.image || '').replace('https://manager.cnypharmacy.com/','') }],
    product_price: [{ product_price: [{ price: p.basePrice, promotion_price: p.promotionPrice || p.basePrice }] }],
    product_unit:  [{ unit: p.unit || '' }],
    product_stock: [{ stock_num: p.stock ?? 0 }],
    product_is_flashSale: p.tags?.includes('flash_sale') ? 1 : 0,
    is_rx: p.isPrescription ? 1 : 0,
  }));
}

// ── tools ───────────────────────────────────────────────────────────
const tools = {
  update_products: {
    description: 'Refresh local CNY product cache (~24s). Fetches ~6,400 products from CNY API in parallel, classifies by tags, writes <plugin>/.cache/cny-products.json + .xlsx. Run before first use, then every ~24h or whenever stock/promo changes.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler() {
      const { stdout } = await spawnNode(REFRESH_SCRIPT);
      return JSON.parse(stdout);
    },
  },

  cache_status: {
    description: 'Read cache metadata (age, totals, category counts) without refetching. Returns {exists:false} if cache missing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler() {
      if (!fs.existsSync(CACHE_PATH)) return { exists: false };
      const c = loadCache();
      return { exists: true, fetchedAt: c.fetchedAt, ageHours: c.ageHours, totalUnique: c.totalUnique, summary: c.summary };
    },
  },

  list_tags: {
    description: 'List all LINE recipient tags {id,name,color,usageCount}. Use to resolve human tag names → numeric IDs before estimate_recipients/submit_broadcast.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler() {
      const cookie = readCookie();
      const { status, data } = await httpsRequest('GET', `https://${INBOX_HOST}/api/inbox/tags`, { cookie });
      if (status !== 200) throw new Error(`tags fetch failed: ${status} ${JSON.stringify(data).slice(0,200)}`);
      return data.data || data;
    },
  },

  pick_products: {
    description: 'Pick N products from local cache by keyword + theme. Fast (<50ms). If theme has fewer than `limit` matches, fills the remainder with keyword-matched items.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'substring match on name+nameEn+specName, case-insensitive (Thai/English).' },
        theme:   { type: 'string', enum: ['promotion','flash_sale','bestseller','new_arrival','product_catalog'], default: 'promotion' },
        limit:   { type: 'integer', minimum: 1, maximum: 47, default: 12 },
        skus:    { type: 'array', items: { type: 'string' }, description: 'explicit SKU allowlist (overrides keyword).' },
        requireStock: { type: 'boolean', default: false, description: 'if true, only include products with stock > 0.' },
      },
      additionalProperties: false,
    },
    async handler({ keyword = '', theme = 'promotion', limit = 12, skus = null, requireStock = false }) {
      const cache = loadCache();
      const kw = keyword.toLowerCase();
      let filtered = cache.products.filter(p => p.basePrice > 0);
      if (requireStock) filtered = filtered.filter(p => p.stock > 0);
      if (skus && skus.length) filtered = filtered.filter(p => skus.includes(p.sku));
      else if (kw) filtered = filtered.filter(p => (p.name + p.nameEn + p.specName).toLowerCase().includes(kw));
      const primary = filtered.filter(p => p.tags.includes(theme));
      const primaryIds = new Set(primary.map(p => p.productId));
      const picked = primary.length >= limit
        ? primary.slice(0, limit)
        : [...primary, ...filtered.filter(p => !primaryIds.has(p.productId))].slice(0, limit);
      return {
        picked,
        cacheAgeHours: Number(cache.ageHours.toFixed(2)),
        cacheFetchedAt: cache.fetchedAt,
        totalMatched: filtered.length,
        themePrimaryCount: primary.length,
      };
    },
  },

  estimate_recipients: {
    description: 'POST /api/inbox/broadcasts/estimate — count LINE users that would receive a broadcast for given tag IDs (union).',
    inputSchema: {
      type: 'object',
      properties: {
        targetTagIds: { type: 'array', items: { type: 'integer' }, minItems: 1, description: 'numeric tag IDs from list_tags.' },
      },
      required: ['targetTagIds'], additionalProperties: false,
    },
    async handler({ targetTagIds }) {
      const cookie = readCookie();
      const { status, data } = await httpsRequest('POST', `https://${INBOX_HOST}/api/inbox/broadcasts/estimate`, {
        cookie, body: JSON.stringify({ targetTagIds }),
      });
      if (status !== 200) throw new Error(`estimate failed: ${status} ${JSON.stringify(data).slice(0,300)}`);
      return data.data || data;
    },
  },

  build_flex_2up: {
    description: 'Build LINE Flex Messages JSON with 2-products-per-bubble layout. Returns flexMessages (for submit_broadcast.flexMessages) and contentText (for submit_broadcast.content).',
    inputSchema: {
      type: 'object',
      properties: {
        products:    { type: 'array', description: 'output of pick_products.picked', minItems: 1 },
        theme:       { type: 'string', enum: ['promotion','flash_sale','bestseller','new_arrival','product_catalog'], default: 'promotion' },
        title:       { type: 'string' },
        intro:       { type: 'string' },
        ctaLabel:    { type: 'string', default: 'ซื้อเลย' },
        badgeText:   { type: 'string', default: 'PROMOTION' },
        actionUrl:   { type: 'string', default: 'https://www.cnypharmacy.com' },
        footerText:  { type: 'string' },
        closingText: { type: 'string' },
      },
      required: ['products','title'], additionalProperties: false,
    },
    async handler({ products, theme = 'promotion', title, intro = '', ctaLabel = 'ซื้อเลย', badgeText = 'PROMOTION', actionUrl = 'https://www.cnypharmacy.com', footerText = '', closingText = '' }) {
      const payload = {
        cny: { product: reshapeForFlex(products) },
        theme, limit: products.length,
        title, intro, ctaLabel, badgeText, actionUrl, footerText, closingText,
      };
      const { stdout } = await spawnNode(FLEX_SCRIPT, [], JSON.stringify(payload));
      const messages = JSON.parse(stdout);
      const flex = messages.filter(m => m.type === 'flex');
      const text = (messages.find(m => m.type === 'text') || {}).text || '';
      return {
        flexMessages: flex,
        contentText: text,
        carousels: flex.length,
        bubblesTotal: flex.reduce((s, m) => s + m.contents.contents.length, 0),
        hasClosing: Boolean(text),
      };
    },
  },

  list_scheduled_broadcasts: {
    description: 'List broadcasts via GET /api/inbox/broadcasts. Use to check for scheduled conflicts.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['scheduled','draft','sent','failed','cancelled','sending'], default: 'scheduled' },
        limit:  { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      additionalProperties: false,
    },
    async handler({ status = 'scheduled', limit = 20 }) {
      const cookie = readCookie();
      const { status: code, data } = await httpsRequest('GET', `https://${INBOX_HOST}/api/inbox/broadcasts?status=${status}&limit=${limit}`, { cookie });
      if (code !== 200) throw new Error(`list failed: ${code} ${JSON.stringify(data).slice(0,200)}`);
      return data.data || data;
    },
  },

  submit_broadcast: {
    description: 'POST a scheduled broadcast to inbox.re-ya.com. scheduledAt is auto-normalized to UTC Z. targetTagIds must be numbers. The cron processor sends at scheduledAt.',
    inputSchema: {
      type: 'object',
      properties: {
        flexMessages: { type: 'array', minItems: 1, description: 'output of build_flex_2up.flexMessages' },
        scheduledAt:  { type: 'string', description: 'ISO 8601 with any TZ — normalized to UTC.' },
        targetTagIds: { type: 'array', items: { type: 'integer' }, minItems: 1 },
        content:      { type: 'string', default: '', description: 'closing text body (build_flex_2up.contentText).' },
      },
      required: ['flexMessages','scheduledAt','targetTagIds'], additionalProperties: false,
    },
    async handler({ flexMessages, scheduledAt, targetTagIds, content = '' }) {
      const cookie = readCookie();
      const isoUtc = new Date(scheduledAt).toISOString();
      const body = JSON.stringify({
        flexContents: flexMessages,
        scheduledAt: isoUtc,
        targetTagIds,
        content,
      });
      const { status, data } = await httpsRequest('POST', `https://${INBOX_HOST}/api/inbox/broadcasts`, { cookie, body });
      if (status !== 200) throw new Error(`submit failed: ${status} ${JSON.stringify(data).slice(0,400)}`);
      const out = data.data || data;
      return {
        id: out.id,
        status: out.status,
        scheduledAt: out.scheduledAt,
        totalRecipients: out.totalRecipients,
        calendarUrl:   `https://${INBOX_HOST}/inbox/calendar`,
        broadcastsUrl: `https://${INBOX_HOST}/inbox/broadcasts`,
      };
    },
  },
};

// ── JSON-RPC stdio loop ─────────────────────────────────────────────
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }

async function handle(req) {
  const { id, method, params } = req;
  try {
    if (method === 'initialize') {
      send({ jsonrpc: '2.0', id, result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'line-broadcast', version: '0.2.0' },
      }});
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: {
        tools: Object.entries(tools).map(([name, t]) => ({
          name, description: t.description, inputSchema: t.inputSchema,
        })),
      }});
    } else if (method === 'tools/call') {
      const tool = tools[params?.name];
      if (!tool) {
        send({ jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool: ${params?.name}` } });
        return;
      }
      const result = await tool.handler(params.arguments || {});
      send({ jsonrpc: '2.0', id, result: {
        content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
      }});
    } else if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
      // no response required
    } else if (id != null) {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
    }
  } catch (e) {
    if (id != null) {
      send({ jsonrpc: '2.0', id, result: {
        content: [{ type: 'text', text: `ERROR: ${e.message}` }],
        isError: true,
      }});
    }
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let req; try { req = JSON.parse(line); } catch { continue; }
    handle(req);
  }
});

process.stdin.on('end', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
