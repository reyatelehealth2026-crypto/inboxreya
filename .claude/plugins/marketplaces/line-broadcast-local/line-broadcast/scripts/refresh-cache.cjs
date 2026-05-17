#!/usr/bin/env node
// refresh-cache.cjs — Fetch full CNY product catalog, classify by category,
// write JSON + XLSX cache under <plugin>/.cache/.
//
// Usage: node <plugin>/scripts/refresh-cache.cjs
// Output: <plugin>/.cache/cny-products.json  +  cny-products.xlsx

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR   = path.join(PLUGIN_ROOT, '.cache');
const JSON_PATH   = path.join(CACHE_DIR, 'cny-products.json');
const XLSX_PATH   = path.join(CACHE_DIR, 'cny-products.xlsx');

const CNY_API     = 'https://www.cnypharmacy.com/api/getDataProductIsGroup';
const CNY_IMG     = 'https://manager.cnypharmacy.com';
const CNY_BASE    = 'https://www.cnypharmacy.com';
const PLACEHOLDER = `${CNY_IMG}/uploads/product_photo/placeholder.jpg`;
const PAGE_SIZE   = 100;
const CONCURRENCY = 6;
const TIMEOUT_MS  = 25000;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: TIMEOUT_MS }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`bad JSON from ${url}: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`timeout ${TIMEOUT_MS}ms`)));
  });
}

const pageUrl = p => `${CNY_API}?page=${p}&paginate_num=${PAGE_SIZE}&isPageGroup=`;

async function fetchPage(p, retry = 2) {
  for (let i = 0; i <= retry; i++) {
    try { return await fetchJson(pageUrl(p)); }
    catch (e) {
      if (i === retry) throw new Error(`page ${p} failed after ${retry+1} tries: ${e.message}`);
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}

async function pMap(items, n, worker) {
  const results = new Array(items.length);
  let i = 0, done = 0;
  return new Promise((resolve, reject) => {
    const next = () => {
      if (done >= items.length) return resolve(results);
      while (i < items.length && (i - done) < n) {
        const idx = i++;
        Promise.resolve(worker(items[idx], idx))
          .then(r => { results[idx] = r; done++; next(); })
          .catch(reject);
      }
    };
    next();
  });
}

const toN = v => { if (v == null) return 0; const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };

function flatten(it) {
  const d  = it.product_data?.[0] || {};
  const pi = it.product_price?.[0]?.product_price?.[0] || {};
  const photo = it.product_photo?.[0]?.photo_path || null;
  const unit  = it.product_unit?.[0]?.unit || '';
  const basePrice = toN(pi.price);
  const promoRaw  = toN(pi.promotion_price);
  const promotionPrice = promoRaw > 0 && promoRaw < basePrice ? promoRaw : null;
  const stockTotal = (it.product_stock || []).reduce((s, x) => s + toN(x.stock_num), 0);

  const tags = [];
  if (d.is_promotion === 1) tags.push('promotion');
  if (it.product_is_flashSale === 1) tags.push('flash_sale');
  if (d.is_bestseller === 1 || (it.customer_buyed ?? 0) > 0) tags.push('bestseller');
  if (d.is_recommend === 1 || it.product_is_recommend === 1) tags.push('new_arrival');

  return {
    sku: d.sku || '',
    productId: d.id || null,
    name: d.name || '',
    nameEn: (d.name_en || '').trim(),
    specName: (d.spec_name || '').trim(),
    image: photo ? `${CNY_IMG}/${photo}` : PLACEHOLDER,
    url: d.sku ? `${CNY_BASE}/product/${d.sku}` : CNY_BASE,
    basePrice,
    promotionPrice,
    unit,
    stock: stockTotal,
    isPrescription: it.is_rx === 1,
    tags,
  };
}

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  process.stderr.write('[1/4] fetch page 1 to discover total…\n');
  const page1 = await fetchPage(1);
  const items1 = page1.product || [];
  const perPage = items1.length || PAGE_SIZE;
  const declaredTotal = page1.paginate?.total ?? null;
  let pages;
  if (declaredTotal && declaredTotal > 0) {
    pages = Math.max(1, Math.ceil(declaredTotal / perPage));
    process.stderr.write(`     total=${declaredTotal} per_page=${perPage} pages=${pages}\n`);
  } else {
    pages = items1.length < PAGE_SIZE ? 1 : null;
    process.stderr.write(`     paginate.total missing — will probe pages until a short page is seen (per_page=${perPage})\n`);
  }

  let restPages;
  if (pages !== null) {
    process.stderr.write(`[2/4] fetch ${pages - 1} remaining pages (concurrency=${CONCURRENCY})…\n`);
    const remaining = Array.from({ length: pages - 1 }, (_, i) => i + 2);
    restPages = await pMap(remaining, CONCURRENCY, async (p) => {
      const d = await fetchPage(p);
      return d.product || [];
    });
  } else {
    process.stderr.write(`[2/4] probe pages in batches of ${CONCURRENCY} until short page…\n`);
    restPages = [];
    let nextPage = 2;
    let stop = false;
    while (!stop) {
      const batch = Array.from({ length: CONCURRENCY }, (_, i) => nextPage + i);
      const batchResults = await pMap(batch, CONCURRENCY, async (p) => {
        try {
          const d = await fetchPage(p);
          return d.product || [];
        } catch (e) {
          return [];
        }
      });
      for (let i = 0; i < batchResults.length; i++) {
        const items = batchResults[i];
        restPages.push(items);
        if (items.length < PAGE_SIZE) {
          stop = true;
          pages = batch[i];
          break;
        }
      }
      if (!stop) nextPage += CONCURRENCY;
      if (nextPage > 200) { stop = true; pages = nextPage - 1; }
    }
    process.stderr.write(`     discovered pages=${pages}\n`);
  }

  const rawItems = items1.concat(...restPages);
  process.stderr.write(`[3/4] flatten + classify ${rawItems.length} items…\n`);
  const seen = new Set();
  const products = [];
  for (const raw of rawItems) {
    const flat = flatten(raw);
    if (!flat.sku || !flat.productId || seen.has(flat.productId)) continue;
    seen.add(flat.productId);
    products.push(flat);
  }

  const summary = {
    promotion:    products.filter(p => p.tags.includes('promotion')).length,
    flash_sale:   products.filter(p => p.tags.includes('flash_sale')).length,
    bestseller:   products.filter(p => p.tags.includes('bestseller')).length,
    new_arrival:  products.filter(p => p.tags.includes('new_arrival')).length,
    in_stock:     products.filter(p => p.stock > 0).length,
    total_unique: products.length,
  };

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    pagesScanned: pages,
    rawCount: rawItems.length,
    totalUnique: products.length,
    summary,
    products,
  };

  process.stderr.write(`[4/4] write cache → ${JSON_PATH}\n`);
  fs.writeFileSync(JSON_PATH, JSON.stringify(snapshot, null, 2));

  try {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const columns = ['sku','name','nameEn','specName','basePrice','promotionPrice','unit','stock','isPrescription','tags','url','image','productId'];
    const toRow = p => ({ ...p, tags: p.tags.join(',') });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products.map(toRow), { header: columns }), 'all_products');
    for (const cat of ['promotion','flash_sale','bestseller','new_arrival']) {
      const rows = products.filter(p => p.tags.includes(cat)).map(toRow);
      if (rows.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, { header: columns }), cat);
      }
    }
    XLSX.writeFile(wb, XLSX_PATH);
  } catch (e) {
    process.stderr.write(`     xlsx skipped: ${e.message}\n`);
  }

  const out = {
    ok: true,
    fetchedAt: snapshot.fetchedAt,
    durationMs: snapshot.durationMs,
    pagesScanned: pages,
    totalUnique: products.length,
    summary,
    paths: { json: JSON_PATH, xlsx: fs.existsSync(XLSX_PATH) ? XLSX_PATH : null },
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main().catch(e => {
  process.stderr.write(`refresh-cache failed: ${e.stack || e.message}\n`);
  process.exit(1);
});
