#!/usr/bin/env node
// refresh-cache.cjs — Fetch CNY promotion catalog: pull the campaign manifest
// from `data_promotion_only`, then enrich with product detail (image/price/
// stock) from the paginated catalog. Output only promo SKUs.
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

const detailUrl = p => `${CNY_API}?page=${p}&paginate_num=${PAGE_SIZE}&isPageGroup=`;
const promoUrl  = () => `${CNY_API}?page=1`;

async function fetchWithRetry(url, retry = 2) {
  for (let i = 0; i <= retry; i++) {
    try { return await fetchJson(url); }
    catch (e) {
      if (i === retry) throw new Error(`${url} failed after ${retry+1} tries: ${e.message}`);
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

function buildPromoIndex(dataPromotionOnly) {
  const byProductId = new Map();
  const bySku = new Map();
  for (const camp of dataPromotionOnly || []) {
    const discountType = camp.discount_type; // 'discount' | 'giveaway'
    for (const p of camp.data_product || []) {
      const entry = {
        campaignId:    p.campaign_id,
        campaignType:  p.campaign_type,
        campaignGroup: discountType,
        campaignName:  p.campaign_name || '',
        startPro:      p.start_pro || null,
        endPro:        p.end_pro || null,
        discount:      toN(p.discount),
        discountUnit:  p.discount_type, // 'baht' | 'percent'
        qty:           toN(p.qty),
        unit:          p.unit || '',
        isGiveaway:    p.is_giveaway === 1,
        isBuyPack:     p.is_buy_pack === 1,
      };
      if (p.id) {
        if (!byProductId.has(p.id)) byProductId.set(p.id, []);
        byProductId.get(p.id).push(entry);
      }
      if (p.sku) {
        const k = String(p.sku);
        if (!bySku.has(k)) bySku.set(k, []);
        bySku.get(k).push(entry);
      }
    }
  }
  return { byProductId, bySku };
}

function flatten(it) {
  const d  = it.product_data?.[0] || {};
  const pi = it.product_price?.[0]?.product_price?.[0] || {};
  const photo = it.product_photo?.[0]?.photo_path || null;
  const unit  = it.product_unit?.[0]?.unit || '';
  const basePrice = toN(pi.price);
  const promoRaw  = toN(pi.promotion_price);
  const promotionPrice = promoRaw > 0 && promoRaw < basePrice ? promoRaw : null;
  const stockTotal = (it.product_stock || []).reduce((s, x) => s + toN(x.stock_num), 0);

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
  };
}

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  process.stderr.write('[1/5] fetch promo manifest (data_promotion_only)…\n');
  const promoResp = await fetchWithRetry(promoUrl());
  const promoIdx = buildPromoIndex(promoResp.data_promotion_only);
  process.stderr.write(`     campaigns=${(promoResp.data_promotion_only||[]).length} unique_promo_skus=${promoIdx.bySku.size}\n`);

  process.stderr.write('[2/5] fetch catalog page 1 to discover total…\n');
  const page1 = await fetchWithRetry(detailUrl(1));
  const items1 = page1.product || [];
  const declaredTotal = page1.paginate?.total ?? null;
  const perPage = items1.length || PAGE_SIZE;
  let pages;
  if (declaredTotal && declaredTotal > 0) {
    pages = Math.max(1, Math.ceil(declaredTotal / perPage));
    process.stderr.write(`     total=${declaredTotal} per_page=${perPage} pages=${pages}\n`);
  } else {
    pages = items1.length < PAGE_SIZE ? 1 : null;
    process.stderr.write(`     paginate.total missing — will probe until short page (per_page=${perPage})\n`);
  }

  let restPages;
  if (pages !== null) {
    process.stderr.write(`[3/5] fetch ${pages - 1} remaining catalog pages (concurrency=${CONCURRENCY})…\n`);
    const remaining = Array.from({ length: pages - 1 }, (_, i) => i + 2);
    restPages = await pMap(remaining, CONCURRENCY, async (p) => {
      const d = await fetchWithRetry(detailUrl(p));
      return d.product || [];
    });
  } else {
    process.stderr.write(`[3/5] probe pages in batches of ${CONCURRENCY} until short page…\n`);
    restPages = [];
    let nextPage = 2;
    let stop = false;
    while (!stop) {
      const batch = Array.from({ length: CONCURRENCY }, (_, i) => nextPage + i);
      const batchResults = await pMap(batch, CONCURRENCY, async (p) => {
        try {
          const d = await fetchWithRetry(detailUrl(p));
          return d.product || [];
        } catch (e) { return []; }
      });
      for (let i = 0; i < batchResults.length; i++) {
        const items = batchResults[i];
        restPages.push(items);
        if (items.length < PAGE_SIZE) { stop = true; pages = batch[i]; break; }
      }
      if (!stop) nextPage += CONCURRENCY;
      if (nextPage > 200) { stop = true; pages = nextPage - 1; }
    }
    process.stderr.write(`     discovered pages=${pages}\n`);
  }

  const rawItems = items1.concat(...restPages);
  process.stderr.write(`[4/5] flatten + filter to promo SKUs (raw=${rawItems.length}, promo_skus=${promoIdx.bySku.size})…\n`);
  const seen = new Set();
  const products = [];
  let matched = 0;
  for (const raw of rawItems) {
    const flat = flatten(raw);
    if (!flat.sku || !flat.productId || seen.has(flat.productId)) continue;
    const promos = promoIdx.byProductId.get(flat.productId) || promoIdx.bySku.get(flat.sku);
    if (!promos || promos.length === 0) continue;
    seen.add(flat.productId);
    matched++;
    products.push({ ...flat, promos });
  }
  const missingSkus = [...promoIdx.bySku.keys()].filter(s => !products.some(p => p.sku === s));
  process.stderr.write(`     matched=${matched} missing_from_catalog=${missingSkus.length}\n`);

  const summary = {
    discount:     products.filter(p => p.promos.some(x => x.campaignGroup === 'discount')).length,
    giveaway:     products.filter(p => p.promos.some(x => x.campaignGroup === 'giveaway')).length,
    buy_pack:     products.filter(p => p.promos.some(x => x.isBuyPack)).length,
    in_stock:     products.filter(p => p.stock > 0).length,
    total_unique: products.length,
    promo_skus_total: promoIdx.bySku.size,
    missing_from_catalog: missingSkus.length,
  };

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    pagesScanned: pages,
    rawCount: rawItems.length,
    campaignsCount: (promoResp.data_promotion_only || []).length,
    totalUnique: products.length,
    summary,
    missingSkus,
    products,
  };

  process.stderr.write(`[5/5] write cache → ${JSON_PATH}\n`);
  fs.writeFileSync(JSON_PATH, JSON.stringify(snapshot, null, 2));

  try {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const columns = ['sku','name','nameEn','specName','basePrice','promotionPrice','unit','stock','isPrescription','campaignGroups','discounts','endsAt','url','image','productId'];
    const toRow = p => ({
      ...p,
      campaignGroups: [...new Set(p.promos.map(x => x.campaignGroup))].join(','),
      discounts:      p.promos.map(x => `${x.discount}${x.discountUnit === 'percent' ? '%' : '฿'}${x.qty ? `×${x.qty}` : ''}`).join(' | '),
      endsAt:         p.promos.map(x => (x.endPro || '').slice(0, 10)).join(' | '),
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products.map(toRow), { header: columns }), 'all_promos');
    for (const grp of ['discount','giveaway']) {
      const rows = products.filter(p => p.promos.some(x => x.campaignGroup === grp)).map(toRow);
      if (rows.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, { header: columns }), grp);
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
    campaignsCount: snapshot.campaignsCount,
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
